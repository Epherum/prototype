// src/app/api/debug/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession } from "@/lib/auth/authOptions";
import prisma from "@/app/utils/prisma";

export async function GET(request: NextRequest) {
  try {
    console.log("=== DEBUG ENDPOINT START ===");
    
    // 1. Check environment variables
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
      DIRECT_URL: process.env.DIRECT_URL ? "SET" : "NOT SET",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "SET" : "NOT SET",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    };
    console.log("Environment variables:", envCheck);

    // 2. Check session
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
    console.log("Session exists:", !!session);
    console.log("Session user ID:", session?.user?.id);
    console.log("Session user roles:", session?.user?.roles?.length || 0);
    
    if (session?.user?.roles) {
      console.log("User permissions:", session.user.roles.map(role => ({
        role: role.name,
        permissions: role.permissions.map(p => `${p.action}_${p.resource}`)
      })));
    }

    // 3. Test database connection
    let dbTest;
    try {
      console.log("Testing database connection...");
      await prisma.$connect();
      console.log("Database connected successfully");
      
      // Try a simple query
      const userCount = await prisma.user.count();
      console.log("User count from database:", userCount);
      
      dbTest = { 
        connected: true, 
        userCount,
        message: "Database connection successful" 
      };
    } catch (dbError) {
      console.error("Database error:", dbError);
      dbTest = { 
        connected: false, 
        error: dbError.message,
        stack: dbError.stack 
      };
    }

    // 4. Test permissions check
    let permissionTest;
    if (session?.user) {
      const hasJournalRead = session.user.roles?.some(role =>
        role.permissions.some(p => p.action === "READ" && p.resource === "JOURNAL")
      );
      const hasRoleManage = session.user.roles?.some(role =>
        role.permissions.some(p => p.action === "MANAGE" && p.resource === "ROLE")
      );
      
      permissionTest = {
        hasJournalRead,
        hasRoleManage,
        allPermissions: session.user.roles?.flatMap(role => 
          role.permissions.map(p => `${p.action}_${p.resource}`)
        ) || []
      };
    } else {
      permissionTest = { error: "No session found" };
    }

    console.log("=== DEBUG ENDPOINT END ===");

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envCheck,
      session: {
        exists: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        rolesCount: session?.user?.roles?.length || 0,
        restrictedJournal: session?.user?.restrictedTopLevelJournalId
      },
      database: dbTest,
      permissions: permissionTest
    });

  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}