import { z } from "zod";
import { JournalLoop, JournalLoopConnection } from "@prisma/client";

export const createLoopSchema = z.object({
  name: z.string().min(1, "Loop name is required"),
  description: z.string().optional(),
  journalIds: z.array(z.string()).min(3, "Loop must contain at least 3 journals"),
});

export const updateLoopSchema = z.object({
  name: z.string().min(1, "Loop name is required").optional(),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).optional(),
  journalIds: z.array(z.string()).min(3, "Loop must contain at least 3 journals").optional(),
});

export const getLoopsQuerySchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).optional(),
  search: z.string().optional(),
});

export type CreateLoopPayload = z.infer<typeof createLoopSchema>;
export type UpdateLoopPayload = z.infer<typeof updateLoopSchema>;
export type GetLoopsQuery = z.infer<typeof getLoopsQuerySchema>;

export type LoopWithConnections = JournalLoop & {
  journalConnections: (JournalLoopConnection & {
    fromJournal: { id: string; name: string };
    toJournal: { id: string; name: string };
  })[];
};