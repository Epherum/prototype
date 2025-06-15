// src/app/api/roles/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import {
  updateRole,
  deleteRole,
  RolePayload,
} from "@/app/services/roleService";

const rolePayloadSchema = z
  .object({
    name: z.string().min(2, "Role name must be at least 2 characters long"),
    description: z.string().optional(),
    permissionIds: z
      .array(z.string())
      .min(1, "A role must have at least one permission"),
  })
  .refine(
    (data): data is RolePayload => {
      return typeof data.name === "string" && Array.isArray(data.permissionIds);
    },
    {
      message: "Name and permissionIds are required fields",
    }
  );

// PUT to update a role
const putHandler = async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const body = await req.json();
  const validation = rolePayloadSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { errors: validation.error.format() },
      { status: 400 }
    );
  }

  try {
    const updated = await updateRole(params.id, validation.data as RolePayload);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error(`API Error updating role ${params.id}:`, error);
    if (error.message.includes("not found")) {
      return NextResponse.json({ message: "Role not found" }, { status: 404 });
    }
    return NextResponse.json(
      { message: "Failed to update role" },
      { status: 500 }
    );
  }
};

// DELETE a role
const deleteHandler = async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    await deleteRole(params.id);
    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error: any) {
    console.error(`API Error deleting role ${params.id}:`, error);
    if (error.message.includes("not found")) {
      return NextResponse.json({ message: "Role not found" }, { status: 404 });
    }
    return NextResponse.json(
      { message: "Failed to delete role" },
      { status: 500 }
    );
  }
};

export const PUT = withAuthorization(putHandler, {
  action: "MANAGE",
  resource: "USERS",
});
export const DELETE = withAuthorization(deleteHandler, {
  action: "MANAGE",
  resource: "USERS",
});
