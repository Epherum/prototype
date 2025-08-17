// src/lib/schemas/partner.schema.ts
import { z } from "zod";
import { parseBigInt } from "@/app/utils/jsonBigInt";

export const createPartnerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  partnerType: z.enum(["LEGAL_ENTITY", "NATURAL_PERSON"]),
  notes: z.string().optional().nullable(),
  logoUrl: z.string().url("Must be a valid URL").optional().nullable(),
  photoUrl: z.string().url("Must be a valid URL").optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  bioFatherName: z.string().optional().nullable(),
  bioMotherName: z.string().optional().nullable(),
  // Assuming additionalDetails can be any JSON structure
  additionalDetails: z.any().optional(),
  // ✨ NEW: Required journal selection for partner creation
  journalId: z.string().min(1, "Journal selection is required"),
  // Add approvalStatus to create schema as well for consistent typing
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

// The update schema allows partial updates and includes approval status
export const updatePartnerSchema = createPartnerSchema.partial().extend({
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export const getPartnersQuerySchema = z.object({
  take: z.coerce.number().int().positive().optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  filterMode: z.enum(["affected", "unaffected", "inProcess"]).optional(),
  permissionRootId: z.string().optional(),
  selectedJournalIds: z
    .string()
    .transform((val) => val.split(","))
    .optional(),
  intersectionOfGoodIds: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((id) => parseBigInt(id, "good ID"))
        .filter((id): id is bigint => id !== null)
    )
    .optional(),
  findByDocumentId: z
    .string()
    .transform((val) => parseBigInt(val, "document ID"))
    .optional(),
});

// We export the inferred TypeScript types for use in our components and services
export type CreatePartnerPayload = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerPayload = z.infer<typeof updatePartnerSchema>;
export type GetPartnersQuery = z.infer<typeof getPartnersQuerySchema>;
