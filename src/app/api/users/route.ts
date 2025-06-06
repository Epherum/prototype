// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession, ExtendedUser } from "@/lib/authOptions"; // Adjust path as needed
import { UserService, CreateUserPayload } from "@/app/services/userService"; // Adjust path to your userService
import prisma from "@/app/utils/prisma"; // Your Prisma client instance
import { z } from "zod";

// Zod schema for validating the incoming payload for user creation
const createUserPayloadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  roleAssignments: z
    .array(
      z.object({
        roleId: z.string().min(1, "Role ID is required"),
        restrictedTopLevelJournalId: z.string().nullable().optional(),
      })
    )
    .min(1, "At least one role assignment is required"),
});

// Helper function to check permissions from session
// (This could be a shared utility)
function hasPermission(
  sessionUser: ExtendedUser, // Using ExtendedUser from your NextAuth types
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

export async function POST(request: NextRequest) {
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

  // Permission Check: Ensure the user has "MANAGE_USERS" permission
  // Based on "Next Objective": "only users with "MANAGE_USERS" permission can access it"
  // Assuming "MANAGE_USERS" is action: "MANAGE", resource: "USERS"
  if (!hasPermission(session.user as ExtendedUser, "MANAGE", "USERS")) {
    console.warn(
      `User ${session.user.id} without MANAGE_USERS tried to create a user.`
    );
    return NextResponse.json(
      { message: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  const adminUserContext = {
    // The admin performing the action
    id: session.user.id,
    companyId: session.user.companyId,
    roles: session.user.roles, // Pass full roles for permission check within service if needed
  };

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { message: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const validation = createUserPayloadSchema.safeParse(payload);
  if (!validation.success) {
    // START OF ADDED LOGGING
    console.error("--- BACKEND ZOD VALIDATION FAILED ---");
    console.error("Received Payload:", JSON.stringify(payload, null, 2));
    console.error(
      "Zod Errors:",
      JSON.stringify(validation.error.format(), null, 2)
    );
    console.error("--- END BACKEND ZOD VALIDATION ---");
    // END OF ADDED LOGGING
    return NextResponse.json(
      {
        message: "Invalid user creation data",
        errors: validation.error.format(),
      },
      { status: 400 }
    );
  }

  const userService = new UserService(prisma); // Initialize service with Prisma instance

  try {
    const newUser = await userService.createUserAndAssignRoles(
      validation.data as CreateUserPayload,
      adminUserContext // Pass the admin's session user context
    );
    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    console.error(
      `API /users POST (Admin: ${adminUserContext.id}) Error:`,
      error.message,
      error.stack
    );
    // Customize error messages/status codes based on service exceptions
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (
      error.message.includes("already exists") ||
      error.message.includes("not found")
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 }); // Conflict or Not Found (for roles/journals)
    }
    return NextResponse.json(
      { message: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
