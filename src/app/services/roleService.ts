// src/app/services/roleService.ts

import prisma from "@/app/utils/prisma";
import { Permission, Role } from "@prisma/client";
import { z } from "zod";
import { roleSchema } from "@/lib/schemas/role.schema"; // Import the schema

export type RoleWithPermissions = Role & {
  permissions: Permission[];
};

// ========================================================================
// The schema is now imported from the central schema file.
// ========================================================================
export const rolePayloadSchema = roleSchema;

// Derive the TypeScript type from the schema.
export type RolePayload = z.infer<typeof rolePayloadSchema>;

const roleService = {
  /**
   * Fetches all roles in the system, including their associated permissions.
   */
  async getAll(): Promise<RoleWithPermissions[]> {
    // ✅ This now correctly references the local type.
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          select: {
            permission: true, // Select the nested permission object
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return roles.map((role) => ({
      ...role,
      permissions: role.permissions.map((p) => p.permission),
    }));
  },

  /**
   * Fetches the master list of all available permissions in the system.
   */
  async getAllPermissions(): Promise<Permission[]> {
    return prisma.permission.findMany({
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });
  },

  /**
   * Creates a new role and connects it to a set of permissions.
   * @param payload - The role data including name, description, and permission IDs.
   */
  async create(payload: RolePayload): Promise<Role> {
    const { name, description, permissionIds } = payload;
    // Note: This assumes permissionIds are validated in the API layer to exist.
    return prisma.role.create({
      data: {
        name,
        description,
        permissions: {
          create: permissionIds.map((pid) => ({
            permissionId: pid,
          })),
        },
      },
    });
  },

  /**
   * Updates an existing role's details and synchronizes its permissions.
   * @param roleId - The ID of the role to update.
   * @param payload - The new role data.
   */
  async update(roleId: string, payload: RolePayload): Promise<Role> {
    const { name, description, permissionIds } = payload;

    // Use a transaction to ensure the update is atomic.
    return prisma.$transaction(async (tx) => {
      // 1. Delete all existing permission links for this role.
      // This "sync" approach is simpler and safer than calculating diffs.
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // 2. Update the role's details and create the new permission links.
      const updatedRole = await tx.role.update({
        where: { id: roleId },
        data: {
          name,
          description,
          permissions: {
            create: permissionIds.map((pid) => ({
              permissionId: pid,
            })),
          },
        },
        include: {
          permissions: { select: { permission: true } },
        },
      });

      // Flatten the result to match the expected return type
      return {
        ...updatedRole,
        permissions: updatedRole.permissions.map((p) => p.permission),
      };
    });
  },

  /**
   * Deletes a role by its ID.
   * Relies on Prisma schema's `onDelete: Cascade` for related UserRole
   * and RolePermission records.
   * @param roleId - The ID of the role to delete.
   * @throws {Prisma.PrismaClientKnownRequestError} with code 'P2025' if role not found.
   */
  async delete(roleId: string): Promise<Role> {
    return prisma.role.delete({
      where: { id: roleId },
    });
  },
};

export default roleService;
