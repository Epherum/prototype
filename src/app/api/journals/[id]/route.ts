// src/app/api/journals/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  journalService,
  UpdateJournalData,
} from "@/app/services/journalService";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { apiLogger } from "@/lib/logger";

// Zod schema for validating the request body for PUT /api/journals/[id].
const updateJournalSchema = z
  .object({
    name: z.string().min(1).optional(),
    isTerminal: z.boolean().optional(),
    additionalDetails: z.any().optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Update body cannot be empty."
  );

type RouteContext = { params: { id: string } };

/**
 * GET /api/journals/[id]
 * Fetches a single Journal by its ID.
 * @param {NextRequest} _request - The incoming Next.js request object.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the Journal to fetch.
 * @returns {NextResponse} A JSON response containing the Journal data if found, or an error message.
 * @status 200 - OK: Journal found and returned.
 * @status 404 - Not Found: Journal with the specified ID does not exist.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_JOURNAL - Requires 'READ' action on 'JOURNAL' resource.
 */
export const GET = withAuthorization(
  async function GET(_request: NextRequest, { params }: RouteContext) {
    try {
      const journal = await journalService.getJournalById(params.id);
      if (!journal) {
        return NextResponse.json(
          { message: `Journal with ID '${params.id}' not found.` },
          { status: 404 }
        );
      }
      return NextResponse.json(journal);
    } catch (error) {
      const e = error as Error;
      apiLogger.error(`API GET /api/journals/${params.id} Error:`, e);
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "JOURNAL" }
);

/**
 * PUT /api/journals/[id]
 * Updates an existing Journal by its ID.
 * @param {NextRequest} request - The incoming Next.js request object containing the update payload.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the Journal to update.
 * @body {UpdateJournalData} - The Journal fields to update.
 * @returns {NextResponse} A JSON response containing the updated Journal data or an error message.
 * @status 200 - OK: Journal successfully updated.
 * @status 400 - Bad Request: Invalid request body.
 * @status 404 - Not Found: Journal with the specified ID does not exist for update.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission UPDATE_JOURNAL - Requires 'UPDATE' action on 'JOURNAL' resource.
 */
export const PUT = withAuthorization(
  async function PUT(request: NextRequest, { params }: RouteContext) {
    try {
      const rawBody = await request.json();
      const validation = updateJournalSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body for update.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const updatedJournal = await journalService.updateJournal(
        params.id,
        validation.data as UpdateJournalData
      );
      return NextResponse.json(updatedJournal);
    } catch (error) {
      const e = error as Error & { code?: string };
      apiLogger.error(`API PUT /api/journals/${params.id} Error:`, e);

      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Journal with ID '${params.id}' not found for update.` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "UPDATE", resource: "JOURNAL" }
);

/**
 * DELETE /api/journals/[id]
 * Deletes a Journal by its ID.
 * @param {NextRequest} _request - The incoming Next.js request object.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the Journal to delete.
 * @returns {NextResponse} A JSON response indicating success or an error message.
 * @status 200 - OK: Journal successfully deleted.
 * @status 404 - Not Found: Journal with the specified ID does not exist for deletion.
 * @status 409 - Conflict: Cannot delete journal due to existing children or user role restrictions.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission DELETE_JOURNAL - Requires 'DELETE' action on 'JOURNAL' resource.
 */
export const DELETE = withAuthorization(
  async function DELETE(_request: NextRequest, { params }: RouteContext) {
    try {
      await journalService.deleteJournal(params.id);
      return NextResponse.json(
        { message: `Journal with ID '${params.id}' successfully deleted.` },
        { status: 200 }
      );
    } catch (error) {
      const e = error as Error & { code?: string };
      apiLogger.error(`API DELETE /api/journals/${params.id} Error:`, e);

      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Journal with ID '${params.id}' not found for deletion.` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "DELETE", resource: "JOURNAL" }
);
