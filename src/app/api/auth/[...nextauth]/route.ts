// src/app/api/auth/[...nextauth]/route.ts

import NextAuth, {
  NextAuthOptions,
  User as NextAuthUser,
  Session,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient, Role, Permission } from "@prisma/client"; // Assuming PrismaClient is correctly set up
import bcrypt from "bcryptjs";
import { JWT } from "next-auth/jwt"; // Correct import for JWT type

const prisma = new PrismaClient(); // Or import your existing prisma instance from src/app/utils/prisma.js (or db.js)

// Define custom types for session and JWT to include our specific fields
interface ExtendedUser extends NextAuthUser {
  id: string; // Prisma User ID (cuid)
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
  accessToken?: string; // If using JWT strategy, this would be the JWT
}

interface ExtendedJWT extends JWT {
  id: string;
  companyId: string;
  roles: Array<{
    // Storing a simplified role structure in JWT
    name: string;
    permissions: Array<{ action: string; resource: string }>;
    restrictedTopLevelJournalId?: string | null;
    restrictedTopLevelJournalCompanyId?: string | null;
  }>;
  // Include other fields you want in the JWT from the user object
  name?: string | null;
  email?: string | null;
  picture?: string | null; // NextAuth default
}

export const authOptions: NextAuthOptions = {
  // session: {
  //   strategy: 'jwt', // Using JWT for session management
  // },
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
            company: true, // To get companyId implicitly
            userRoles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true, // Fetch the actual permission details
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

        // Prepare roles and permissions for the session/JWT
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

        // Return the user object that NextAuth will use to create the session/JWT
        // This object's shape is what gets passed to the `jwt` callback's `user` parameter on sign in.
        return {
          id: user.id, // This is Prisma's CUID
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          roles: rolesWithPermissions, // Our custom structured roles/permissions
        };
      },
    }),
    // ...add more providers here if needed (e.g., Google, GitHub)
  ],
  callbacks: {
    async jwt({ token, user, account, profile, isNewUser }) {
      // `user` is only available on first sign-in.
      // Persist the necessary user data to the token.
      if (user) {
        // Type assertion for the user object received from authorize
        const u = user as Omit<ExtendedUser, "image" | "emailVerified"> & {
          roles: ExtendedUser["roles"];
          companyId: string;
        };
        token.id = u.id;
        token.companyId = u.companyId;
        token.roles = u.roles; // Roles with permissions structure
        token.name = u.name;
        token.email = u.email;
      }
      return token; // Do not cast to ExtendedJWT
    },
    async session({ session, token, user }) {
      // `token` is the JWT token from the `jwt` callback.
      // `user` is the user object from the database (only for database sessions, not JWT).
      // We are using JWT strategy, so `token` is the source of truth after initial login.

      // Use type assertion only when accessing custom fields
      const extendedToken = token as any;

      // Assign data from the token to the session.user object
      // Ensure the session.user object matches ExtendedUser structure
      if (session.user) {
        (session.user as ExtendedUser).id = extendedToken.id;
        (session.user as ExtendedUser).companyId = extendedToken.companyId;
        (session.user as ExtendedUser).roles = extendedToken.roles;
        // session.user.name and session.user.email are usually handled by NextAuth if present in token
      }

      return session; // Do not cast to ExtendedSession
    },
  },
  pages: {
    signIn: "/login", // Custom login page URL (we'll create this page later)
    // error: '/auth/error', // Custom error page (optional)
    // signOut: '/auth/signout', // Custom signout page (optional)
  },
  // debug: process.env.NODE_ENV === 'development', // Enable debug messages in development
  secret: process.env.NEXTAUTH_SECRET, // From .env.local
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
