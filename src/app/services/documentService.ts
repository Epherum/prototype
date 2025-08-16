import prisma from "@/app/utils/prisma";
import {
  Document,
  DocumentLine,
  DocumentType,
  Prisma,
  EntityState,
  ApprovalStatus,
} from "@prisma/client";
import { z } from "zod";
import { journalService } from "./journalService";
import { jsonBigIntReplacer } from "../utils/jsonBigInt";
import { serviceLogger } from "@/lib/logger";

// ===================================
// Type Definitions
// ===================================

// ✨ NEW: Options for the powerful getAllDocuments function.
export interface GetAllDocumentsOptions {
  take?: number;
  skip?: number;
  restrictedJournalId?: string | null; // User's permission

  // Filtering by selections in other sliders
  filterByJournalIds?: string[];
  filterByPartnerIds?: bigint[];
  filterByGoodIds?: bigint[];
}

// ✏️ MODIFIED: Line schema now includes goodId for denormalization on DocumentLine.
const createDocumentLineSchema = z.object({
  journalPartnerGoodLinkId: z.bigint(),
  goodId: z.bigint(), // NEW: This is required to populate the denormalized field.
  designation: z.string().min(1, "Designation is required."),
  quantity: z.number().positive("Quantity must be positive."),
  unitPrice: z.number().gte(0, "Unit price cannot be negative."),
  discountPercentage: z.number().min(0).max(1).default(0),
  taxRate: z.number().min(0).max(1),
  unitOfMeasure: z.string().optional().nullable(),
  isTaxExempt: z.boolean().default(false),
});

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

export type CreateDocumentData = z.infer<typeof createDocumentSchema>;

// Update schema remains unchanged as per the spec.
export const updateDocumentSchema = z.object({
  refDoc: z.string().min(1).optional(),
  date: z.coerce.date().optional(),
  description: z.string().optional().nullable(),
  paymentMode: z.string().optional().nullable(),
});
export type UpdateDocumentData = z.infer<typeof updateDocumentSchema>;

// ===================================
// Service Implementation
// ===================================

const documentService = {
  /**
   * ✏️ MODIFIED: Creates a Document, populating new denormalized fields.
   */
  async createDocument(
    data: CreateDocumentData,
    createdById: string,
    journalId: string // NEW: Journal context is now required.
  ): Promise<Document & { lines: DocumentLine[] }> {
    serviceLogger.debug(
      "documentService.createDocument: Input",
      JSON.stringify({ ...data, createdById, journalId }, jsonBigIntReplacer)
    );

    let totalHT = 0;
    let totalTax = 0;

    const linesToCreate = data.lines.map((line) => {
      const lineNetTotal = line.quantity * line.unitPrice;
      const lineDiscountAmount = lineNetTotal * line.discountPercentage;
      const lineHT = lineNetTotal - lineDiscountAmount;
      const lineTaxAmount = line.isTaxExempt ? 0 : lineHT * line.taxRate;
      totalHT += lineHT;
      totalTax += lineTaxAmount;
      return {
        // Core link
        journalPartnerGoodLinkId: line.journalPartnerGoodLinkId,
        // ✨ NEW: Denormalized field for efficient filtering
        goodId: line.goodId,
        // Line details
        designation: line.designation,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercentage: line.discountPercentage,
        taxRate: line.taxRate,
        unitOfMeasure: line.unitOfMeasure,
        isTaxExempt: line.isTaxExempt,
        // Calculated values
        netTotal: lineHT,
        discountAmount: lineDiscountAmount,
        taxAmount: lineTaxAmount,
      };
    });
    const totalTTC = totalHT + totalTax;

    const newDocument = await prisma.document.create({
      data: {
        ...data, // refDoc, type, date, partnerId, description, etc.
        // ✨ NEW: Denormalized field for efficient filtering
        journalId,
        // Calculated totals
        totalHT,
        totalTax,
        totalTTC,
        balance: totalTTC,
        // Audit and state
        createdById,
        entityState: EntityState.ACTIVE,
        approvalStatus: ApprovalStatus.PENDING,
        // Nested line creation
        lines: {
          create: linesToCreate,
        },
      },
      include: {
        lines: true,
      },
    });

    serviceLogger.debug("documentService.createDocument: Output", newDocument);
    return newDocument;
  },

  /**
   * ✨ NEW: The powerful fetching function for the Document slider.
   * Replaces the old `getDocuments` function.
   */
  async getAllDocuments(
    options: GetAllDocumentsOptions
  ): Promise<{ data: Document[]; totalCount: number }> {
    serviceLogger.debug(
      `documentService.getAllDocuments: Input ${JSON.stringify(options, jsonBigIntReplacer)}`
    );
    const {
      take,
      skip,
      restrictedJournalId,
      filterByJournalIds,
      filterByPartnerIds,
      filterByGoodIds,
    } = options;

    let where: Prisma.DocumentWhereInput = { entityState: "ACTIVE" };
    const andConditions: Prisma.DocumentWhereInput[] = [];

    // 1. Apply user security context (Hierarchical Journal Permissions)
    if (restrictedJournalId) {
      const descendantIds = await journalService.getDescendantJournalIds(
        restrictedJournalId
      );
      const allowedJournalIds = [...descendantIds, restrictedJournalId];

      if (filterByJournalIds && filterByJournalIds.length > 0) {
        // User has permissions AND a filter is applied. Find the intersection.
        const effectiveJournalIds = filterByJournalIds.filter((id) =>
          allowedJournalIds.includes(id)
        );
        andConditions.push({ journalId: { in: effectiveJournalIds } });
      } else {
        // No filter applied, just enforce user permissions.
        andConditions.push({ journalId: { in: allowedJournalIds } });
      }
    } else if (filterByJournalIds && filterByJournalIds.length > 0) {
      // Super-admin (no restricted ID) but a filter is applied.
      andConditions.push({ journalId: { in: filterByJournalIds } });
    }

    // 2. Apply Partner filter
    if (filterByPartnerIds && filterByPartnerIds.length > 0) {
      andConditions.push({ partnerId: { in: filterByPartnerIds } });
    }

    // 3. Apply Goods filter (relational)
    if (filterByGoodIds && filterByGoodIds.length > 0) {
      andConditions.push({
        lines: { some: { goodId: { in: filterByGoodIds } } },
      });
    }

    // Combine all conditions
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const totalCount = await prisma.document.count({ where });
    const data = await prisma.document.findMany({
      where,
      take,
      skip,
      orderBy: { date: "desc" },
      include: { partner: true }, // Include partner for display in tables
    });

    serviceLogger.debug(`documentService.getAllDocuments: Output - count: ${data.length}, totalCount: ${totalCount}, where: ${JSON.stringify(where, jsonBigIntReplacer)}`);
    return { data, totalCount };
  },

  /**
   * ✏️ MODIFIED: Fetches a single document, now including full good details per line.
   */
  async getDocumentById(id: bigint): Promise<Document | null> {
    serviceLogger.debug("documentService.getDocumentById: Input", { id });
    return await prisma.document.findUnique({
      where: { id, entityState: "ACTIVE" },
      // ✨ NEW: The include clause is expanded for the "Gateway Lookup" use case.
      include: {
        partner: true,
        lines: {
          include: {
            good: true, // Eagerly load the full Good details for each line.
          },
          orderBy: { id: "asc" },
        },
      },
    });
  },

  // --- Other CRUD functions remain as-is ---

  async updateDocument(id: bigint, data: UpdateDocumentData) {
    serviceLogger.debug(
      "documentService.updateDocument: Input",
      JSON.stringify({ id, ...data }, jsonBigIntReplacer)
    );
    return await prisma.document.update({
      where: { id },
      data,
    });
  },

  async deleteDocument(id: bigint, deletedById: string) {
    serviceLogger.debug(
      "documentService.deleteDocument: Input",
      JSON.stringify({ id, deletedById }, jsonBigIntReplacer)
    );
    return await prisma.document.update({
      where: { id },
      data: {
        entityState: "DELETED",
        deletedAt: new Date(),
        deletedById: deletedById,
      },
    });
  },
};

export default documentService;
