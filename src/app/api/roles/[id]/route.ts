// src/app/api/roles/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
// CORRECT: Import the service object and the schema from the service file
import roleService, { rolePayloadSchema } from "@/app/services/roleService";

// PUT to update a role
const putHandler = async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const body = await req.json();
    const validation = rolePayloadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid role data.", errors: validation.error.format() },
        { status: 400 }
      );
    }

    // CORRECT: Call the 'update' method on the service object
    const updated = await roleService.update(params.id, validation.data);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error(`API PUT /api/roles/${params.id} Error:`, error);
    // CORRECT: Use specific Prisma error code for robust 'not found' check
    if (error.code === "P2025") {
      return NextResponse.json(
        { message: `Role with ID '${params.id}' not found.` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: "Failed to update role" },
      { status: 500 }
    );
  }
};

// DELETE a role
const deleteHandler = async (
  _req: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    // CORRECT: Call the 'delete' method on the service object
    await roleService.delete(params.id);
    return new NextResponse(null, { status: 204 }); // 204 No Content is correct
  } catch (error: any) {
    console.error(`API DELETE /api/roles/${params.id} Error:`, error);
    // CORRECT: Use specific Prisma error code
    if (error.code === "P2025") {
      return NextResponse.json(
        { message: `Role with ID '${params.id}' not found.` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: "Failed to delete role" },
      { status: 500 }
    );
  }
};

// CORRECT: The resource should be 'Roles', not 'USERS'
export const PUT = withAuthorization(putHandler, {
  action: "READ",
  resource: "ROLE",
});
export const DELETE = withAuthorization(deleteHandler, {
  action: "READ",
  resource: "ROLE",
});
