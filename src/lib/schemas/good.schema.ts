//src/lib/schemas/good.schema.ts
import { z } from "zod";

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
});

export const updateGoodSchema = createGoodSchema.partial().omit({
  // Per old types, these are not updatable
  referenceCode: true,
  barcode: true,
});

export type CreateGoodPayload = z.infer<typeof createGoodSchema>;
export type UpdateGoodPayload = z.infer<typeof updateGoodSchema>;
