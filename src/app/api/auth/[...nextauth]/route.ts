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

// Define authOptions directly or ensure it's correctly typed
const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "john.doe@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter your email and password.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            company: true,
            userRoles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!user) {
          throw new Error("No user found with this email.");
        }
        if (!user.isActive) {
          throw new Error("This user account is inactive.");
        }
        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!isValidPassword) {
          throw new Error("Incorrect password.");
        }

        const rolesWithPermissions = user.userRoles.map((userRole) => ({
          name: userRole.role.name,
          restrictedTopLevelJournalId: userRole.restrictedTopLevelJournalId,
          restrictedTopLevelJournalCompanyId:
            userRole.restrictedTopLevelJournalCompanyId,
          permissions: userRole.role.permissions.map((rp) => ({
            action: rp.permission.action,
            resource: rp.permission.resource,
          })),
        }));

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          roles: rolesWithPermissions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as Omit<ExtendedUser, "image" | "emailVerified"> & {
          roles: ExtendedUser["roles"];
          companyId: string;
        };
        token.id = u.id;
        token.companyId = u.companyId;
        token.roles = u.roles;
        token.name = u.name;
        token.email = u.email;
      }
      return token;
    },
    async session({ session, token }) {
      const extendedToken = token as any;
      if (session.user) {
        (session.user as ExtendedUser).id = extendedToken.id;
        (session.user as ExtendedUser).companyId = extendedToken.companyId;
        (session.user as ExtendedUser).roles = extendedToken.roles;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  // It's good practice to explicitly set session strategy if you rely on JWT heavily
  session: {
    strategy: "jwt",
  },
  // Remove debug for production builds or set conditionally
  // debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

// The exports should be correct, but the error suggests a type mismatch recognized by Next.js build.
export { handler as GET, handler as POST };
