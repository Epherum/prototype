// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, {
  NextAuthOptions,
  User as NextAuthUser,
  Session,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { JWT } from "next-auth/jwt";
import { authOptions } from "@/lib/authOptions";

const prisma = new PrismaClient();

// Your ExtendedUser, ExtendedSession, ExtendedJWT interfaces remain the same
interface ExtendedUser extends NextAuthUser {
  id: string;
  companyId: string;
  roles: Array<{
    name: string;
    permissions: Array<{ action: string; resource: string }>;
    restrictedTopLevelJournalId?: string | null;
    restrictedTopLevelJournalCompanyId?: string | null;
  }>;
}

interface ExtendedSession extends Session {
  user: ExtendedUser;
  accessToken?: string;
}

interface ExtendedJWT extends JWT {
  id: string;
  companyId: string;
  roles: Array<{
    name: string;
    permissions: Array<{ action: string; resource: string }>;
    restrictedTopLevelJournalId?: string | null;
    restrictedTopLevelJournalCompanyId?: string | null;
  }>;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

export type { ExtendedUser, ExtendedSession };
