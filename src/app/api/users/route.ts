// File: src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession, ExtendedUser } from "@/lib/authOptions";
import { UserService, CreateUserPayload } from "@/app/services/userService";
import prisma from "@/app/utils/prisma";
import { z } from "zod";

// Zod schema for validating the incoming payload for user creation
const roleAssignmentApiSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  restrictedTopLevelJournalId: z.string().nullable().optional(),
});

const createUserApiPayloadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  roleAssignments: z
    .array(roleAssignmentApiSchema)
    .min(1, "At least one role assignment is required"),
});

function hasApiPermission(
  sessionUser: ExtendedUser,
  permissionIdentifier: string
): boolean {
  if (!sessionUser?.roles) {
    return false;
  }
  return sessionUser.roles.some((role) =>
    role.permissions.some(
      (p) =>
        `${p.action.toUpperCase()}_${p.resource.toUpperCase()}` ===
        permissionIdentifier.toUpperCase()
    )
  );
}

export async function POST(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  if (!session?.user?.id || !session?.user?.roles) {
    return NextResponse.json(
      { message: "Unauthorized: Session or user details missing" },
      { status: 401 }
    );
  }

  if (!hasApiPermission(session.user as ExtendedUser, "MANAGE_USERS")) {
    console.warn(
      `User ${session.user.id} without MANAGE_USERS permission tried to create a user.`
    );
    return NextResponse.json(
      { message: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  const adminUserContextForService = {
    id: session.user.id,
    roles: session.user.roles.map((role) => ({
      name: role.name,
      permissions: role.permissions || [],
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
    const newUser = await userService.createUserAndAssignRoles(
      validation.data as CreateUserPayload,
      adminUserContextForService
    );
    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    console.error(
      `API /users POST (Admin: ${adminUserContextForService.id}) Error:`,
      error.message
    );
    if (error.message.startsWith("Forbidden:")) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error.message.includes("already exists")) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    if (
      error.message.includes("not found") ||
      error.message.includes("Invalid journal")
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
