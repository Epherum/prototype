// src/app/api/users/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/utils/prisma";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";
import { updateUserSchema, UpdateUserPayload } from "@/lib/schemas/user.schema";
import userService from "@/app/services/userService";
import { isDescendantOf } from "@/app/services/journalService";
import { apiLogger } from "@/lib/logger";

const getHandler = async (
  _req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    // Include userRoles and the nested role for the client to display
    include: { userRoles: { include: { role: true } } },
  });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  // Always exclude password hash for security
  const { passwordHash, ...userWithoutPassword } = user;
  return NextResponse.json(userWithoutPassword);
};

const putHandler = async (
  req: NextRequest,
  { params }: { params: { id: string } },
  session: ExtendedSession
) => {
  const { id: userIdToUpdate } = params;
  const adminUser = session.user!;

  try {
    const rawBody = await req.json();
    // ✅ CORRECT: Use the authoritative schema for validation
    const validation = updateUserSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid update data.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    // Optional: Add a check if the payload is empty after validation.
    // If updateUserSchema allows all fields to be optional, `validation.data`
    // could be an empty object `{}`. If an empty update is not desired:
    if (Object.keys(validation.data).length === 0) {
      return NextResponse.json(
        {
          message:
            "Update body cannot be empty. No fields provided for update.",
        },
        { status: 400 }
      );
    }

    // `validation.data` now correctly matches `UpdateUserPayload` structure from user.schema.ts
    const updateData: UpdateUserPayload = validation.data;

    // --- REFINED SECURITY CHECK FOR SUB-ADMINS (Logic is robust) ---
    const adminRestrictionId = adminUser.restrictedTopLevelJournalId;
    // This check is only needed if the payload is trying to change the restriction
    if (
      adminRestrictionId &&
      updateData.restrictedTopLevelJournalId !== undefined // Check if the property is present in the payload
    ) {
      const newRestrictionId = updateData.restrictedTopLevelJournalId;
      // If a restricted admin tries to make a user unrestricted (setting to null)
      if (!newRestrictionId) {
        return NextResponse.json(
          { message: "Forbidden: You cannot make a user unrestricted." },
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
              "Forbidden: You can only set a journal restriction within your own hierarchy.",
          },
          { status: 403 }
        );
      }
    }

    // ✅ CORRECT: The handler is now a thin wrapper around the service call.
    // All business logic (transactions, password hashing, role synchronization) is in the service.
    const updatedUser = await userService.update(userIdToUpdate, updateData);

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    apiLogger.error(
      `API /users/${userIdToUpdate} PUT (Admin: ${adminUser.id}) Error:`,
      error.message
    );

    // ✅ CORRECT: Catch specific Prisma error codes
    if (error.code === "P2025") {
      // Record not found
      return NextResponse.json(
        { message: `User with ID '${userIdToUpdate}' not found.` },
        { status: 404 }
      );
    }
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      // Unique constraint violation
      return NextResponse.json(
        { message: "A user with this email already exists." },
        { status: 409 }
      );
    }
    if (error.message.includes("Journal with ID")) {
      // Error from service about non-existent journal
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Failed to update user." },
      { status: 500 }
    );
  }
};

/**
 * GET /api/users/[id]
 * Fetches a single user by their ID, excluding sensitive information like password hash.
 * Includes user roles.
 * @param {NextRequest} _request - The incoming Next.js request object.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the user to fetch.
 * @returns {NextResponse} A JSON response containing the user data (without password hash) or an error message.
 * @status 200 - OK: User found and returned.
 * @status 404 - Not Found: User with the specified ID does not exist.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission MANAGE_USER - Requires 'MANAGE' action on 'USER' resource.
 */
export const GET = withAuthorization(getHandler, {
  action: "MANAGE",
  resource: "USER",
});

/**
 * PUT /api/users/[id]
 * Updates an existing user's details and roles by their ID.
 * Enforces business rules for journal restriction assignment: a restricted admin can only assign
 * a restricted journal within their own hierarchy.
 * @param {NextRequest} request - The incoming Next.js request object containing the update payload.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the user to update.
 * @param {ExtendedSession} session - The authenticated admin user's session.
 * @body {UpdateUserPayload} body - The user data to update (name, email, password, roles, restrictedTopLevelJournalId).
 * @returns {NextResponse} A JSON response containing the updated user data.
 * @status 200 - OK: User successfully updated.
 * @status 400 - Bad Request: Invalid update data, empty body, or non-existent journal ID.
 * @status 403 - Forbidden: Attempt to make user unrestricted by a restricted admin, or assign restriction outside hierarchy.
 * @status 404 - Not Found: User with the specified ID does not exist.
 * @status 409 - Conflict: Email already exists.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission MANAGE_USER - Requires 'MANAGE' action on 'USER' resource.
 */
export const PUT = withAuthorization(putHandler, {
  action: "MANAGE",
  resource: "USER",
});
