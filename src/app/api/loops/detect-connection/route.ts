// src/app/api/loops/detect-connection/route.ts

import { NextRequest, NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { apiLogger } from "@/lib/logger";
import { loopService } from "@/app/services/loopService";
import { z } from "zod";

// Schema for validating connection detection request
const detectConnectionSchema = z.object({
  beforeJournalId: z.string().min(1, "Before journal ID is required"),
  afterJournalId: z.string().min(1, "After journal ID is required"),
});

/**
 * POST /api/loops/detect-connection
 * Detects if a connection exists between two journals in any active loop.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @body {object} body - The connection detection data.
 * @body {string} body.beforeJournalId - The ID of the journal that comes before.
 * @body {string} body.afterJournalId - The ID of the journal that comes after.
 * @returns {NextResponse} A JSON response containing the connection detection result.
 * @status 200 - OK: Connection detection completed successfully.
 * @status 400 - Bad Request: Invalid request body.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_JOURNAL - Requires 'READ' action on 'JOURNAL' resource.
 */
export async function POST(request: NextRequest) {
    try {
      const rawBody = await request.json();
      const validation = detectConnectionSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { beforeJournalId, afterJournalId } = validation.data;

      // Use the enhanced loop service to detect connections
      const result = await loopService.detectConnection(beforeJournalId, afterJournalId);

      return NextResponse.json(result);
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API POST /api/loops/detect-connection Error", {
        error: e.message,
        stack: e.stack
      });
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
}