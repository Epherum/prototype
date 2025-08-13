// src/app/api/roles/route.ts

import { NextRequest, NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
// CORRECT: Import the service object and the schema from the service file
import roleService, { rolePayloadSchema } from "@/app/services/roleService";

// GET all roles
const getHandler = async () => {
  try {
    // CORRECT: Call the method on the imported service object
    const roles = await roleService.getAll();
    return NextResponse.json(roles);
  } catch (error) {
    console.error("API GET /api/roles Error:", error);
    return NextResponse.json(
      { message: "Failed to fetch roles" },
      { status: 500 }
    );
  }
};

// POST to create a new role
const postHandler = async (req: NextRequest) => {
  try {
    const body = await req.json();
    // CORRECT: Use the schema imported from the service
    const validation = rolePayloadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid role data.", errors: validation.error.format() },
        { status: 400 }
      );
    }

    // CORRECT: Call the 'create' method on the service object
    const newRole = await roleService.create(validation.data);
    return NextResponse.json(newRole, { status: 201 });
  } catch (error) {
    console.error("API POST /api/roles Error:", error);
    // You could add more specific error handling here for things like
    // duplicate role names (P2002) if needed.
    return NextResponse.json(
      { message: "Failed to create role" },
      { status: 500 }
    );
  }
};

export const GET = withAuthorization(getHandler, {
  action: "READ",
  resource: "ROLE",
});
export const POST = withAuthorization(postHandler, {
  action: "READ",
  resource: "ROLE",
});
