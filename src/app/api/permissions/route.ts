// src/app/api/permissions/route.ts

import { NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
// CORRECT: Import the service object
import roleService from "@/app/services/roleService";
import { apiLogger } from "@/lib/logger";

const getHandler = async () => {
  try {
    // CORRECT: Call the method on the service object
    const permissions = await roleService.getAllPermissions();
    return NextResponse.json(permissions);
  } catch (error) {
    apiLogger.error("API GET /api/permissions Error", { error: error.message, stack: error.stack });
    return NextResponse.json(
      { message: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
};

// CORRECT: Resource should be 'Roles'. A user needs to manage roles to see the permissions.
/**
 * GET /api/permissions
 * Fetches a list of all available permissions in the system.
 * @param {NextRequest} _request - The incoming Next.js request object (unused).
 * @returns {NextResponse} A JSON response containing an array of permission objects.
 * @status 200 - OK: Permissions successfully fetched.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_ROLE - Requires 'READ' action on 'ROLE' resource.
 */
export const GET = withAuthorization(getHandler, {
  action: "MANAGE",
  resource: "ROLE",
});
