// src/app/api/users/route.ts

import { NextRequest, NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";
import userService from "@/app/services/userService"; // Now expects types from schemas
import { createUserSchema, CreateUserPayload } from "@/lib/schemas/user.schema";
import { isDescendantOf } from "@/app/services/journalService";
import { apiLogger } from "@/lib/logger";

const postHandler = async (
  req: NextRequest,
  _context: object,
  session: ExtendedSession
) => {
  const adminUser = session.user!;
  try {
    const rawPayload = await req.json();
    // ✅ CORRECT: Use the authoritative schema for validation
    const validation = createUserSchema.safeParse(rawPayload);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: JSON.stringify({
            message: "Invalid user creation data",
            errors: validation.error.format(),
          }),
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    // `validation.data` now correctly matches `CreateUserPayload` structure from user.schema.ts
    const newUserData: CreateUserPayload = validation.data;

    // --- SECURITY CHECK FOR SUB-ADMINS (Logic is robust) ---
    const adminRestrictionId = adminUser.restrictedTopLevelJournalId;
    if (adminRestrictionId) {
      const newRestrictionId = newUserData.restrictedTopLevelJournalId;
      // If a restricted admin tries to create an unrestricted user (restrictedTopLevelJournalId is null)
      if (!newRestrictionId) {
        return NextResponse.json(
          { message: "Forbidden: You cannot create an unrestricted user." },
          { status: 403 }
        );
      }
      // Verify the new restriction is within the admin's hierarchy
      const isAllowed = await isDescendantOf(
        newRestrictionId,
        adminRestrictionId
      );
      if (!isAllowed) {
        return NextResponse.json(
          {
            message:
              "Forbidden: You can only assign a journal restriction that is within your own hierarchy.",
          },
          { status: 403 }
        );
      }
    }

    // ✅ CORRECT: Call the service with the correctly validated and typed data
    const newUser = await userService.create(
      newUserData,
      { id: adminUser.id } // The service only needs the admin's ID for createdById
    );

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    apiLogger.error(
      `API /users POST (Admin: ${adminUser.id}) Error:`,
      error.message
    );

    // ✅ CORRECT: Handle specific error codes
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      return NextResponse.json(
        { message: "A user with this email already exists." },
        { status: 409 } // 409 Conflict is appropriate for duplicates
      );
    }
    // Handle specific error from the service for non-existent journal
    if (error.message.includes("Journal with ID")) {
      return NextResponse.json({ message: error.message }, { status: 400 }); // 400 Bad Request
    }

    return NextResponse.json(
      { message: "Failed to create user." },
      { status: 500 }
    );
  }
};

/**
 * POST /api/users
 * Creates a new user.
 * Enforces business rules for journal restriction assignment: a restricted admin can only assign
 * a restricted journal within their own hierarchy.
 * @param {NextRequest} request - The incoming Next.js request object containing the user creation payload.
 * @param {object} _context - The context object (unused).
 * @param {ExtendedSession} session - The authenticated admin user's session.
 * @body {CreateUserPayload} body - The user data to create (name, email, password, roles, restrictedTopLevelJournalId).
 * @returns {NextResponse} A JSON response containing the newly created user.
 * @status 201 - Created: User successfully created.
 * @status 400 - Bad Request: Invalid creation data or non-existent journal ID.
 * @status 403 - Forbidden: Attempt to create an unrestricted user by a restricted admin, or assign restriction outside hierarchy.
 * @status 409 - Conflict: A user with the provided email already exists.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission MANAGE_USER - Requires 'MANAGE' action on 'USER' resource.
 */
export const POST = withAuthorization(postHandler, {
  action: "MANAGE",
  resource: "USER", // Assuming this is the correct resource for user management
});
