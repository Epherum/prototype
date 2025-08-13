//src/lib/schemas/user.schema.ts
import { z } from "zod";

// A sub-schema for a single role assignment within the user payload.
const roleAssignmentSchema = z.object({
  roleId: z.string(),
  // A role can be global (journalId is null) or restricted to a journal.
  journalId: z.string().nullable(),
});

// Schema for creating a new user. Password is required.
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleAssignments: z.array(roleAssignmentSchema),
  restrictedTopLevelJournalId: z.string().nullable().optional(),
});

// Schema for updating an existing user. Password is optional.
export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  // Allow an empty string, which will be filtered out on the server,
  // or a valid password.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .or(z.literal(""))
    .optional(),
  roleAssignments: z.array(roleAssignmentSchema),
  restrictedTopLevelJournalId: z.string().nullable().optional(),
});

export type CreateUserPayload = z.infer<typeof createUserSchema>;
export type UpdateUserPayload = z.infer<typeof updateUserSchema>;
