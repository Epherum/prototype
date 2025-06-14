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
}

// Helper to check permissions
function hasGlobalPermission(
  sessionUser: AdminSessionUser,
  permissionIdentifier: string // e.g., "MANAGE_USERS"
): boolean {
  if (!sessionUser || !sessionUser.roles) {
    return false;
  }
  return sessionUser.roles.some((role) =>
    role.permissions.some(
      (p) => `${p.action}_${p.resource}` === permissionIdentifier
    )
  );
}

// Payload for individual role assignments
export interface CreateUserPayloadRoleAssignment {
  roleId: string;
  restrictedTopLevelJournalId?: string | null;
}

// Overall payload for user creation
export interface CreateUserPayload {
  name: string;
  email: string;
  password: string; // Plain text password
  roleAssignments: CreateUserPayloadRoleAssignment[];
}

export class UserService {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient = prismaInstance) {
    this.prisma = prismaClient;
  }

  /**
   * Creates a new user, assigns them to roles, and optionally restricts their journal access per role.
   * @param payload - The user creation data.
   * @param adminSessionUser - The authenticated admin user performing the action.
   * @returns The newly created User object (excluding passwordHash).
   * @throws Error if validation fails, permissions are insufficient, or DB operations fail.
   */
  async createUserAndAssignRoles(
    payload: CreateUserPayload,
    adminSessionUser: AdminSessionUser
  ): Promise<Omit<User, "passwordHash">> {
    // 1. Permission Check
    if (!hasGlobalPermission(adminSessionUser, "MANAGE_USERS")) {
      console.warn(
        `User ${adminSessionUser.id} attempted to create user without MANAGE_USERS permission.`
      );
      throw new Error("Forbidden: You do not have permission to manage users.");
    }

    const { name, email, password, roleAssignments } = payload;

    // 2. Input Validation (Basic)
    if (!name || !email || !password) {
      throw new Error("Name, email, and password are required.");
    }
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }
    if (!roleAssignments || roleAssignments.length === 0) {
      throw new Error("At least one role assignment is required.");
    }

    // 3. Password Hashing
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Prisma Transaction
    try {
      const newUser = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // 4a. Check if user with this email already exists (email is globally unique)
          const existingUserByEmail = await tx.user.findUnique({
            where: { email },
          });
          if (existingUserByEmail) {
            throw new Error(`User with email ${email} already exists.`);
          }

          // 4b. Create the User
          const createdUser = await tx.user.create({
            data: {
              name,
              email,
              passwordHash,
              createdById: adminSessionUser.id, // Audit who created this user
            },
          });
          console.log(`User ${createdUser.id} created successfully.`);

          // 4c. Process Role Assignments
          for (const assignment of roleAssignments) {
            const { roleId, restrictedTopLevelJournalId } = assignment;

            // Validate role exists
            const role = await tx.role.findUnique({
              where: { id: roleId },
            });
            if (!role) {
              console.warn(
                `Role with ID ${roleId} not found during user creation.`
              );
              throw new Error(`Role with ID ${roleId} not found.`);
            }

            let finalRestrictedJournalId: string | null = null;

            if (restrictedTopLevelJournalId) {
              // Validate the journal exists
              const journalForRestriction = await tx.journal.findUnique({
                where: { id: restrictedTopLevelJournalId },
              });

              if (!journalForRestriction) {
                console.warn(
                  `Journal with ID ${restrictedTopLevelJournalId} not found during user creation.`
                );
                throw new Error(
                  `Journal with ID ${restrictedTopLevelJournalId} not found.`
                );
              }
              finalRestrictedJournalId = journalForRestriction.id;
            }

            // Create UserRole entry
            await tx.userRole.create({
              data: {
                userId: createdUser.id,
                roleId: role.id,
                restrictedTopLevelJournalId: finalRestrictedJournalId,
              },
            });
            console.log(
              `Assigned role ${role.id} to user ${
                createdUser.id
              } with journal restriction ID: ${
                finalRestrictedJournalId || "None"
              }.`
            );
          }
          // Exclude passwordHash from the returned object
          const { passwordHash: _, ...userWithoutPassword } = createdUser;
          return userWithoutPassword;
        }
      );

      return newUser;
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = error.meta?.target as string[] | undefined;
        if (target && target.includes("email")) {
          console.warn(`Attempt to create user with existing email: ${email}`);
          throw new Error(`User with email ${email} already exists.`);
        }
      }
      console.error("Error in createUserAndAssignRoles transaction:", error);
      throw new Error(
        error.message || "An unexpected error occurred while creating the user."
      );
    }
  }
}
