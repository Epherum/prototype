// src/app/api/roles/company-roles/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession } from "@/lib/authOptions";
import { getRolesForCompany } from "@/app/services/roleService";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;
  const user = session?.user;

  if (!user?.id || !user?.companyId) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  // 1. Authorization: Check if the user has permission to manage other users.
  // Viewing roles is a prerequisite for assigning them, so it's tied to MANAGE_USERS.
  if (!hasPermission(user, "MANAGE", "USERS")) {
    return NextResponse.json(
      { message: "Forbidden: You do not have permission to manage users." },
      { status: 403 }
    );
  }

  try {
    // 2. Business Logic: Call the simplified service function.
    // The service no longer needs the session, just the companyId.
    const roles = await getRolesForCompany(user.companyId);
    return NextResponse.json(roles);
  } catch (error: any) {
    console.error(`API Error in GET /api/roles/company-roles:`, error);
    return NextResponse.json(
      { message: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
