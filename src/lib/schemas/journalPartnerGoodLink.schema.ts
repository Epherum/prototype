//src/lib/schemas/journalPartnerGoodLink.schema.ts
import { z } from "zod";
import { parseBigInt } from "@/app/utils/jsonBigInt";

// This schema represents the data needed for the orchestration service to create the three-way link.
export const createJournalPartnerGoodLinkSchema = z.object({
  journalId: z.string().min(1, "Journal ID is required"),
  partnerId: z.string().min(1, "Partner ID is required"),
  goodId: z.string().min(1, "Good ID is required"),
  partnershipType: z.string().optional().nullable(),
  descriptiveText: z.string().optional().nullable(),
  contextualTaxCodeId: z.number().int().optional().nullable(),
});

export const getLinksQuerySchema = z.object({
  linkId: z.coerce.bigint().optional(),
  journalPartnerLinkId: z.coerce.bigint().optional(),
  journalId: z.string().optional(),
  partnerId: z
    .string()
    .transform((val) => parseBigInt(val, "partner ID"))
    .optional(),
  goodId: z
    .string()
    .transform((val) => parseBigInt(val, "good ID"))
    .optional(),
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
export type GetLinksQuery = z.infer<typeof getLinksQuerySchema>;
export type DeleteLinksQuery = z.infer<typeof deleteLinksQuerySchema>;
