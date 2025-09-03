// src/app/api/approval/approve/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { apiLogger } from "@/lib/logger";
import approvalService from "@/app/services/approvalService";

// Schema for approval request
const approveRequestSchema = z.object({
  entityType: z.enum(['partner', 'good', 'document', 'link']),
  entityId: z.string().min(1),
  comments: z.string().optional(),
});

/**
 * POST /api/approval/approve
 * Approves a pending entity at the user's approval level.
 * @param request - The incoming Next.js request object
 * @param session - The authenticated user's session
 * @returns A JSON response confirming the approval
 */
export const POST = withAuthorization(
  async function POST(request: NextRequest, _context, session: ExtendedSession) {
    try {
      const body = await request.json();
      const validation = approveRequestSchema.safeParse(body);
      
      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { entityType, entityId, comments } = validation.data;

      // Get user's approval level
      const userApprovalLevel = await approvalService.getUserApprovalLevel(
        session.user?.restrictedTopLevelJournalId || null
      );

      const result = await approvalService.approveEntity({
        entityType,
        entityId,
        userApprovalLevel,
        userId: session.user.id,
        comments,
        userIp: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      });

      const responseBody = JSON.stringify(result, jsonBigIntReplacer);
      return new NextResponse(responseBody, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API POST /api/approval/approve Error", { 
        error: e.message, 
        stack: e.stack 
      });
      
      // Handle specific approval errors
      if (e.message.includes('not authorized') || e.message.includes('wrong level')) {
        return NextResponse.json(
          { message: "You are not authorized to approve this entity at its current level." },
          { status: 403 }
        );
      }

      if (e.message.includes('not found')) {
        return NextResponse.json(
          { message: "Entity not found or already processed." },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "APPROVE", resource: "PARTNER" }
);