// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, {
  NextAuthOptions,
  User as NextAuthUser,
  Session,
} from "next-auth";
import { JWT } from "next-auth/jwt";
import { authOptions } from "@/lib/authOptions";

// Note: The PrismaClient and bcrypt imports are typically used in authOptions.ts,
// but are kept here for context if this file were to expand.

interface ExtendedUser extends NextAuthUser {
  id: string;
  roles: Array<{
    name: string;
    permissions: Array<{ action: string; resource: string }>;
    restrictedTopLevelJournalId?: string | null;
  }>;
}

interface ExtendedSession extends Session {
  user: ExtendedUser;
  accessToken?: string;
}

interface ExtendedJWT extends JWT {
  id: string;
  roles: Array<{
    name: string;
    permissions: Array<{ action: string; resource: string }>;
    restrictedTopLevelJournalId?: string | null;
  }>;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

export type { ExtendedUser, ExtendedSession };
