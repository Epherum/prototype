// File: src/app/services/userService.ts
import { PrismaClient, User, Role, Journal, Prisma } from "@prisma/client"; // Added Prisma for transaction type
import bcrypt from "bcryptjs";
import prismaInstance from "@/app/utils/prisma"; // Assuming your prisma instance is exported like this

// Admin user context from session (can be more aligned with your ExtendedSession if needed)
interface AdminSessionUser {
  id: string;
  companyId: string;
  // The structure should match what your authOptions provide in the session
  roles: Array<{
    name: string; // Role name
    permissions: Array<{ action: string; resource: string }>; // Permission details
  }>;
}

// Helper to check permissions based on the structure in Project Overview (permission string like "MANAGE_USERS")
function hasGlobalPermission(
  sessionUser: AdminSessionUser,
  permissionIdentifier: string // e.g., "MANAGE_USERS"
): boolean {
  if (!sessionUser || !sessionUser.roles) {
    return false;
  }
  // This checks if any of the user's roles have a permission whose concatenated action_resource matches
  return sessionUser.roles.some((role) =>
    role.permissions.some(
      (p) => `${p.action}_${p.resource}` === permissionIdentifier
    )
  );
}

// CORRECTED: Payload for individual role assignments
export interface CreateUserPayloadRoleAssignment {
  roleId: string;
  restrictedTopLevelJournalId?: string | null;
  restrictedTopLevelJournalCompanyId?: string | null; // <-- ADDED THIS FIELD
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

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * Creates a new user, assigns them to roles, and optionally restricts their journal access per role.
   * All operations are performed within the company of the authenticated admin.
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
    // Using MANAGE_USERS as the specific permission string mentioned in the project overview
    if (!hasGlobalPermission(adminSessionUser, "MANAGE_USERS")) {
      console.warn(
        `User ${adminSessionUser.id} attempted to create user without MANAGE_USERS permission.`
      );
      throw new Error("Forbidden: User does not have MANAGE_USERS permission.");
    }

    const { name, email, password, roleAssignments } = payload;
    const adminCompanyId = adminSessionUser.companyId;

    // 2. Input Validation (Basic)
    if (!name || !email || !password) {
      throw new Error("Name, email, and password are required.");
    }
    if (password.length < 6) {
      // Adjusted to common minimum, can be more complex
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
          // 4a. Check if user with this email already exists (email is globally unique as per schema)
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
              companyId: adminCompanyId, // Associate with admin's company
              isActive: true,
            },
          });
          console.log(
            `User ${createdUser.id} created successfully for company ${adminCompanyId}.`
          );

          // 4c. Process Role Assignments
          for (const assignment of roleAssignments) {
            const {
              roleId,
              restrictedTopLevelJournalId,
              restrictedTopLevelJournalCompanyId,
            } = assignment;

            // Validate role exists and belongs to the admin's company
            const role = await tx.role.findFirst({
              where: {
                id: roleId,
                companyId: adminCompanyId,
              },
            });
            if (!role) {
              console.warn(
                `Role with ID ${roleId} not found in company ${adminCompanyId} during user creation.`
              );
              throw new Error(
                `Role with ID ${roleId} not found in your company.`
              );
            }

            let finalRestrictedJournalId: string | null = null;
            let finalRestrictedJournalCompanyId: string | null = null;

            if (
              restrictedTopLevelJournalId &&
              restrictedTopLevelJournalCompanyId
            ) {
              // Validate the journal exists and belongs to the specified company (which should be admin's company)
              if (restrictedTopLevelJournalCompanyId !== adminCompanyId) {
                // This is a critical integrity check. The client should only send journals from admin's company.
                console.error(
                  `Security Alert: Attempt to assign journal restriction from different company. Admin: ${adminCompanyId}, Journal: ${restrictedTopLevelJournalCompanyId}`
                );
                throw new Error(
                  "Invalid journal assignment: Journal does not belong to your company."
                );
              }

              const journalForRestriction = await tx.journal.findUnique({
                where: {
                  id_companyId: {
                    // Prisma schema uses composite key [id, companyId] for Journal
                    id: restrictedTopLevelJournalId,
                    companyId: restrictedTopLevelJournalCompanyId, // Use the companyId from the payload
                  },
                },
              });

              if (!journalForRestriction) {
                console.warn(
                  `Journal with ID ${restrictedTopLevelJournalId} and company ${restrictedTopLevelJournalCompanyId} not found during user creation.`
                );
                throw new Error(
                  `Journal with ID ${restrictedTopLevelJournalId} not found in your company.`
                );
              }
              // REMOVED: The check for journalForRestriction.parentId === null
              // This now allows ANY journal (top-level or child) from the company to be a restriction root.

              finalRestrictedJournalId = journalForRestriction.id;
              finalRestrictedJournalCompanyId = journalForRestriction.companyId; // This will be adminCompanyId
            } else if (
              restrictedTopLevelJournalId ||
              restrictedTopLevelJournalCompanyId
            ) {
              // If one is provided but not the other (except both being null/undefined), it's an inconsistent state.
              console.warn(
                `Inconsistent journal restriction data for role ${roleId}: journalId=${restrictedTopLevelJournalId}, journalCompanyId=${restrictedTopLevelJournalCompanyId}`
              );
              throw new Error("Incomplete journal restriction data provided.");
            }

            // Create UserRole entry
            await tx.userRole.create({
              data: {
                userId: createdUser.id,
                roleId: role.id,
                restrictedTopLevelJournalId: finalRestrictedJournalId,
                restrictedTopLevelJournalCompanyId:
                  finalRestrictedJournalCompanyId,
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
      // Specific Prisma error for unique constraint violation
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
      // Re-throw original error message if it's specific, otherwise a generic one
      throw new Error(
        error.message || "An unexpected error occurred while creating the user."
      );
    }
  }
}
