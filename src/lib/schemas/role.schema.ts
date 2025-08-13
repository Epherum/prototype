//src/lib/schemas/role.schema.ts
import { z } from "zod";

// This schema defines the data needed to create or update a role.
// It's what a client-side form would produce.
export const roleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters long"),
  description: z.string().optional(),
  // The client will send an array of permission IDs (which are strings)
  permissionIds: z.array(z.string()),
});

// We can infer the TypeScript types directly from the schema.
export type CreateRolePayload = z.infer<typeof roleSchema>;
export type UpdateRolePayload = z.infer<typeof roleSchema>;
