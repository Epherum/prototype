// src/app/api/journals/top-level/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession, ExtendedUser } from "@/lib/authOptions";
import { journalService } from "@/app/services/journalService"; // Adjust path
// No need for prisma client here directly, service handles it.

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

interface AuthenticatedUserContextForService {
  companyId: string;
  userId: string;
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

  // Permission Check: User should have "MANAGE_USERS" to see top-level journals for assignment.
  // Or, if you have a general "VIEW_JOURNALS" permission for admins, that could also work.
  if (!hasPermission(session.user as ExtendedUser, "MANAGE", "USERS")) {
    console.warn(
      `User ${session.user.id} without MANAGE_USERS tried to fetch top-level journals.`
    );
    return NextResponse.json(
      {
        message:
          "Forbidden: Insufficient permissions to view top-level journals for assignment",
      },
      { status: 403 }
    );
  }

  const userContext: AuthenticatedUserContextForService = {
    userId: session.user.id,
    companyId: session.user.companyId,
  };

  try {
    // journalService is an object exporting functions, not a class here
    const topLevelJournals = await journalService.getTopLevelJournalsByCompany(
      userContext
    );
    return NextResponse.json(topLevelJournals, { status: 200 });
  } catch (error: any) {
    console.error(
      `API /journals/top-level GET (User: ${userContext.userId}, Company: ${userContext.companyId}) Error:`,
      error.message,
      error.stack
    );
    if (error.message.includes("Forbidden")) {
      // Though service itself doesn't throw this for this call
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { message: error.message || "Failed to fetch top-level journals" },
      { status: 500 }
    );
  }
}
