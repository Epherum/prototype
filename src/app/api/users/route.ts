// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";
import { UserService, CreateUserPayload } from "@/app/services/userService";
import { isDescendantOf } from "@/app/services/journalService"; // <-- IMPORT HELPER
import prisma from "@/app/utils/prisma";
import { z } from "zod";

const createUserApiPayloadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  roleAssignments: z
    .array(z.object({ roleId: z.string().min(1) }))
    .min(1, "At least one role assignment is required"),
  restrictedTopLevelJournalId: z.string().nullable(),
});

const postHandler = async (
  req: NextRequest,
  context: object,
  session: ExtendedSession
) => {
  const adminUser = session.user!;
  let rawPayload;
  try {
    rawPayload = await req.json();
  } catch (error) {
    return NextResponse.json(
      { message: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const validation = createUserApiPayloadSchema.safeParse(rawPayload);
  if (!validation.success) {
    return NextResponse.json(
      {
        message: "Invalid user creation data",
        errors: validation.error.format(),
      },
      { status: 400 }
    );
  }
  const newUserData = validation.data as CreateUserPayload;

  // --- REFINED SECURITY CHECK FOR SUB-ADMINS ---
  const adminRestrictionId = adminUser.restrictedTopLevelJournalId;
  if (adminRestrictionId) {
    const newRestrictionId = newUserData.restrictedTopLevelJournalId;

    // A restricted admin CANNOT create an unrestricted user.
    if (!newRestrictionId) {
      return NextResponse.json(
        {
          message: "Forbidden: You cannot create a user with 'No Restriction'.",
        },
        { status: 403 }
      );
    }

    // The new user's restriction must be a descendant of the admin's own restriction.
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

  const userService = new UserService(prisma);
  const adminContextForService = {
    id: adminUser.id,
    roles: adminUser.roles,
    restrictedTopLevelJournalId: adminUser.restrictedTopLevelJournalId,
  };

  try {
    const newUser = await userService.createUserAndAssignRoles(
      newUserData,
      adminContextForService
    );
    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    console.error(
      `API /users POST (Admin: ${adminUser.id}) Error:`,
      error.message
    );
    if (error.message.includes("already exists")) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { message: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
};

export const POST = withAuthorization(postHandler, {
  action: "MANAGE",
  resource: "USERS",
});
