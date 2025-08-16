// src/app/api/roles/route.ts

import { NextRequest, NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
// CORRECT: Import the service object and the schema from the service file
import roleService, { rolePayloadSchema } from "@/app/services/roleService";
import { apiLogger } from "@/lib/logger";

// GET all roles
const getHandler = async () => {
  try {
    // CORRECT: Call the method on the imported service object
    const roles = await roleService.getAll();
    return NextResponse.json(roles);
  } catch (error) {
    apiLogger.error("API GET /api/roles Error", { error: error.message, stack: error.stack });
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
    apiLogger.error("API POST /api/roles Error", { error: error.message, stack: error.stack });
    // You could add more specific error handling here for things like
    // duplicate role names (P2002) if needed.
    return NextResponse.json(
      { message: "Failed to create role" },
      { status: 500 }
    );
  }
};

/**
 * GET /api/roles
 * Fetches a list of all roles in the system, including their associated permissions.
 * @param {NextRequest} _request - The incoming Next.js request object (unused).
 * @returns {NextResponse} A JSON response containing an array of role objects.
 * @status 200 - OK: Roles successfully fetched.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_ROLE - Requires 'READ' action on 'ROLE' resource.
 */
export const GET = withAuthorization(getHandler, {
  action: "MANAGE",
  resource: "ROLE",
});

/**
 * POST /api/roles
 * Creates a new role.
 * @param {NextRequest} request - The incoming Next.js request object containing the role creation payload.
 * @body {RolePayload} - The role data to create (name, description, permissionIds).
 * @returns {NextResponse} A JSON response containing the newly created role.
 * @status 201 - Created: Role successfully created.
 * @status 400 - Bad Request: Invalid role data.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission MANAGE_ROLE - Requires 'MANAGE' action on 'ROLE' resource.
 */
export const POST = withAuthorization(postHandler, {
  action: "MANAGE",
  resource: "ROLE",
});
