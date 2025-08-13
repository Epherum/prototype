//src/lib/schemas/journalGoodLink.schema.ts
import { z } from "zod";

export const createJournalGoodLinkSchema = z.object({
  journalId: z.string().min(1, "Journal ID is required"),
  goodId: z.string().min(1, "Good ID is required"),
});

export type CreateJournalGoodLinkPayload = z.infer<
  typeof createJournalGoodLinkSchema
>;
