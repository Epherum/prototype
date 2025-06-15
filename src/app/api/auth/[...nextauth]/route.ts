// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, {
  NextAuthOptions,
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

// REFACTORED: JWT has a top-level restriction
interface ExtendedJWT extends JWT {
  id: string;
  roles: Role[];
  restrictedTopLevelJournalId: string | null;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

export type { ExtendedUser, ExtendedSession };
