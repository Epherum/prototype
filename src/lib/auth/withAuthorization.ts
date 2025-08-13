import { type NextRequest, type NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import {
  authOptions,
  ExtendedSession,
  ExtendedUser,
} from "@/lib/auth/authOptions";
// Step 1: Import the new, strong Permission type from our single source of truth.
import { type Permission } from "@/lib/auth/permissions";

type ApiHandler = (
  req: NextRequest,
  context: { params: any },
  session: ExtendedSession
) => Promise<NextResponse> | NextResponse;

// The `normalizeResource` function is no longer needed and has been removed.
// Our type system now enforces correctness at the source, making manual normalization obsolete.

/**
 * Checks if a user possesses a specific, strongly-typed permission.
 *
 * @param user The extended user object from the session.
 * @param requiredPermission The permission object to check for. This is now strongly typed.
 * @returns `true` if the user has the permission, `false` otherwise.
 */
function checkUserPermission(
  user: ExtendedUser,
  requiredPermission: Permission // Step 2: Use the strong type here.
): boolean {
  if (!user?.roles) {
    console.error(
      "[Authorization] User object is missing the 'roles' property."
    );
    return false;
  }

  // The logic is now simpler and more robust. We don't need to normalize anything.
  // We compare the exact strings, which TypeScript has already validated.
  const requiredAction = requiredPermission.action;
  const requiredResource = requiredPermission.resource;

  return user.roles.some((role) =>
    role.permissions.some((p) => {
      // Direct, case-sensitive comparison is now safe and correct.
      return p.action === requiredAction && p.resource === requiredResource;
    })
  );
}

/**
 * A Higher-Order Function to wrap API route handlers with type-safe authorization checks.
 *
 * @param handler The original API route handler.
 * @param requiredPermission The strongly-typed permission required to access this handler.
 * @returns A new handler that performs checks before executing the original handler.
 */
export function withAuthorization(
  handler: ApiHandler,
  requiredPermission: Permission // Step 3: And use the strong type here.
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
        `FORBIDDEN: User ${session.user.id} attempted action [${requiredPermission.action}] on resource [${requiredPermission.resource}] without permission.`
      );
      return new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    return handler(req, context, session);
  };
}
