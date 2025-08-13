// src/app/services/userService.ts
import prisma from "@/app/utils/prisma";
import { User } from "@prisma/client";
import bcrypt from "bcryptjs";

// ✅ ADD new imports from the authoritative schema file
import {
  CreateUserPayload,
  UpdateUserPayload,
} from "@/lib/schemas/user.schema";

export interface AdminSessionUser {
  id: string;
}

const userService = {
  /**
   * Creates a new user, hashes their password, and assigns them to roles.
   * @param payload - The user creation data, now matching CreateUserPayload.
   * @param adminSessionUser - The authenticated admin user performing the action.
   */
  async create(
    payload: CreateUserPayload,
    adminSessionUser: AdminSessionUser
  ): Promise<Omit<User, "passwordHash">> {
    // ✨ CORRECTED: Destructure `roleAssignments` instead of `roleIds`.
    const {
      name,
      email,
      password,
      roleAssignments,
      restrictedTopLevelJournalId,
    } = payload;

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.$transaction(async (tx) => {
      // Validate that the restricted journal exists, if provided.
      if (restrictedTopLevelJournalId) {
        const journalExists = await tx.journal.findUnique({
          where: { id: restrictedTopLevelJournalId },
          select: { id: true },
        });
        if (!journalExists) {
          throw new Error(
            `Journal with ID ${restrictedTopLevelJournalId} not found.`
          );
        }
      }

      // Create the User record. Prisma will throw a P2002 error if email is not unique.
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          createdById: adminSessionUser.id,
          restrictedTopLevelJournalId,
        },
      });

      // ✨ CORRECTED: Create UserRole links from the `roleAssignments` array.
      if (roleAssignments?.length > 0) {
        await tx.userRole.createMany({
          data: roleAssignments.map((assignment) => ({
            userId: createdUser.id,
            roleId: assignment.roleId,
          })),
        });
      }

      const { passwordHash: _, ...userWithoutPassword } = createdUser;
      return userWithoutPassword;
    });

    return newUser;
  },

  // Example of an update function following the same pattern
  /**
   * Updates a user's details and synchronizes their roles.
   * @param userId - The ID of the user to update.
   * @param payload - The update data, now matching UpdateUserPayload.
   */
  async update(
    userId: string,
    payload: UpdateUserPayload
  ): Promise<Omit<User, "passwordHash">> {
    // ✨ CORRECTED: Destructure `roleAssignments` instead of `roleIds`.
    const { name, roleAssignments, restrictedTopLevelJournalId } = payload;

    const updatedUser = await prisma.$transaction(async (tx) => {
      // ✨ CORRECTED: Sync roles based on the `roleAssignments` array.
      if (roleAssignments) {
        await tx.userRole.deleteMany({ where: { userId } });
        if (roleAssignments.length > 0) {
          await tx.userRole.createMany({
            data: roleAssignments.map((assignment) => ({
              userId,
              roleId: assignment.roleId,
            })),
          });
        }
      }

      // Update user record. Filter out password if it's an empty string.
      const dataToUpdate: any = {
        name,
        ...(restrictedTopLevelJournalId !== undefined && {
          restrictedTopLevelJournalId,
        }),
      };

      if (payload.password) {
        dataToUpdate.passwordHash = await bcrypt.hash(payload.password, 10);
      }

      const user = await tx.user.update({
        where: { id: userId },
        data: dataToUpdate,
      });

      const { passwordHash: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return updatedUser;
  },
};

export default userService;
