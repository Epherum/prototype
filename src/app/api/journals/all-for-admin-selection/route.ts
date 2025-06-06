// File: src/app/api/journals/all-for-admin-selection/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession } from "@/lib/authOptions"; // Adjust path as needed
import { journalService } from "@/app/services/journalService"; // Adjust path as needed

interface AuthenticatedUserContext {
  companyId: string;
  userId: string;
}

const hasPermission = (
  session: ExtendedSession | null,
  permissionName: string
): boolean => {
  if (!session || !session.user || !session.user.roles) return false;
  const MANAGE_USERS_PERMISSION = "MANAGE_USERS";
  return session.user.roles.some((role) =>
    role.permissions?.some(
      (p) => `${p.action}_${p.resource}` === MANAGE_USERS_PERMISSION
    )
  );
};

// THIS IS THE KEY PART
export async function GET(request: NextRequest) {
  // <--- Ensure this is correct
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  if (!session?.user?.id || !session?.user?.companyId) {
    return NextResponse.json(
      { message: "Unauthorized: Session or user details missing" },
      { status: 401 }
    );
  }

  if (!hasPermission(session, "MANAGE_USERS")) {
    return NextResponse.json(
      { message: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  const userContext: AuthenticatedUserContext = {
    userId: session.user.id,
    companyId: session.user.companyId,
  };

  try {
    console.log(
      `API /journals/all-for-admin-selection GET (User: ${userContext.userId}, Company: ${userContext.companyId})`
    );
    const journals = await journalService.getAllJournalsForAdminSelection(
      userContext
    );
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
