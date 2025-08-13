// src/lib/schemas/partner.schema.ts
import { z } from "zod";

export const createPartnerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  partnerType: z.enum(["LEGAL_ENTITY", "NATURAL_PERSON"]),
  notes: z.string().optional().nullable(),
  logoUrl: z.string().url("Must be a valid URL").optional().nullable(),
  photoUrl: z.string().url("Must be a valid URL").optional().nullable(),
  isUs: z.boolean().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  bioFatherName: z.string().optional().nullable(),
  bioMotherName: z.string().optional().nullable(),
  // Assuming additionalDetails can be any JSON structure
  additionalDetails: z.any().optional(),
});

// The update schema allows partial updates
export const updatePartnerSchema = createPartnerSchema.partial();

// We export the inferred TypeScript types for use in our components and services
export type CreatePartnerPayload = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerPayload = z.infer<typeof updatePartnerSchema>;
