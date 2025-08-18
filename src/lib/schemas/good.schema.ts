//src/lib/schemas/good.schema.ts
import { z } from "zod";
import { parseBigInt } from "@/app/utils/jsonBigInt";

export const createGoodSchema = z.object({
  label: z.string().min(1, "Label is required"),
  referenceCode: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  taxCodeId: z.number().int().optional().nullable(),
  typeCode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unitCodeId: z.number().int().optional().nullable(),
  stockTrackingMethod: z.string().optional().nullable(),
  packagingTypeCode: z.string().optional().nullable(),
  photoUrl: z.string().url("Must be a valid URL").optional().nullable(),
  additionalDetails: z.any().optional(),
  price: z.number().optional().nullable(),
  // ✨ NEW: Required journal selection for good creation
  journalId: z.string().min(1, "Journal selection is required"),
  // Status ID for flexible status management
  statusId: z.string().optional(),
});

export const updateGoodSchema = createGoodSchema.partial().omit({
  // Per old types, these are not updatable
  referenceCode: true,
  barcode: true,
  journalId: true, // Journal assignment cannot be changed after creation
});

export const getGoodsQuerySchema = z.object({
  take: z.coerce.number().int().positive().optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  filterMode: z.enum(["affected", "unaffected", "inProcess"]).optional(),
  activeFilterModes: z
    .string()
    .transform((val) => val.split(","))
    .pipe(z.array(z.enum(["affected", "unaffected", "inProcess"])))
    .optional(),
  permissionRootId: z.string().optional(),
  selectedJournalIds: z
    .string()
    .transform((val) => val.split(","))
    .optional(),
  intersectionOfPartnerIds: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((id) => parseBigInt(id, "partner ID"))
        .filter((id): id is bigint => id !== null)
    )
    .optional(),
  // New parameters for three-way lookup (single partner + journals)
  partnerId: z
    .string()
    .transform((val) => parseBigInt(val, "partner ID"))
    .optional(),
  journalIds: z
    .string()
    .transform((val) => val.split(","))
    .optional(),
  findByDocumentId: z
    .string()
    .transform((val) => parseBigInt(val, "document ID"))
    .optional(),
});

export type CreateGoodPayload = z.infer<typeof createGoodSchema>;
export type UpdateGoodPayload = z.infer<typeof updateGoodSchema>;
export type GetGoodsQuery = z.infer<typeof getGoodsQuerySchema>;
