// src/app/api/loops/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { apiLogger } from "@/lib/logger";
import { loopService, UpdateLoopData } from "@/app/services/loopService";
import { updateLoopSchema } from "@/lib/schemas/loop.schema";

/**
 * GET /api/loops/[id]
 * Fetches a specific journal loop by ID.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @param {object} params - Route parameters.
 * @param {string} params.id - The ID of the loop to fetch.
 * @returns {NextResponse} A JSON response containing the loop data.
 * @status 200 - OK: Loop successfully fetched.
 * @status 404 - Not Found: Loop not found.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_JOURNAL - Requires 'READ' action on 'JOURNAL' resource.
 */
export const GET = withAuthorization(
  async function GET(request: NextRequest, { params }: { params: { id: string } }, session: any) {
    try {
      const loop = await loopService.getLoopById(params.id);

      if (!loop) {
        return NextResponse.json(
          { message: "Loop not found." },
          { status: 404 }
        );
      }

      return NextResponse.json(loop);
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API GET /api/loops/[id] Error", { error: e.message, stack: e.stack });
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "JOURNAL" }
);

/**
 * PUT /api/loops/[id]
 * Updates a specific journal loop.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @param {object} params - Route parameters.
 * @param {string} params.id - The ID of the loop to update.
 * @body {object} body - The loop update data.
 * @body {string} [body.name] - The name of the loop.
 * @body {string} [body.description] - The description of the loop.
 * @body {string} [body.status] - The status of the loop.
 * @body {string[]} [body.journalIds] - Array of journal IDs forming the loop path.
 * @returns {NextResponse} A JSON response containing the updated loop.
 * @status 200 - OK: Loop successfully updated.
 * @status 400 - Bad Request: Invalid request body or validation failed.
 * @status 404 - Not Found: Loop not found.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission UPDATE_JOURNAL - Requires 'UPDATE' action on 'JOURNAL' resource.
 */
export const PUT = withAuthorization(
  async function PUT(request: NextRequest, { params }: { params: { id: string } }, session: any) {
    try {
      const rawBody = await request.json();
      const validation = updateLoopSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const updatedLoop = await loopService.updateLoop(params.id, validation.data as UpdateLoopData, session.user.id);

      if (!updatedLoop) {
        return NextResponse.json(
          { message: "Loop not found." },
          { status: 404 }
        );
      }

      return NextResponse.json(updatedLoop);
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API PUT /api/loops/[id] Error", { error: e.message, stack: e.stack });

      if (e.message.includes("Invalid loop") || e.message.includes("validation")) {
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
  },
  { action: "UPDATE", resource: "JOURNAL" }
);

/**
 * DELETE /api/loops/[id]
 * Deletes a specific journal loop.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @param {object} params - Route parameters.
 * @param {string} params.id - The ID of the loop to delete.
 * @returns {NextResponse} A JSON response confirming deletion.
 * @status 200 - OK: Loop successfully deleted.
 * @status 404 - Not Found: Loop not found.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission DELETE_JOURNAL - Requires 'DELETE' action on 'JOURNAL' resource.
 */
export const DELETE = withAuthorization(
  async function DELETE(request: NextRequest, { params }: { params: { id: string } }, session: any) {
    try {
      const success = await loopService.deleteLoop(params.id, session.user.id);

      if (!success) {
        return NextResponse.json(
          { message: "Loop not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({ message: "Loop deleted successfully." });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API DELETE /api/loops/[id] Error", { error: e.message, stack: e.stack });
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "DELETE", resource: "JOURNAL" }
);