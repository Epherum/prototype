import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  type NextAuthOptions,
  type User as NextAuthUser,
  type Session,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt"; // Use 'type' for imports used only as types

const prisma = new PrismaClient(); // Keep Prisma client instantiation here if authOptions is its primary user, or import from your central Prisma instance (e.g., @/app/utils/prisma)

// Define your interfaces here
export interface RoleData {
  // A more specific name for the role structure
  name: string;
  permissions: Array<{ action: string; resource: string }>;
  restrictedTopLevelJournalId?: string | null;
  restrictedTopLevelJournalCompanyId?: string | null;
}

export interface ExtendedUser extends NextAuthUser {
  id: string;
  companyId: string;
  roles: RoleData[];
}

export interface ExtendedSession extends Session {
  user?: ExtendedUser; // Make user optional to align with Session type, but ensure it's populated
  // accessToken?: string; // if you use this, keep it
}

// JWT interface if you need to type the token object explicitly in callbacks or elsewhere
// This is also a good candidate for next-auth.d.ts augmentation
export interface ExtendedJWT extends JWT {
  id: string; // from token.id = u.id;
  companyId: string;
  roles: RoleData[];
  // name, email, picture are standard JWT claims, NextAuth adds them if available
}

export const authOptions: NextAuthOptions = {
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
      async authorize(credentials, req): Promise<ExtendedUser | null> {
        // Return type should be the user object or null
        if (!credentials?.email || !credentials?.password) {
          //  throw new Error("Please enter your email and password."); // NextAuth handles this more gracefully by returning null or an error object
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            company: true, // Ensure company is used or needed, otherwise can be removed
            userRoles: {
              include: {
                role: {
                  include: {
                    // Corrected from 'rolePermissions' to 'permissions' per Prisma schema
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
          // throw new Error("No user found with this email.");
          return null;
        }
        if (!user.isActive) {
          // throw new Error("This user account is inactive.");
          return null;
        }
        // Ensure user.passwordHash exists; Prisma schema implies it.
        const isValidPassword = user.passwordHash
          ? await bcrypt.compare(credentials.password, user.passwordHash)
          : false;

        if (!isValidPassword) {
          // throw new Error("Incorrect password.");
          return null;
        }

        const rolesWithPermissions: RoleData[] = user.userRoles.map(
          (userRole) => ({
            name: userRole.role.name,
            restrictedTopLevelJournalId: userRole.restrictedTopLevelJournalId,
            restrictedTopLevelJournalCompanyId:
              userRole.restrictedTopLevelJournalCompanyId,
            permissions: userRole.role.permissions.map((rp) => ({
              // Adjusted based on typical Prisma naming
              action: rp.permission.action,
              resource: rp.permission.resource,
            })),
          })
        );

        // This is the object that will be passed to the JWT callback as `user`
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: user.companyId, // Make sure companyId is on your Prisma User model
          roles: rolesWithPermissions,
          // image: user.image, // if you have it
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // `user` here is the return from `authorize` (if successful login) or existing token data on subsequent calls
      if (user) {
        // This block runs on sign-in
        const u = user as ExtendedUser; // Cast the incoming user object
        token.id = u.id; // next-auth.d.ts will expect this to be 'sub' or a custom prop like 'userId'
        token.companyId = u.companyId;
        token.roles = u.roles;
        // Standard claims if available on your ExtendedUser, otherwise NextAuth might add them if they come from OAuth profile
        token.name = u.name;
        token.email = u.email;
        // token.picture = u.image;
      }
      return token; // This token is then passed to the session callback
    },
    async session({ session, token }) {
      // `token` here is the return from `jwt` callback
      // The goal is to transfer necessary info from JWT (token) to session.user
      // Ensure 'session.user' exists and is typed correctly
      if (session.user) {
        const extendedToken = token as ExtendedJWT; // Use your ExtendedJWT type for clarity
        const sessionUser = session.user as ExtendedUser; // Type assertion for easier assignment

        sessionUser.id = extendedToken.id; // Map from token.id (or token.sub, or token.userId)
        sessionUser.companyId = extendedToken.companyId;
        sessionUser.roles = extendedToken.roles;
        // sessionUser.name = extendedToken.name; // Already handled by NextAuth if in token
        // sessionUser.email = extendedToken.email; // Already handled by NextAuth if in token
        // sessionUser.image = extendedToken.picture; // Already handled by NextAuth if in token
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
};
