// src/app/api/journals/all-for-admin-selection/route.ts
import { NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { journalService } from "@/app/services/journalService";
import prisma from "@/app/utils/prisma";
import { stringify as jsonBigIntStringify } from "@/app/utils/jsonBigInt";

// This is the core logic of your handler. It no longer needs to worry about auth.
const getHandler = async () => {
  try {
    // Note: The new JournalService from the plan might not have this exact method name.
    // For now, let's assume it exists or create it. A simple fetch is also fine.
    const journals = await journalService.getAllJournalsForAdminSelection();

    const jsonResult = jsonBigIntStringify(journals);
    return new NextResponse(jsonResult, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error(
      `API /journals/all-for-admin-selection GET Error:`,
      e.message
    );
    return NextResponse.json(
      {
        message: "Failed to fetch all journals for admin selection",
        error: e.message,
      },
      { status: 500 }
    );
  }
};

// This is the key change. We wrap the handler with our authorization HOF.
// It will automatically handle 401/403 errors if the user is not logged in
// or doesn't have the 'MANAGE' permission on the 'USERS' resource.
export const GET = withAuthorization(getHandler, {
  action: "MANAGE",
  resource: "USERS",
});
