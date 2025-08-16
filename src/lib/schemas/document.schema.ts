//src/lib/schemas/document.schema.ts
import { z } from "zod";
import { parseBigInt } from "@/app/utils/jsonBigInt";

// Schema for a single line in a document
export const documentLineSchema = z.object({
  journalPartnerGoodLinkId: z.string(), // This is the unique link ID
  designation: z.string().min(1, "Designation is required"),
  quantity: z.number().min(0, "Quantity must be positive"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  taxRate: z.number().min(0).max(1), // Assuming tax rate is a decimal e.g., 0.20 for 20%
});

export const createDocumentSchema = z.object({
  refDoc: z.string().optional().nullable(),
  type: z.enum(["INVOICE", "QUOTE", "PURCHASE_ORDER", "CREDIT_NOTE"]),
  date: z.date(),
  partnerId: z.string(), // This will be the string version of the bigint on the client
  lines: z
    .array(documentLineSchema)
    .min(1, "Document must have at least one line"),
});

export const updateDocumentSchema = z.object({
  refDoc: z.string().optional(),
  date: z.string().or(z.date()).optional(),
  description: z.string().optional().nullable(),
  paymentMode: z.string().optional().nullable(),
});

export const getDocumentsQuerySchema = z.object({
  take: z.coerce.number().int().positive().optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  filterByJournalIds: z
    .string()
    .transform((val) => val.split(","))
    .optional(),
  filterByPartnerIds: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((id) => parseBigInt(id, "partner ID"))
        .filter((id): id is bigint => id !== null)
    )
    .optional(),
  filterByGoodIds: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((id) => parseBigInt(id, "good ID"))
        .filter((id): id is bigint => id !== null)
    )
    .optional(),
});

// API-specific schema that extends the base schema with required journalId
export const apiCreateDocumentSchema = createDocumentSchema.extend({
  journalId: z.string().min(1, "Journal ID is required for creation."),
});

export type CreateDocumentPayload = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentPayload = z.infer<typeof updateDocumentSchema>;
export type DocumentLinePayload = z.infer<typeof documentLineSchema>;
export type GetDocumentsQuery = z.infer<typeof getDocumentsQuerySchema>;
export type ApiCreateDocumentPayload = z.infer<typeof apiCreateDocumentSchema>;
