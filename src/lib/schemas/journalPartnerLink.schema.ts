import { z } from "zod";
import { parseBigInt } from "@/app/utils/jsonBigInt";

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

export const getLinksQuerySchema = z.object({
  linkId: z.coerce.bigint().optional(),
  journalId: z.string().optional(),
  partnerId: z
    .string()
    .transform((val) => parseBigInt(val, "partner ID"))
    .optional(),
});

export const deleteLinksQuerySchema = z.object({
  linkId: z.coerce.bigint().optional(),
  journalId: z.string().optional(),
  partnerId: z
    .string()
    .transform((val) => parseBigInt(val, "partner ID"))
    .optional(),
  partnershipType: z.string().optional(),
});

export type CreateJournalPartnerLinkPayload = z.infer<
  typeof createJournalPartnerLinkSchema
>;
export type GetLinksQuery = z.infer<typeof getLinksQuerySchema>;
export type DeleteLinksQuery = z.infer<typeof deleteLinksQuerySchema>;
