import { z } from "zod";

export const createJournalSchema = z.object({
  id: z.string().min(1, "Code/ID is required"),
  name: z.string().min(1, "Name is required"),
  parentId: z.string().optional().nullable(),
  isTerminal: z.boolean().optional(),
  additionalDetails: z.any().optional(),
});

export type CreateJournalPayload = z.infer<typeof createJournalSchema>;
