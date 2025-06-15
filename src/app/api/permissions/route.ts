// src/app/api/permissions/route.ts

import { NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { getAllPermissions } from "@/app/services/roleService";

const getHandler = async () => {
  try {
    const permissions = await getAllPermissions();
    return NextResponse.json(permissions);
  } catch (error) {
    console.error("API Error fetching all permissions:", error);
    return NextResponse.json(
      { message: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
};

// Only users who can manage other users should be able to see the available permissions.
export const GET = withAuthorization(getHandler, {
  action: "MANAGE",
  resource: "USERS",
});
