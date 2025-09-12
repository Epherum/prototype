// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, {
  User as NextAuthUser,
  Session,
} from "next-auth";
import { JWT } from "next-auth/jwt";
import { authOptions } from "@/lib/auth/authOptions";

// REFACTORED: Role definition is simpler
type Role = {
  name: string;
  permissions: Array<{ action: string; resource: string }>;
};

// REFACTORED: User has a top-level restriction
interface ExtendedUser extends NextAuthUser {
  id: string;
  roles: Role[];
  restrictedTopLevelJournalId: string | null;
}

interface ExtendedSession extends Session {
  user: ExtendedUser;
  accessToken?: string;
}


/**
 * Handles all NextAuth.js authentication requests (e.g., sign-in, sign-out, session).
 * This is a catch-all route for NextAuth.js.
 * @route GET /api/auth/[...nextauth]
 * @route POST /api/auth/[...nextauth]
 * @returns NextAuth.js authentication responses.
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

export type { ExtendedUser, ExtendedSession };
