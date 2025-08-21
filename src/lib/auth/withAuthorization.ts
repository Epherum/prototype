import { type NextRequest, type NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import {
  authOptions,
  ExtendedSession,
  ExtendedUser,
} from "@/lib/auth/authOptions";
// Step 1: Import the new, strong Permission type from our single source of truth.
import { type Permission } from "@/lib/auth/permissions";
import prisma from "@/app/utils/prisma";

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
    console.log("=== AUTHORIZATION CHECK START ===");
    console.log("Required permission:", requiredPermission);
    
    const session = (await getServerSession(
      authOptions
    )) as ExtendedSession | null;

    console.log("Session exists:", !!session);
    console.log("User ID:", session?.user?.id);

    if (!session?.user?.id) {
      console.log("UNAUTHORIZED: No session or user ID");
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if the user still exists and is active in the database
    try {
      const userExists = await prisma.user.findUnique({
        where: { 
          id: session.user.id,
          entityState: "ACTIVE"
        },
        select: { id: true }
      });

      if (!userExists) {
        console.log(`UNAUTHORIZED: User ${session.user.id} no longer exists in database`);
        return new Response(JSON.stringify({ message: "Unauthorized - User no longer exists" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (error) {
      console.error("Error checking user existence:", error);
      return new Response(JSON.stringify({ message: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("User roles:", session.user.roles?.map(r => r.name));
    console.log("User permissions:", session.user.roles?.flatMap(r => 
      r.permissions.map(p => `${p.action}_${p.resource}`)
    ));

    const userHasPermission = checkUserPermission(
      session.user as ExtendedUser,
      requiredPermission
    );

    console.log("Permission check result:", userHasPermission);

    if (!userHasPermission) {
      console.warn(
        `FORBIDDEN: User ${session.user.id} attempted action [${requiredPermission.action}] on resource [${requiredPermission.resource}] without permission.`
      );
      console.log("=== AUTHORIZATION CHECK END (FORBIDDEN) ===");
      return new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("=== AUTHORIZATION CHECK END (AUTHORIZED) ===");
    return handler(req, context, session);
  };
}
