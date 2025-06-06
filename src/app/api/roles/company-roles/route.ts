// src/app/api/roles/company-roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession, ExtendedUser } from "@/lib/authOptions";
import { RoleService } from "@/app/services/roleService"; // Adjust path
import prisma from "@/app/utils/prisma";

// Re-using permission check helper
function hasPermission(
  sessionUser: ExtendedUser,
  action: string,
  resource: string
): boolean {
  if (!sessionUser || !sessionUser.roles) {
    return false;
  }
  return sessionUser.roles.some((role) =>
    role.permissions.some(
      (p) =>
        p.action.toUpperCase() === action.toUpperCase() &&
        p.resource.toUpperCase() === resource.toUpperCase()
    )
  );
}

export async function GET(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  if (
    !session?.user?.id ||
    !session?.user?.companyId ||
    !session?.user?.roles
  ) {
    return NextResponse.json(
      { message: "Unauthorized: Session or user details missing" },
      { status: 401 }
    );
  }

  // Permission Check: User should have "MANAGE_USERS" to see roles for assignment.
  // Or, if you have a "VIEW_ROLES" permission, you could check for that too.
  if (!hasPermission(session.user as ExtendedUser, "MANAGE", "USERS")) {
    console.warn(
      `User ${session.user.id} without MANAGE_USERS tried to fetch company roles.`
    );
    // If you allow users with other permissions (e.g., "VIEW_ROLES") to access this, adjust the check.
    // For now, aligning with the "MANAGE_USERS" context for creating users.
    return NextResponse.json(
      { message: "Forbidden: Insufficient permissions to view company roles" },
      { status: 403 }
    );
  }

  const authenticatedUserSessionForService = {
    // Data needed by RoleService
    id: session.user.id,
    companyId: session.user.companyId,
    // roles: session.user.roles, // Pass if RoleService's getCompanyRoles needs it for further checks
  };

  const roleService = new RoleService(prisma);

  try {
    const roles = await roleService.getCompanyRoles(
      session.user.companyId, // Fetch roles for the admin's own company
      authenticatedUserSessionForService
    );
    return NextResponse.json(roles, { status: 200 });
  } catch (error: any) {
    console.error(
      `API /roles/company-roles GET (User: ${session.user.id}, Company: ${session.user.companyId}) Error:`,
      error.message,
      error.stack
    );
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { message: error.message || "Failed to fetch company roles" },
      { status: 500 }
    );
  }
}
