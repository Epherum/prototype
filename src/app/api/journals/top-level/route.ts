// src/app/api/journals/top-level/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import {
  authOptions,
  ExtendedSession,
  ExtendedUser,
} from "@/lib/auth/authOptions";
import { journalService } from "@/app/services/journalService";

function hasPermission(
  user: ExtendedUser,
  action: string,
  resource: string
): boolean {
  if (!user?.roles) {
    return false;
  }
  return user.roles.some((role) =>
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

  if (!session?.user?.id || !session?.user?.roles) {
    return NextResponse.json(
      { message: "Unauthorized: Session or user details missing" },
      { status: 401 }
    );
  }

  // This permission check is a good practice for admin-only endpoints.
  if (!hasPermission(session.user as ExtendedUser, "MANAGE", "USERS")) {
    console.warn(
      `User ${session.user.id} without MANAGE_USERS tried to fetch top-level journals.`
    );
    return NextResponse.json(
      { message: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    // REFACTOR: The service call is now simplified and takes no arguments.
    const topLevelJournals = await journalService.getTopLevelJournals();
    return NextResponse.json(topLevelJournals, { status: 200 });
  } catch (error: any) {
    // REFACTOR: Simplified logging
    console.error(
      `API /journals/top-level GET Error:`,
      error.message,
      error.stack
    );
    return NextResponse.json(
      { message: error.message || "Failed to fetch top-level journals" },
      { status: 500 }
    );
  }
}
