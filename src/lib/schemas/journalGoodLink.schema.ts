//src/lib/schemas/journalGoodLink.schema.ts
import { z } from "zod";
import { parseBigInt } from "@/app/utils/jsonBigInt";

export const createJournalGoodLinkSchema = z.object({
  journalId: z.string().min(1, "Journal ID is required"),
  goodId: z.string().min(1, "Good ID is required"),
});

export const getLinksQuerySchema = z.object({
  linkId: z.coerce.bigint().optional(),
  journalId: z.string().optional(),
  goodId: z
    .string()
    .transform((val) => parseBigInt(val, "good ID"))
    .optional(),
});

export const deleteLinksQuerySchema = z.object({
  linkId: z.coerce.bigint().optional(),
  journalId: z.string().optional(),
  goodId: z
    .string()
    .transform((val) => parseBigInt(val, "good ID"))
    .optional(),
});

export type CreateJournalGoodLinkPayload = z.infer<
  typeof createJournalGoodLinkSchema
>;
export type GetLinksQuery = z.infer<typeof getLinksQuerySchema>;
export type DeleteLinksQuery = z.infer<typeof deleteLinksQuerySchema>;
