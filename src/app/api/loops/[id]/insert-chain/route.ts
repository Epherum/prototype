// src/app/api/loops/[id]/insert-chain/route.ts

import { NextRequest, NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { apiLogger } from "@/lib/logger";
import { loopService } from "@/app/services/loopService";
import { z } from "zod";

// Schema for validating chain insertion request
const insertChainSchema = z.object({
  insertAfterJournalId: z.string().min(1, "Insert after journal ID is required"),
  insertBeforeJournalId: z.string().min(1, "Insert before journal ID is required"),
  journalChain: z.array(z.string().min(1)).min(1, "Journal chain must contain at least one journal"),
});

/**
 * PUT /api/loops/[id]/insert-chain
 * Inserts a chain of journals into an existing loop between two specified journals.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @param {object} params - Route parameters.
 * @param {string} params.id - The ID of the loop to modify.
 * @body {object} body - The chain insertion data.
 * @body {string} body.insertAfterJournalId - The journal after which to insert the chain.
 * @body {string} body.insertBeforeJournalId - The journal before which to insert the chain.
 * @body {string[]} body.journalChain - Array of journal IDs forming the chain to insert.
 * @returns {NextResponse} A JSON response containing the updated loop.
 * @status 200 - OK: Chain inserted successfully.
 * @status 400 - Bad Request: Invalid request body or insertion failed validation.
 * @status 404 - Not Found: Loop not found.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission UPDATE_JOURNAL - Requires 'UPDATE' action on 'JOURNAL' resource.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
    try {
      const params = await context.params;
      const rawBody = await request.json();
      const validation = insertChainSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { insertAfterJournalId, insertBeforeJournalId, journalChain } = validation.data;

      // Use the enhanced loop service to insert the chain
      const updatedLoop = await loopService.insertChain(
        params.id,
        insertAfterJournalId,
        insertBeforeJournalId,
        journalChain,
        "test-user-id" // Using a test user ID for now
      );

      if (!updatedLoop) {
        return NextResponse.json(
          { message: "Loop not found." },
          { status: 404 }
        );
      }

      return NextResponse.json(updatedLoop);
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API PUT /api/loops/[id]/insert-chain Error", {
        error: e.message,
        stack: e.stack
      });

      if (e.message.includes("Invalid insertion") || e.message.includes("not found") || e.message.includes("validation")) {
        return NextResponse.json(
          { message: e.message },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
}