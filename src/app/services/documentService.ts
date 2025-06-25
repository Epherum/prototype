// src/app/services/documentService.ts

import prisma from "@/app/utils/prisma";
import {
  Document,
  DocumentLine,
  DocumentState,
  DocumentType,
  Prisma,
  EntityState,
  ApprovalStatus,
} from "@prisma/client";
import { z } from "zod";

// --- Zod Validation Schemas ---

// Schema for a single line item in the creation payload
const createDocumentLineSchema = z.object({
  journalPartnerGoodLinkId: z.bigint(), // Will be parsed from string
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
  partnerId: z.bigint(), // Will be parsed from string
  description: z.string().optional().nullable(),
  paymentMode: z.string().optional().nullable(),
  lines: z
    .array(createDocumentLineSchema)
    .min(1, "A document must have at least one line item."),
});

// --- Type Definitions ---
export type CreateDocumentData = z.infer<typeof createDocumentSchema>;

// --- Service Logic ---
const documentService = {
  /**
   * Creates a new Document and its associated DocumentLines in a single transaction.
   * All financial calculations are performed here to ensure data integrity.
   * @param data The validated document creation data.
   * @param createdById The ID of the user creating the document.
   * @param createdByIp The IP address of the user.
   * @returns The newly created Document with its lines.
   */
  async createDocument(
    data: CreateDocumentData,
    createdById: string,
    createdByIp?: string | null
  ): Promise<Document & { lines: DocumentLine[] }> {
    console.log(
      `Chef (DocumentService): Creating new document ${data.refDoc} for partner ${data.partnerId}`
    );

    // Perform all calculations server-side
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
        // Data for prisma.documentLine.create
        journalPartnerGoodLinkId: line.journalPartnerGoodLinkId,
        designation: line.designation,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercentage: line.discountPercentage || 0,
        taxRate: line.taxRate,
        unitOfMeasure: line.unitOfMeasure,
        isTaxExempt: line.isTaxExempt,
        // Calculated fields
        netTotal: lineHT,
        discountAmount: lineDiscountAmount,
        taxAmount: lineTaxAmount,
      };
    });

    const totalTTC = totalHT + totalTax;

    const newDocument = await prisma.document.create({
      data: {
        // Document fields
        refDoc: data.refDoc,
        type: data.type,
        date: data.date,
        partnerId: data.partnerId,
        description: data.description,
        paymentMode: data.paymentMode,
        // Calculated totals
        totalHT,
        totalTax,
        totalTTC,
        balance: totalTTC, // Initially, balance is the full amount
        // Audit fields
        createdById,
        createdByIp,
        entityState: EntityState.ACTIVE,
        approvalStatus: ApprovalStatus.PENDING, // Or DRAFT state? Let's use PENDING for now.
        // Nested write to create lines atomically
        lines: {
          create: linesToCreate,
        },
      },
      include: {
        lines: true, // Return the created lines with the document
      },
    });

    console.log(
      `Chef (DocumentService): Successfully created document ${newDocument.id} with ${newDocument.lines.length} lines.`
    );
    return newDocument;
  },

  /**
   * Fetches documents, primarily filtered by partner.
   * @param options Options for filtering, e.g., partnerId.
   * @returns A list of documents and the total count.
   */
  async getDocuments(options: {
    partnerId?: bigint;
    take?: number;
    skip?: number;
  }): Promise<{ documents: Document[]; totalCount: number }> {
    const { partnerId, take, skip } = options;

    const where: Prisma.DocumentWhereInput = {
      entityState: "ACTIVE",
    };

    if (partnerId) {
      where.partnerId = partnerId;
    }

    const totalCount = await prisma.document.count({ where });
    const documents = await prisma.document.findMany({
      where,
      take,
      skip,
      orderBy: {
        date: "desc",
      },
    });

    return { documents, totalCount };
  },
};

export default documentService;
