// src/app/services/roleService.ts

import prisma from "@/app/utils/prisma";
import { Role } from "@prisma/client";
import { RoleWithPermissions } from "@/lib/types"; // We'll re-use the type from our plan

/**
 * Fetches all roles for a specific company, including the permissions for each role.
 * Authorization (i.e., checking if the user *can* perform this action) should be handled
 * by the caller (e.g., the API route handler).
 *
 * @param companyId - The ID of the company.
 * @returns A promise that resolves to an array of roles, each with its permissions included.
 */
export const getRolesForCompany = async (
  companyId: string
): Promise<RoleWithPermissions[]> => {
  if (!companyId) {
    // This is a service-level guard, not an auth check.
    throw new Error("Company ID is required to fetch roles.");
  }

  try {
    const roles = await prisma.role.findMany({
      where: {
        companyId: companyId,
      },
      // IMPORTANT: We include the permissions so the frontend can display what each role does.
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

    // We can cast here because the include guarantees the shape matches RoleWithPermissions
    return roles as RoleWithPermissions[];
  } catch (error) {
    console.error(`Error fetching roles for company ${companyId}:`, error);
    // Re-throw a generic error to be handled by the API layer
    throw new Error("An error occurred while fetching roles.");
  }
};

// // We will add more functions here later, like createUserWithRoles, updateUserRoles etc.
// /**
//  * Fetches the master list of all available permissions in the system.
//  */
// export const getAllPermissions = async (): Promise<Permission[]> => {
//   return prisma.permission.findMany({
//     orderBy: { resource: "asc", action: "asc" },
//   });
// };

// interface RolePayload {
//   name: string;
//   description?: string;
//   permissionIds: string[];
// }

// /**
//  * Creates a new role for a company and connects it to a set of permissions.
//  * @param companyId The company to create the role for.
//  * @param payload The role data.
//  * @returns The newly created role.
//  */
// export const createRole = async (
//   companyId: string,
//   payload: RolePayload
// ): Promise<Role> => {
//   const { name, description, permissionIds } = payload;

//   return prisma.role.create({
//     data: {
//       name,
//       description: description || "",
//       companyId,
//       permissions: {
//         create: permissionIds.map((pid) => ({
//           permission: {
//             connect: { id: pid },
//           },
//         })),
//       },
//     },
//   });
// };

// /**
//  * Updates an existing role's name, description, and its set of permissions.
//  * @param roleId The ID of the role to update.
//  * @param payload The new role data.
//  * @returns The updated role.
//  */
// export const updateRole = async (
//   roleId: string,
//   payload: RolePayload
// ): Promise<Role> => {
//   const { name, description, permissionIds } = payload;

//   // This is a transactional operation:
//   // 1. Update the role's basic details (name, description).
//   // 2. Delete all existing permission links for this role.
//   // 3. Create new permission links based on the provided permissionIds.
//   return prisma.$transaction(async (tx) => {
//     // Step 1 & 2
//     await tx.rolePermission.deleteMany({
//       where: { roleId: roleId },
//     });

//     // Step 3
//     const updatedRole = await tx.role.update({
//       where: { id: roleId },
//       data: {
//         name,
//         description,
//         permissions: {
//           create: permissionIds.map((pid) => ({
//             permission: {
//               connect: { id: pid },
//             },
//           })),
//         },
//       },
//     });

//     return updatedRole;
//   });
// };
