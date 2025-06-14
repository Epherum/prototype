// src/app/services/roleService.ts

import prisma from "@/app/utils/prisma";
import { Permission, Role } from "@prisma/client";
import { RoleWithPermissions } from "@/lib/types";

// Define a reusable type for create/update payloads
export interface RolePayload {
  name: string;
  description?: string;
  permissionIds: string[];
}

/**
 * Fetches all roles in the system, including the permissions for each role.
 *
 * @returns A promise that resolves to an array of roles, each with its permissions included.
 */
export const getAllRoles = async (): Promise<RoleWithPermissions[]> => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return roles as RoleWithPermissions[];
  } catch (error) {
    console.error(`Error fetching roles:`, error);
    throw new Error("An error occurred while fetching roles.");
  }
};

/**
 * Fetches the master list of all available permissions in the system.
 * @returns A promise that resolves to an array of all Permission records.
 */
export const getAllPermissions = async (): Promise<Permission[]> => {
  try {
    return await prisma.permission.findMany({
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });
  } catch (error) {
    console.error(`Error fetching all permissions:`, error);
    throw new Error("An error occurred while fetching permissions.");
  }
};

/**
 * Creates a new role and connects it to a set of permissions.
 * @param payload The role data.
 * @returns The newly created role.
 */
export const createRole = async (payload: RolePayload): Promise<Role> => {
  const { name, description, permissionIds } = payload;

  return prisma.role.create({
    data: {
      name,
      description: description || undefined,
      permissions: {
        create: permissionIds.map((pid) => ({
          permission: {
            connect: { id: pid },
          },
        })),
      },
    },
  });
};

/**
 * Updates an existing role's name, description, and its set of permissions.
 * @param roleId The ID of the role to update.
 * @param payload The new role data.
 * @returns The updated role.
 */
export const updateRole = async (
  roleId: string,
  payload: RolePayload
): Promise<Role> => {
  const { name, description, permissionIds } = payload;

  // First, verify the role exists.
  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw new Error("Role not found.");
  }

  // Use a transaction to ensure atomicity
  return prisma.$transaction(async (tx) => {
    // 1. Delete all existing permission links for this role.
    await tx.rolePermission.deleteMany({
      where: { roleId: roleId },
    });

    // 2. Update the role's details and create the new permission links.
    const updatedRole = await tx.role.update({
      where: { id: roleId },
      data: {
        name,
        description,
        permissions: {
          create: permissionIds.map((pid) => ({
            permission: {
              connect: { id: pid },
            },
          })),
        },
      },
      // Include permissions in the return object for consistency
      include: {
        permissions: { include: { permission: true } },
      },
    });

    return updatedRole;
  });
};

/**
 * Deletes a role.
 * Prisma's `onDelete: Cascade` on UserRole and RolePermission handles cleanup.
 * @param roleId The ID of the role to delete.
 */
export const deleteRole = async (roleId: string): Promise<void> => {
  try {
    await prisma.role.delete({
      where: { id: roleId },
    });
  } catch (error) {
    // Handle cases where the role doesn't exist (e.g., Prisma's P2025 error)
    console.error(`Failed to delete role with ID ${roleId}:`, error);
    throw new Error("Role not found or could not be deleted.");
  }
};
