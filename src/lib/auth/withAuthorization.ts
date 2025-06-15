// src/lib/auth/withAuthorization.ts
import { type NextRequest, type NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession, ExtendedUser } from "@/lib/authOptions";

type PermissionObject = {
  action: string;
  resource: string;
};

type ApiHandler = (
  req: NextRequest,
  context: { params: any },
  session: ExtendedSession
) => Promise<NextResponse> | NextResponse;

/**
 * Checks if a user possesses a specific permission.
 * @param user The extended user object from the session.
 * @param requiredPermission The permission object to check for.
 * @returns `true` if the user has the permission, `false` otherwise.
 */
function checkUserPermission(
  user: ExtendedUser,
  requiredPermission: PermissionObject
): boolean {
  if (!user?.roles) {
    return false;
  }
  // Check if any of the user's roles contain the required permission.
  return user.roles.some((role) =>
    role.permissions.some(
      (p) =>
        p.action.toUpperCase() === requiredPermission.action.toUpperCase() &&
        p.resource.toUpperCase() === requiredPermission.resource.toUpperCase()
    )
  );
}

/**
 * A Higher-Order Function to wrap API route handlers with authorization checks.
 *
 * @param handler The original API route handler.
 * @param requiredPermission The permission required to access this handler.
 * @returns A new handler that performs checks before executing the original handler.
 */
export function withAuthorization(
  handler: ApiHandler,
  requiredPermission: PermissionObject
) {
  return async function (req: NextRequest, context: { params: any }) {
    const session = (await getServerSession(
      authOptions
    )) as ExtendedSession | null;

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userHasPermission = checkUserPermission(
      session.user as ExtendedUser,
      requiredPermission
    );

    if (!userHasPermission) {
      console.warn(
        `FORBIDDEN: User ${
          session.user.id
        } attempted action [${requiredPermission.action.toUpperCase()}] on resource [${requiredPermission.resource.toUpperCase()}] without permission.`
      );
      return new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If authorized, pass control to the original handler, including the session.
    return handler(req, context, session);
  };
}
