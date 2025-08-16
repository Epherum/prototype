// src/app/api/test-no-auth/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession } from "@/lib/auth/authOptions";
import prisma from "@/app/utils/prisma";

export async function GET(request: NextRequest) {
  try {
    console.log("=== TEST NO AUTH ENDPOINT START ===");
    
    // Test 1: Basic response
    const basicTest = { success: true, message: "Basic response works" };
    
    // Test 2: Session without authorization wrapper
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
    const sessionTest = {
      exists: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      rolesCount: session?.user?.roles?.length || 0
    };
    
    // Test 3: Simple database query
    let dbTest;
    try {
      const userCount = await prisma.user.count();
      dbTest = { success: true, userCount };
    } catch (dbError) {
      dbTest = { success: false, error: dbError.message };
    }
    
    // Test 4: Journal query without authorization
    let journalTest;
    try {
      const journals = await prisma.journal.findMany({
        take: 5,
        select: { id: true, name: true, parentId: true }
      });
      journalTest = { success: true, count: journals.length, sample: journals[0] };
    } catch (journalError) {
      journalTest = { success: false, error: journalError.message };
    }
    
    console.log("=== TEST NO AUTH ENDPOINT END ===");
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      basic: basicTest,
      session: sessionTest,
      database: dbTest,
      journals: journalTest
    });
    
  } catch (error) {
    console.error("Test no auth endpoint error:", error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}