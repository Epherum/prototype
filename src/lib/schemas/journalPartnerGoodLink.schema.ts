//src/lib/schemas/journalPartnerGoodLink.schema.ts
import { z } from "zod";

// This schema represents the data needed for the orchestration service to create the three-way link.
export const createJournalPartnerGoodLinkSchema = z.object({
  journalId: z.string().min(1, "Journal ID is required"),
  partnerId: z.string().min(1, "Partner ID is required"),
  goodId: z.string().min(1, "Good ID is required"),
  partnershipType: z.string().optional().nullable(),
  descriptiveText: z.string().optional().nullable(),
  contextualTaxCodeId: z.number().int().optional().nullable(),
});

export type CreateJournalPartnerGoodLinkPayload = z.infer<
  typeof createJournalPartnerGoodLinkSchema
>;
