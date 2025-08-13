import { z } from "zod";

export const createJournalPartnerLinkSchema = z.object({
  journalId: z.string().min(1, "Journal ID is required"),
  partnerId: z.string().min(1, "Partner ID is required"),
  partnershipType: z.string().optional().nullable(),
  exoneration: z.boolean().optional().nullable(),
  periodType: z.string().optional().nullable(),
  // Client sends ISO strings for dates
  dateDebut: z.string().datetime({ offset: true }).optional().nullable(),
  dateFin: z.string().datetime({ offset: true }).optional().nullable(),
  documentReference: z.string().optional().nullable(),
});

export type CreateJournalPartnerLinkPayload = z.infer<
  typeof createJournalPartnerLinkSchema
>;
