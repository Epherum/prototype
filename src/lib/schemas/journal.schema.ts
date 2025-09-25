import { z } from "zod";
import { parseBigInt } from "@/app/utils/jsonBigInt";

export const createJournalSchema = z.object({
  id: z.string().min(1, "Code/ID is required"),
  name: z.string().min(1, "Name is required"),
  parentId: z.string().optional().nullable(),
  isTerminal: z.boolean().optional(),
  additionalDetails: z.any().optional(),
  loopIntegration: z.object({
    loopId: z.string().optional(),
    newLoop: z.object({
      name: z.string().min(1, "Loop name is required"),
      description: z.string().optional(),
    }).optional(),
    forwardToJournalId: z.string().optional(),
    backwardFromJournalId: z.string().optional(),
  }).optional().nullable(),
});

export const getJournalsQuerySchema = z.object({
  rootJournalId: z.string().optional(),
  findByPartnerIds: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((id) => parseBigInt(id, "partner ID"))
        .filter((id): id is bigint => id !== null)
    )
    .optional(),
  findByGoodIds: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((id) => parseBigInt(id, "good ID"))
        .filter((id): id is bigint => id !== null)
    )
    .optional(),
  findByDocumentId: z
    .string()
    .transform((val) => parseBigInt(val, "document ID"))
    .optional(),
});

export type CreateJournalPayload = z.infer<typeof createJournalSchema>;
export type GetJournalsQuery = z.infer<typeof getJournalsQuerySchema>;
