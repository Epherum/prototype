import prisma from "@/app/utils/prisma";
import {
  Document,
  DocumentLine,
  DocumentState,
  DocumentType,
  Prisma,
  EntityState,
  ApprovalStatus,
  User, // Import User type for the delete audit trail
} from "@prisma/client";
import { z } from "zod";

// Schema for a single line item in the creation payload
const createDocumentLineSchema = z.object({
  journalPartnerGoodLinkId: z.bigint(),
  designation: z.string().min(1, "Designation is required."),
  quantity: z.number().positive("Quantity must be positive."),
  unitPrice: z.number().gte(0, "Unit price cannot be negative."),
  discountPercentage: z.number().min(0).max(1).default(0).optional(),
  taxRate: z.number().min(0).max(1),
  unitOfMeasure: z.string().optional().nullable(),
  isTaxExempt: z.boolean().default(false).optional(),
});

// Main schema for creating a new document
export const createDocumentSchema = z.object({
  refDoc: z.string().min(1, "Document reference is required."),
  type: z.nativeEnum(DocumentType),
  date: z.coerce.date(),
  partnerId: z.bigint(),
  description: z.string().optional().nullable(),
  paymentMode: z.string().optional().nullable(),
  lines: z
    .array(createDocumentLineSchema)
    .min(1, "A document must have at least one line item."),
});

// Schema for updating an existing document. All fields are optional.
export const updateDocumentSchema = z.object({
  refDoc: z.string().min(1, "Document reference is required.").optional(),
  date: z.coerce.date().optional(),
  description: z.string().optional().nullable(),
  paymentMode: z.string().optional().nullable(),
});

// Type Definitions
export type CreateDocumentData = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentData = z.infer<typeof updateDocumentSchema>;

const documentService = {
  /**
   * Creates a new Document and its associated DocumentLines in a single transaction.
   * @param data The validated document creation data.
   * @param createdById The ID of the user creating the document. (MODIFIED)
   * @param createdByIp The IP address of the user. (MODIFIED)
   * @returns The newly created Document with its lines.
   */
  async createDocument(
    data: CreateDocumentData,
    createdById: string,
    createdByIp?: string | null
  ): Promise<Document & { lines: DocumentLine[] }> {
    // ... (financial calculations remain the same)

    let totalHT = 0;
    let totalTax = 0;
    const linesToCreate = data.lines.map((line) => {
      const lineNetTotal = line.quantity * line.unitPrice;
      const lineDiscountAmount = lineNetTotal * (line.discountPercentage || 0);
      const lineHT = lineNetTotal - lineDiscountAmount;
      const lineTaxAmount = line.isTaxExempt ? 0 : lineHT * line.taxRate;
      totalHT += lineHT;
      totalTax += lineTaxAmount;
      return {
        journalPartnerGoodLinkId: line.journalPartnerGoodLinkId,
        designation: line.designation,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercentage: line.discountPercentage || 0,
        taxRate: line.taxRate,
        unitOfMeasure: line.unitOfMeasure,
        isTaxExempt: line.isTaxExempt,
        netTotal: lineHT,
        discountAmount: lineDiscountAmount,
        taxAmount: lineTaxAmount,
      };
    });
    const totalTTC = totalHT + totalTax;

    const newDocument = await prisma.document.create({
      data: {
        refDoc: data.refDoc,
        type: data.type,
        date: data.date,
        partnerId: data.partnerId,
        description: data.description,
        paymentMode: data.paymentMode,
        totalHT,
        totalTax,
        totalTTC,
        balance: totalTTC,
        createdById, // FIX: Pass the user's ID to the query
        createdByIp, // FIX: Pass the user's IP to the query
        entityState: EntityState.ACTIVE,
        approvalStatus: ApprovalStatus.PENDING,
        lines: {
          create: linesToCreate,
        },
      },
      include: {
        lines: true,
      },
    });

    return newDocument;
  },

  /**
   * Fetches documents, primarily filtered by partner.
   * (Existing function, no changes)
   */
  async getDocuments(options: {
    partnerId?: bigint;
    take?: number;
    skip?: number;
  }): Promise<{ documents: Document[]; totalCount: number }> {
    // ... (implementation remains the same)
    const { partnerId, take, skip } = options;
    const where: Prisma.DocumentWhereInput = { entityState: "ACTIVE" };
    if (partnerId) {
      where.partnerId = partnerId;
    }
    const totalCount = await prisma.document.count({ where });
    const documents = await prisma.document.findMany({
      where,
      take,
      skip,
      orderBy: { date: "desc" },
    });
    return { documents, totalCount };
  },

  // --- NEW: Full CRUD methods ---

  /**
   * Fetches a single document by its ID.
   * @param id The unique identifier of the document.
   * @returns The document with its lines and partner, or null if not found.
   */
  async getDocumentById(id: bigint) {
    return await prisma.document.findUnique({
      where: { id, entityState: "ACTIVE" },
      include: {
        lines: true,
        partner: true,
      },
    });
  },

  /**
   * Updates an existing document.
   * @param id The ID of the document to update.
   * @param data The validated data for the update.
   * @returns The updated document.
   */
  async updateDocument(id: bigint, data: UpdateDocumentData) {
    return await prisma.document.update({
      where: { id },
      data,
    });
  },

  /**
   * Soft-deletes a document by setting its entityState to DELETED.
   * @param id The ID of the document to delete.
   * @param user The user performing the delete action for auditing.
   * @returns The updated document record showing the soft-delete state.
   */
  async deleteDocument(id: bigint, user: User) {
    return await prisma.document.update({
      where: { id },
      data: {
        entityState: "DELETED",
        deletedAt: new Date(),
        deletedById: user.id, // Records who performed the deletion
      },
    });
  },
};

export default documentService;
