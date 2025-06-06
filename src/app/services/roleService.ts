// src/app/services/roleService.ts
import { PrismaClient, Role } from "@prisma/client";

// Re-using a simplified session user type. Adapt if needed.
interface AuthenticatedUserSession {
  id: string;
  companyId: string;
  // roles and permissions might not be strictly needed for *fetching* company roles,
  // as long as the user is authenticated and belongs to the company.
  // However, if you have specific permissions for "VIEW_ROLES", they could be checked.
  roles?: Array<{
    name: string;
    permissions: Array<{ action: string; resource: string }>;
  }>;
}

// Optional: Helper for permission check if needed for viewing roles
/*
function hasPermission(
  sessionUser: AuthenticatedUserSession,
  action: string,
  resource: string
): boolean {
  if (!sessionUser || !sessionUser.roles) {
    return false;
  }
  return sessionUser.roles.some((role) =>
    role.permissions.some(
      (p) => p.action === action && p.resource === resource
    )
  );
}
*/

export class RoleService {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * Fetches all roles for a given company.
   * The primary authorization is that the requesting user belongs to the company.
   * An additional permission check (e.g., "VIEW_ROLES" or "MANAGE_USERS") can be added if necessary.
   *
   * @param companyId - The ID of the company for which to fetch roles.
   * @param authenticatedUserSession - The session of the authenticated user making the request.
   * @returns A promise that resolves to an array of Role objects.
   * @throws Error if the authenticated user's company does not match the requested companyId
   *         or if other permission checks fail.
   */
  async getCompanyRoles(
    companyId: string,
    authenticatedUserSession: AuthenticatedUserSession
  ): Promise<Role[]> {
    // 1. Authorization: Ensure the requesting user belongs to the company whose roles are being requested.
    // This is a fundamental multi-tenancy check.
    if (authenticatedUserSession.companyId !== companyId) {
      console.warn(
        `User ${authenticatedUserSession.id} from company ${authenticatedUserSession.companyId} ` +
          `attempted to fetch roles for company ${companyId}.`
      );
      throw new Error(
        "Forbidden: You can only fetch roles for your own company."
      );
    }

    // 2. Optional Permission Check (e.g., if viewing roles requires a specific permission)
    // For now, we assume any user in the company who can access user management
    // can also see the list of roles to assign. If you have a "VIEW_ROLES" permission:
    /*
    if (!hasPermission(authenticatedUserSession, "VIEW", "ROLES") && !hasPermission(authenticatedUserSession, "MANAGE", "USERS")) {
      throw new Error("Forbidden: User does not have permission to view roles.");
    }
    */
    // As per the plan, an admin with "MANAGE_USERS" would need this list.
    // This implicitly means they can view roles for assignment.

    try {
      const roles = await this.prisma.role.findMany({
        where: {
          companyId: companyId,
        },
        orderBy: {
          name: "asc", // Optional: order roles by name
        },
        // You might want to include permissions per role if the UI needs to display them,
        // but for just assigning roles, the role ID and name are usually sufficient.
        // include: {
        //   permissions: {
        //     include: {
        //       permission: true
        //     }
        //   }
        // }
      });

      return roles;
    } catch (error: any) {
      console.error(`Error fetching roles for company ${companyId}:`, error);
      throw new Error(error.message || "Failed to fetch company roles.");
    }
  }
}
