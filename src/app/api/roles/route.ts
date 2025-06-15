// src/app/api/roles/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import {
  getAllRoles,
  createRole,
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

// GET all roles
const getHandler = async () => {
  try {
    const roles = await getAllRoles();
    return NextResponse.json(roles);
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch roles" },
      { status: 500 }
    );
  }
};

// POST to create a new role
const postHandler = async (req: NextRequest) => {
  const body = await req.json();
  const validation = rolePayloadSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { errors: validation.error.format() },
      { status: 400 }
    );
  }

  try {
    const newRole = await createRole(validation.data);
    return NextResponse.json(newRole, { status: 201 });
  } catch (error) {
    console.error("API Error creating role:", error);
    return NextResponse.json(
      { message: "Failed to create role" },
      { status: 500 }
    );
  }
};

export const GET = withAuthorization(getHandler, {
  action: "MANAGE",
  resource: "USERS",
});
export const POST = withAuthorization(postHandler, {
  action: "MANAGE",
  resource: "USERS",
});
