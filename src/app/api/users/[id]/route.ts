// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/utils/prisma";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { isDescendantOf } from "@/app/services/journalService"; // <-- IMPORT HELPER

const getHandler = async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const { id } = params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const { passwordHash, ...userWithoutPassword } = user;
  return NextResponse.json(userWithoutPassword);
};

// REFACTORED: Zod schema for updating a user with the flat structure
const updateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional().or(z.literal("")),
  roleAssignments: z.array(z.object({ roleId: z.string().min(1) })).min(1),
  restrictedTopLevelJournalId: z.string().nullable().optional().default(null),
});

const putHandler = async (
  req: NextRequest,
  { params }: { params: { id: string } },
  session: ExtendedSession
) => {
  const { id: userIdToUpdate } = params;
  const adminUser = session.user!;

  const body = await req.json();
  const validation = updateUserSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { errors: validation.error.format() },
      { status: 400 }
    );
  }

  const {
    name,
    email,
    password,
    roleAssignments,
    restrictedTopLevelJournalId,
  } = validation.data;

  // --- REFINED SECURITY CHECK FOR SUB-ADMINS ---
  const adminRestrictionId = adminUser.restrictedTopLevelJournalId;
  if (adminRestrictionId) {
    // A restricted admin CANNOT make a user unrestricted.
    if (!restrictedTopLevelJournalId) {
      return NextResponse.json(
        {
          message:
            "Forbidden: You cannot set a user's restriction to 'No Restriction'.",
        },
        { status: 403 }
      );
    }

    // The user's new restriction must be within the admin's hierarchy.
    const isAllowed = await isDescendantOf(
      restrictedTopLevelJournalId,
      adminRestrictionId
    );
    if (!isAllowed) {
      return NextResponse.json(
        {
          message:
            "Forbidden: You can only set a journal restriction that is within your own hierarchy.",
        },
        { status: 403 }
      );
    }
  }

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      // ... (transaction logic remains the same)
      const userUpdateData: any = { name, email, restrictedTopLevelJournalId };
      if (password) {
        userUpdateData.passwordHash = await bcrypt.hash(password, 10);
      }
      const user = await tx.user.update({
        where: { id: userIdToUpdate },
        data: userUpdateData,
      });
      await tx.userRole.deleteMany({ where: { userId: userIdToUpdate } });
      await tx.userRole.createMany({
        data: roleAssignments.map((assignment) => ({
          userId: userIdToUpdate,
          roleId: assignment.roleId,
        })),
      });
      return user;
    });

    const { passwordHash, ...userWithoutPassword } = updatedUser;
    return NextResponse.json(userWithoutPassword);
  } catch (error: any) {
    // ... (error handling remains the same)
    console.error(`Error updating user ${userIdToUpdate}:`, error);
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      return NextResponse.json(
        { message: "A user with this email already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Failed to update user." },
      { status: 500 }
    );
  }
};

export const GET = withAuthorization(getHandler, {
  action: "MANAGE",
  resource: "USERS",
});
export const PUT = withAuthorization(putHandler, {
  action: "MANAGE",
  resource: "USERS",
});
