// File: src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession, ExtendedUser } from "@/lib/authOptions";
import { UserService, CreateUserPayload } from "@/app/services/userService";
import prisma from "@/app/utils/prisma";
import { z } from "zod";

// Zod schema for validating the incoming payload for user creation
// CORRECTED: Added restrictedTopLevelJournalCompanyId to roleAssignments
const roleAssignmentApiSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  restrictedTopLevelJournalId: z.string().nullable().optional(),
  restrictedTopLevelJournalCompanyId: z.string().nullable().optional(), // <-- ADDED THIS FIELD
});

const createUserApiPayloadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters long"), // Adjusted to match userService
  roleAssignments: z
    .array(roleAssignmentApiSchema)
    .min(1, "At least one role assignment is required"),
});

// Helper function to check permissions from session (aligns with hasGlobalPermission in userService)
// This checks for a single permission string like "MANAGE_USERS"
function hasApiPermission(
  sessionUser: ExtendedUser,
  permissionIdentifier: string
): boolean {
  if (!sessionUser || !sessionUser.roles) {
    return false;
  }
  return sessionUser.roles.some((role) =>
    role.permissions.some(
      (p) =>
        p.id === permissionIdentifier || // Check by permission ID (if you use unique IDs for permissions)
        (p.action &&
          p.resource &&
          `${p.action.toUpperCase()}_${p.resource.toUpperCase()}` ===
            permissionIdentifier.toUpperCase()) // Check by ACTION_RESOURCE
    )
  );
}

export async function POST(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  if (
    !session?.user?.id ||
    !session?.user?.companyId ||
    !session?.user?.roles // Ensure roles are present for permission check
  ) {
    return NextResponse.json(
      { message: "Unauthorized: Session or user details missing" },
      { status: 401 }
    );
  }

  // Permission Check: Ensure the user has "MANAGE_USERS" permission
  // This should align with how permissions are identified in your system (e.g., a unique string "MANAGE_USERS")
  if (!hasApiPermission(session.user as ExtendedUser, "MANAGE_USERS")) {
    console.warn(
      `User ${session.user.id} without MANAGE_USERS permission tried to create a user.`
    );
    return NextResponse.json(
      { message: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  // Construct adminUserContext to match what UserService expects
  // This mapping is crucial and depends on your ExtendedUser and ExtendedSession structure
  const adminUserContextForService = {
    id: session.user.id,
    companyId: session.user.companyId,
    roles: session.user.roles.map((role) => ({
      // Ensure this structure matches AdminSessionUser in userService
      id: role.id, // Assuming role object in session has 'id'
      name: role.name, // Assuming role object in session has 'name'
      permissions: role.permissions || [], // Assuming permissions is an array on each role object
    })),
  };

  let rawPayload;
  try {
    rawPayload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { message: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const validation = createUserApiPayloadSchema.safeParse(rawPayload);
  if (!validation.success) {
    console.error("--- BACKEND ZOD VALIDATION FAILED ---");
    console.error("Received Payload:", JSON.stringify(rawPayload, null, 2));
    console.error(
      "Zod Errors:",
      JSON.stringify(validation.error.format(), null, 2)
    );
    console.error("--- END BACKEND ZOD VALIDATION ---");
    return NextResponse.json(
      {
        message: "Invalid user creation data",
        errors: validation.error.format(),
      },
      { status: 400 }
    );
  }

  const userService = new UserService(prisma);

  try {
    // Pass validated data (which now includes restrictedTopLevelJournalCompanyId)
    // And the correctly structured admin user context
    const newUser = await userService.createUserAndAssignRoles(
      validation.data as CreateUserPayload, // Type assertion is okay after successful validation
      adminUserContextForService
    );
    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    console.error(
      `API /users POST (Admin: ${adminUserContextForService.id}) Error:`,
      error.message
      // error.stack // Optional: log stack for debugging, but not to client
    );
    if (error.message.startsWith("Forbidden:")) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error.message.includes("already exists")) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    if (
      error.message.includes("not found") ||
      error.message.includes("Invalid journal") ||
      error.message.includes("Incomplete journal")
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 }); // Bad Request for these cases
    }
    return NextResponse.json(
      { message: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
