// src/app/services/userService.ts
import { PrismaClient, User, Role, Journal } from "@prisma/client";
import bcrypt from "bcryptjs";

// Assuming ExtendedUser is similar to what's in your NextAuth setup
// We'll use a simplified version here for the admin user context
interface AdminSessionUser {
  id: string;
  companyId: string;
  roles: Array<{
    name: string;
    permissions: Array<{ action: string; resource: string }>;
    // restrictedTopLevelJournalId and companyId are not relevant for the admin performing user creation,
    // but for the permissions check.
  }>;
}

// Helper to check permissions
function hasPermission(
  sessionUser: AdminSessionUser,
  action: string,
  resource: string
): boolean {
  if (!sessionUser || !sessionUser.roles) {
    return false;
  }
  return sessionUser.roles.some((role) =>
    role.permissions.some((p) => p.action === action && p.resource === resource)
  );
}

export interface CreateUserPayloadRoleAssignment {
  roleId: string;
  restrictedTopLevelJournalId?: string | null;
}

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
   * @returns The newly created User object.
   * @throws Error if validation fails, permissions are insufficient, or DB operations fail.
   */
  async createUserAndAssignRoles(
    payload: CreateUserPayload,
    adminSessionUser: AdminSessionUser
  ): Promise<Omit<User, "passwordHash">> {
    // 1. Permission Check
    if (
      !hasPermission(adminSessionUser, "CREATE", "USER") &&
      !hasPermission(adminSessionUser, "MANAGE", "USERS")
    ) {
      // Allowing "CREATE_USER" or "MANAGE_USERS" for flexibility.
      // Assuming "MANAGE_USERS" is the permission string from your project description.
      // Let's stick to "MANAGE_USERS" as per the V.I.
      throw new Error("Forbidden: User does not have MANAGE_USERS permission.");
    }

    const { name, email, password, roleAssignments } = payload;
    const adminCompanyId = adminSessionUser.companyId;

    // 2. Input Validation
    if (!name || !email || !password) {
      throw new Error("Name, email, and password are required.");
    }
    if (password.length < 8) {
      // Basic password length check
      throw new Error("Password must be at least 8 characters long.");
    }
    if (!roleAssignments || roleAssignments.length === 0) {
      throw new Error("At least one role assignment is required.");
    }

    // 3. Password Hashing
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Prisma Transaction
    try {
      const newUser = await this.prisma.$transaction(async (tx) => {
        // 4a. Check if user with this email already exists in any company (email is globally unique)
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

        // 4c. Process Role Assignments
        for (const assignment of roleAssignments) {
          const { roleId, restrictedTopLevelJournalId } = assignment;

          // Validate role exists and belongs to the admin's company
          const role = await tx.role.findFirst({
            where: {
              id: roleId,
              companyId: adminCompanyId,
            },
          });
          if (!role) {
            throw new Error(
              `Role with ID ${roleId} not found in company ${adminCompanyId}.`
            );
          }

          let journalForRestriction: Journal | null = null;
          let restrictedJournalCompanyId: string | null = null;

          if (restrictedTopLevelJournalId) {
            // Validate the journal exists, is top-level, and belongs to the admin's company
            journalForRestriction = await tx.journal.findUnique({
              where: {
                id_companyId: {
                  id: restrictedTopLevelJournalId,
                  companyId: adminCompanyId,
                },
                // parentId: null, // Ensuring it's a top-level journal
              },
            });
            if (!journalForRestriction) {
              throw new Error(
                `Top-level journal with ID ${restrictedTopLevelJournalId} not found in company ${adminCompanyId}.`
              );
            }
            if (journalForRestriction.parentId !== null) {
              throw new Error(
                `Journal with ID ${restrictedTopLevelJournalId} is not a top-level journal in company ${adminCompanyId}.`
              );
            }
            restrictedJournalCompanyId = adminCompanyId;
          }

          // Create UserRole entry
          await tx.userRole.create({
            data: {
              userId: createdUser.id,
              roleId: role.id,
              restrictedTopLevelJournalId: journalForRestriction?.id || null, // Prisma schema expects String?
              restrictedTopLevelJournalCompanyId: restrictedJournalCompanyId,
            },
          });
        }
        // Exclude passwordHash from the returned object
        const { passwordHash: _, ...userWithoutPassword } = createdUser;
        return userWithoutPassword;
      });

      return newUser;
    } catch (error: any) {
      if (error.code === "P2002" && error.meta?.target?.includes("email")) {
        // Handle unique constraint violation for email specifically, though checked above.
        // This is a fallback if transaction isolation levels cause race conditions.
        throw new Error(`User with email ${email} already exists.`);
      }
      console.error("Error creating user and assigning roles:", error);
      throw new Error(
        error.message || "Failed to create user and assign roles."
      );
    }
  }
}
