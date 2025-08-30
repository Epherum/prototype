// src/app/api/approval/inprocess/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { apiLogger } from "@/lib/logger";
import approvalService from "@/app/services/approvalService";

// Query schema for inprocess endpoint
const inProcessQuerySchema = z.object({
  entityTypes: z
    .string()
    .optional()
    .transform((val) => val ? val.split(',').filter(Boolean) : []),
  journalIds: z
    .string()
    .optional()
    .transform((val) => val ? val.split(',').filter(Boolean) : []),
  take: z.coerce.number().min(1).max(1000).default(50),
  skip: z.coerce.number().min(0).default(0),
});

/**
 * GET /api/approval/inprocess
 * Fetches entities pending approval based on user's approval level.
 * @param request - The incoming Next.js request object
 * @param session - The authenticated user's session
 * @returns A JSON response containing pending entities for approval
 */
export const GET = withAuthorization(
  async function GET(request: NextRequest, _context, session: ExtendedSession) {
    try {
      const queryParams = Object.fromEntries(request.nextUrl.searchParams);
      const validation = inProcessQuerySchema.safeParse(queryParams);
      
      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid query parameters.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { entityTypes, journalIds, take, skip } = validation.data;

      // Get user's approval level based on their restricted journal
      const userApprovalLevel = await approvalService.getUserApprovalLevel(
        session.user?.restrictedTopLevelJournalId || null
      );

      const result = await approvalService.getInProcessItems({
        userApprovalLevel,
        entityTypes,
        journalIds,
        restrictedJournalId: session.user?.restrictedTopLevelJournalId || null,
        take,
        skip,
      });

      const body = JSON.stringify(result, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API GET /api/approval/inprocess Error", { 
        error: e.message, 
        stack: e.stack 
      });
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "PARTNER" }
);