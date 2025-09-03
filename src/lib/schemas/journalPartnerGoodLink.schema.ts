//src/lib/schemas/journalPartnerGoodLink.schema.ts
import { z } from "zod";
import { parseBigInt } from "@/app/utils/jsonBigInt";

// This schema represents the data needed for the orchestration service to create the three-way link.
export const createJournalPartnerGoodLinkSchema = z.object({
  journalId: z.string().min(1, "Journal ID is required"),
  partnerId: z.union([z.string(), z.bigint()]).transform((val) => {
    if (typeof val === 'bigint') {
      return val;
    }
    try {
      return BigInt(val);
    } catch {
      throw new Error(`Invalid partner ID: ${val}`);
    }
  }),
  goodId: z.union([z.string(), z.bigint()]).transform((val) => {
    if (typeof val === 'bigint') {
      return val;
    }
    try {
      return BigInt(val);
    } catch {
      throw new Error(`Invalid good ID: ${val}`);
    }
  }),
  partnershipType: z.string().optional().nullable(),
  descriptiveText: z.string().optional().nullable(),
  contextualTaxCodeId: z.number().int().optional().nullable(),
});

export const getLinksQuerySchema = z.object({
  linkId: z.coerce.bigint().optional(),
  journalPartnerLinkId: z.coerce.bigint().optional(),
  journalId: z.string().optional(),
  journalIds: z.string().optional().transform(val => val ? val.split(',') : undefined),
  partnerId: z
    .string()
    .transform((val) => parseBigInt(val, "partner ID"))
    .optional(),
  goodId: z
    .string()
    .transform((val) => parseBigInt(val, "good ID"))
    .optional(),
  expandRelations: z.string().optional().transform(val => val === 'true'),
});

export const deleteLinksQuerySchema = z.object({
  linkId: z.coerce.bigint().optional(),
  journalPartnerLinkId: z.coerce.bigint().optional(),
  journalId: z.string().optional(),
  goodId: z
    .string()
    .transform((val) => parseBigInt(val, "good ID"))
    .optional(),
});

export type CreateJournalPartnerGoodLinkPayload = z.infer<
  typeof createJournalPartnerGoodLinkSchema
>;

// Pre-transformation input type for components (accepts strings before schema transformation)
export type CreateJournalPartnerGoodLinkInput = {
  journalId: string;
  partnerId: string;
  goodId: string;
  partnershipType?: string | null;
  descriptiveText?: string | null;
  contextualTaxCodeId?: number | null;
};

export type GetLinksQuery = z.infer<typeof getLinksQuerySchema>;
export type DeleteLinksQuery = z.infer<typeof deleteLinksQuerySchema>;
