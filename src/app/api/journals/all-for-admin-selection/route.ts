// File: src/app/api/journals/all-for-admin-selection/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession, ExtendedUser } from "@/lib/authOptions";
import { journalService } from "@/app/services/journalService";

interface AuthenticatedUserContext {
  userId: string;
}

const hasPermission = (
  user: ExtendedUser | undefined,
  permissionAction: string,
  permissionResource: string
): boolean => {
  if (!user?.roles) return false;
  return user.roles.some((role) =>
    role.permissions?.some(
      (p) => p.action === permissionAction && p.resource === permissionResource
    )
  );
};

export async function GET(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Check for permission to manage users
  if (!hasPermission(session.user as ExtendedUser, "MANAGE", "USERS")) {
    return NextResponse.json(
      { message: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  const userContext: AuthenticatedUserContext = {
    userId: session.user.id,
  };

  try {
    console.log(
      `API /journals/all-for-admin-selection GET (User: ${userContext.userId})`
    );

    // The service no longer needs the context as it fetches all journals.
    const journals = await journalService.getAllJournalsForAdminSelection();

    return NextResponse.json(journals);
  } catch (error) {
    const e = error as Error;
    console.error(
      `API /journals/all-for-admin-selection GET Error:`,
      e.message,
      e.stack
    );
    return NextResponse.json(
      {
        message: "Failed to fetch all journals for admin selection",
        error: e.message,
      },
      { status: 500 }
    );
  }
}
