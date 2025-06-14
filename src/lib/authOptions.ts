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

// Define your interfaces here, now without companyId
export interface RoleData {
  name: string;
  permissions: Array<{ action: string; resource: string }>;
  restrictedTopLevelJournalId?: string | null;
}

export interface ExtendedUser extends NextAuthUser {
  id: string;
  roles: RoleData[];
}

export interface ExtendedSession extends Session {
  user?: ExtendedUser;
}

export interface ExtendedJWT extends JWT {
  id: string;
  roles: RoleData[];
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

        const rolesWithPermissions: RoleData[] = user.userRoles.map(
          (userRole) => ({
            name: userRole.role.name,
            restrictedTopLevelJournalId: userRole.restrictedTopLevelJournalId,
            permissions: userRole.role.permissions.map((rp) => ({
              action: rp.permission.action,
              resource: rp.permission.resource,
            })),
          })
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: rolesWithPermissions,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const extendedToken = token as ExtendedJWT;
        const sessionUser = session.user as ExtendedUser;

        sessionUser.id = extendedToken.id;
        sessionUser.roles = extendedToken.roles;
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
