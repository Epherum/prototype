// src/app/services/userService.ts
import { PrismaClient, User, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import prismaInstance from "@/app/utils/prisma";

// Admin user context from session
interface AdminSessionUser {
  id: string;
  roles: Array<{
    name: string;
    permissions: Array<{ action: string; resource: string }>;
  }>;
  // The admin's own restriction for security checks (handled in API layer per spec)
  restrictedTopLevelJournalId: string | null;
}

// REFACTORED: Role assignment is just the ID
export interface CreateUserPayloadRoleAssignment {
  roleId: string;
}

// REFACTORED: Overall payload is flatter
export interface CreateUserPayload {
  name: string;
  email: string;
  password: string; // Plain text password
  roleAssignments: CreateUserPayloadRoleAssignment[];
  restrictedTopLevelJournalId: string | null;
}

export class UserService {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient = prismaInstance) {
    this.prisma = prismaClient;
  }

  /**
   * REFACTORED: Creates a new user with a single, optional journal restriction and assigns them to roles.
   * @param payload - The user creation data.
   * @param adminSessionUser - The authenticated admin user performing the action.
   * @returns The newly created User object (excluding passwordHash).
   * @throws Error if validation fails, permissions are insufficient, or DB operations fail.
   */
  async createUserAndAssignRoles(
    payload: CreateUserPayload,
    adminSessionUser: AdminSessionUser
  ): Promise<Omit<User, "passwordHash">> {
    const {
      name,
      email,
      password,
      roleAssignments,
      restrictedTopLevelJournalId,
    } = payload;

    // Basic Input Validation
    if (!name || !email || !password) {
      throw new Error("Name, email, and password are required.");
    }
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }
    if (!roleAssignments || roleAssignments.length === 0) {
      throw new Error("At least one role assignment is required.");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const newUser = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Check for existing user
          const existingUser = await tx.user.findUnique({ where: { email } });
          if (existingUser) {
            throw new Error(`User with email ${email} already exists.`);
          }

          // Validate journal if a restriction is provided
          if (restrictedTopLevelJournalId) {
            const journalExists = await tx.journal.findUnique({
              where: { id: restrictedTopLevelJournalId },
            });
            if (!journalExists) {
              throw new Error(
                `Journal with ID ${restrictedTopLevelJournalId} not found.`
              );
            }
          }

          // Create the User with the top-level restriction
          const createdUser = await tx.user.create({
            data: {
              name,
              email,
              passwordHash,
              createdById: adminSessionUser.id,
              restrictedTopLevelJournalId: restrictedTopLevelJournalId,
            },
          });

          // Create the UserRole links
          const userRoleData = roleAssignments.map((assignment) => ({
            userId: createdUser.id,
            roleId: assignment.roleId,
          }));

          await tx.userRole.createMany({
            data: userRoleData,
          });

          const { passwordHash: _, ...userWithoutPassword } = createdUser;
          return userWithoutPassword;
        }
      );

      return newUser;
    } catch (error: any) {
      console.error("Error in createUserAndAssignRoles transaction:", error);
      // Re-throw specific, client-friendly errors
      if (error.message.includes("already exists")) {
        throw new Error(`User with email ${email} already exists.`);
      }
      throw new Error(
        error.message || "An unexpected error occurred while creating the user."
      );
    }
  }
}
