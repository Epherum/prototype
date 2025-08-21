// src/app/api/users/validate-session/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, type ExtendedSession } from "@/lib/auth/authOptions";
import prisma from "@/app/utils/prisma";
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/users/validate-session
 * Validates that the current session user still exists in the database
 * Used for automatic logout when user is deleted after database resets
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;

    if (!session?.user?.id) {
      return NextResponse.json({ message: "No session" }, { status: 401 });
    }

    // Check if the user still exists and is active
    const userExists = await prisma.user.findUnique({
      where: { 
        id: session.user.id,
        entityState: "ACTIVE"
      },
      select: { id: true }
    });

    if (!userExists) {
      apiLogger.warn(`Session validation failed - user ${session.user.id} no longer exists`);
      return NextResponse.json({ 
        message: "User no longer exists" 
      }, { status: 401 });
    }

    return NextResponse.json({ 
      message: "Session valid", 
      userId: session.user.id 
    }, { status: 200 });

  } catch (error) {
    const e = error as Error;
    apiLogger.error("Session validation error", { error: e.message, stack: e.stack });
    return NextResponse.json(
      { message: "Session validation failed" },
      { status: 401 }
    );
  }
}