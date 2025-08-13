//src/app/services/service.types.ts
import { PartnerType } from "@prisma/client";
import { z } from "zod";
import { createGoodApiSchema } from "@/app/api/goods/route";

// ===================
// Partner Data Types
// ===================

export const createPartnerSchema = z.object({
  name: z.string().min(1, "Partner name is required").max(255),
  partnerType: z.nativeEnum(PartnerType),
  notes: z.string().optional().nullable(),
  logoUrl: z.string().url("Invalid logo URL format").optional().nullable(),
  photoUrl: z.string().url("Invalid photo URL format").optional().nullable(),
  isUs: z.boolean().optional().nullable(),
  registrationNumber: z.string().max(100).optional().nullable(),
  taxId: z.string().max(100).optional().nullable(),
  bioFatherName: z.string().max(100).optional().nullable(),
  bioMotherName: z.string().max(100).optional().nullable(),
  additionalDetails: z.any().optional().nullable(),
});

export type CreatePartnerData = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerData = Partial<Omit<CreatePartnerData, "partnerType">>;

// ===================
// Goods Data Types
// ===================

export type CreateGoodsData = z.infer<typeof createGoodApiSchema> & {
  createdById: string;
};

export type UpdateGoodsData = Partial<
  Omit<CreateGoodsData, "referenceCode" | "barcode" | "createdById">
>;
