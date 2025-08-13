// src/app/api/permissions/route.ts

import { NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
// CORRECT: Import the service object
import roleService from "@/app/services/roleService";

const getHandler = async () => {
  try {
    // CORRECT: Call the method on the service object
    const permissions = await roleService.getAllPermissions();
    return NextResponse.json(permissions);
  } catch (error) {
    console.error("API GET /api/permissions Error:", error);
    return NextResponse.json(
      { message: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
};

// CORRECT: Resource should be 'Roles'. A user needs to manage roles to see the permissions.
export const GET = withAuthorization(getHandler, {
  action: "READ",
  resource: "ROLE",
});
