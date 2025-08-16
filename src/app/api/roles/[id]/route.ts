// src/app/api/roles/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
// CORRECT: Import the service object and the schema from the service file
import roleService, { rolePayloadSchema } from "@/app/services/roleService";
import { apiLogger } from "@/lib/logger";

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
    apiLogger.error(`API PUT /api/roles/${params.id} Error:`, error);
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
    apiLogger.error(`API DELETE /api/roles/${params.id} Error:`, error);
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
/**
 * PUT /api/roles/[id]
 * Updates an existing role by its ID.
 * @param {NextRequest} request - The incoming Next.js request object containing the update payload.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the role to update.
 * @body {RolePayload} - The role data to update (name, description, permissionIds).
 * @returns {NextResponse} A JSON response containing the updated role data or an error message.
 * @status 200 - OK: Role successfully updated.
 * @status 400 - Bad Request: Invalid role data.
 * @status 404 - Not Found: Role with the specified ID does not exist.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_ROLE - Requires 'READ' action on 'ROLE' resource.
 */
export const PUT = withAuthorization(putHandler, {
  action: "MANAGE",
  resource: "ROLE",
});

/**
 * DELETE /api/roles/[id]
 * Deletes a role by its ID.
 * @param {NextRequest} _request - The incoming Next.js request object.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the role to delete.
 * @returns {NextResponse} A 204 No Content response on successful deletion, or an error message.
 * @status 204 - No Content: Role successfully deleted.
 * @status 404 - Not Found: Role with the specified ID does not exist for deletion.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_ROLE - Requires 'READ' action on 'ROLE' resource.
 */
export const DELETE = withAuthorization(deleteHandler, {
  action: "MANAGE",
  resource: "ROLE",
});
