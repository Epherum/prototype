//src/lib/types/service.types.ts
import { PartnerType } from "@prisma/client";
import { z } from "zod";
import { createGoodSchema } from "@/lib/schemas/good.schema";
import { createPartnerSchema } from "@/lib/schemas/partner.schema";

// ===================
// Partner Data Types
// ===================

export type CreatePartnerData = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerData = Partial<Omit<CreatePartnerData, "partnerType">>;

// ===================
// Goods Data Types
// ===================

export type CreateGoodsData = z.infer<typeof createGoodSchema> & {
  createdById: string;
};

export type UpdateGoodsData = Partial<
  Omit<CreateGoodsData, "referenceCode" | "barcode" | "createdById" | "journalId">
>;