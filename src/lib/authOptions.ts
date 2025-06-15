// src/lib/authOptions.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  type NextAuthOptions,
  type User as NextAuthUser,
  type Session,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import prisma from "@/app/utils/prisma";

// REFACTORED: RoleData is simplified
export interface RoleData {
  name: string;
  permissions: Array<{ action: string; resource: string }>;
}

// REFACTORED: ExtendedUser now has the top-level restriction
export interface ExtendedUser extends NextAuthUser {
  id: string;
  roles: RoleData[];
  restrictedTopLevelJournalId: string | null;
}

export interface ExtendedSession extends Session {
  user?: ExtendedUser;
}

// REFACTORED: JWT mirrors the new ExtendedUser structure
export interface ExtendedJWT extends JWT {
  id: string;
  roles: RoleData[];
  restrictedTopLevelJournalId: string | null;
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
      async authorize(credentials): Promise<ExtendedUser | null> {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
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
          return null;
        }

        if (user.entityState !== "ACTIVE") {
          console.warn(
            `Login attempt for non-active user: ${user.email}, state: ${user.entityState}`
          );
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValidPassword) {
          return null;
        }

        // REFACTORED: Permissions are mapped, but restriction is handled separately.
        const rolesWithPermissions: RoleData[] = user.userRoles.map(
          (userRole) => ({
            name: userRole.role.name,
            permissions: userRole.role.permissions.map((rp) => ({
              action: rp.permission.action,
              resource: rp.permission.resource,
            })),
          })
        );

        // REFACTORED: The user object passed to JWT/Session now includes the direct restriction.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: rolesWithPermissions,
          restrictedTopLevelJournalId: user.restrictedTopLevelJournalId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Runs on sign-in
      if (user) {
        const u = user as ExtendedUser;
        token.id = u.id;
        token.roles = u.roles;
        token.name = u.name;
        token.email = u.email;
        // REFACTORED: Pass restriction to the JWT token
        token.restrictedTopLevelJournalId = u.restrictedTopLevelJournalId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const extendedToken = token as ExtendedJWT;
        const sessionUser = session.user as ExtendedUser;

        sessionUser.id = extendedToken.id;
        sessionUser.roles = extendedToken.roles;
        // REFACTORED: Pass restriction from the token to the final session object
        sessionUser.restrictedTopLevelJournalId =
          extendedToken.restrictedTopLevelJournalId;
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
