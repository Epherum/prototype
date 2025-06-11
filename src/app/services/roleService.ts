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
 * Fetches all roles for a specific company, including the permissions for each role.
 * Authorization should be handled by the caller.
 *
 * @param companyId - The ID of the company.
 * @returns A promise that resolves to an array of roles, each with its permissions included.
 */
export const getRolesForCompany = async (
  companyId: string
): Promise<RoleWithPermissions[]> => {
  if (!companyId) {
    throw new Error("Company ID is required to fetch roles.");
  }

  try {
    const roles = await prisma.role.findMany({
      where: {
        companyId: companyId,
      },
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
    console.error(`Error fetching roles for company ${companyId}:`, error);
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
 * Creates a new role for a company and connects it to a set of permissions.
 * @param companyId The company to create the role for.
 * @param payload The role data.
 * @returns The newly created role.
 */
export const createRole = async (
  companyId: string,
  payload: RolePayload
): Promise<Role> => {
  const { name, description, permissionIds } = payload;

  return prisma.role.create({
    data: {
      name,
      description: description || undefined,
      company: {
        connect: { id: companyId },
      },
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
 * Enforces that the role belongs to the specified company.
 * @param roleId The ID of the role to update.
 * @param companyId The ID of the company that owns the role.
 * @param payload The new role data.
 * @returns The updated role.
 */
export const updateRole = async (
  roleId: string,
  companyId: string,
  payload: RolePayload
): Promise<Role> => {
  const { name, description, permissionIds } = payload;

  // First, verify the role exists and belongs to the correct company
  const role = await prisma.role.findFirst({
    where: {
      id: roleId,
      companyId: companyId,
    },
  });

  if (!role) {
    throw new Error("Role not found or you do not have permission to edit it.");
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
 * Deletes a role from a company.
 * Enforces that the role belongs to the specified company.
 * Prisma's `onDelete: Cascade` on UserRole and RolePermission handles cleanup.
 * @param roleId The ID of the role to delete.
 * @param companyId The ID of the company that owns the role.
 */
export const deleteRole = async (
  roleId: string,
  companyId: string
): Promise<void> => {
  // Use `deleteMany` to safely delete only if the companyId matches.
  // This prevents accidentally deleting if the roleId is found but companyId doesn't match.
  const deleteResult = await prisma.role.deleteMany({
    where: {
      id: roleId,
      companyId: companyId,
    },
  });

  if (deleteResult.count === 0) {
    // This means the role either didn't exist or didn't belong to the user's company.
    // We throw an error so the API can return a 404 or 403.
    throw new Error(
      "Role not found or you do not have permission to delete it."
    );
  }
};
