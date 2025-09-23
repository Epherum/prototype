// src/app/api/loops/route.ts

import { NextRequest, NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { apiLogger } from "@/lib/logger";
import { loopService, CreateLoopData } from "@/app/services/loopService";
import { createLoopSchema, getLoopsQuerySchema } from "@/lib/schemas/loop.schema";

/**
 * GET /api/loops
 * Fetches all journal loops for the authenticated user.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @queryparam {string} [status] - Filter by loop status (ACTIVE, INACTIVE, DRAFT).
 * @queryparam {string} [search] - Search loops by name.
 * @returns {NextResponse} A JSON response containing an array of loops.
 * @status 200 - OK: Loops successfully fetched.
 * @status 400 - Bad Request: Invalid query parameters.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_JOURNAL - Requires 'READ' action on 'JOURNAL' resource.
 */
export const GET = withAuthorization(
  async function GET(request: NextRequest, context: any, session: any) {
    try {
      const queryParams = Object.fromEntries(request.nextUrl.searchParams);
      const validation = getLoopsQuerySchema.safeParse(queryParams);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid query parameters.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { status, search } = validation.data;
      const loops = await loopService.getLoops({ status, search });

      return NextResponse.json(loops);
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API GET /api/loops Error", { error: e.message, stack: e.stack });
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "JOURNAL" }
);

/**
 * POST /api/loops
 * Creates a new journal loop.
 * @param {NextRequest} request - The incoming Next.js request object containing the loop creation payload.
 * @body {object} body - The loop creation data.
 * @body {string} body.name - The name of the loop.
 * @body {string} [body.description] - The description of the loop.
 * @body {string[]} body.journalIds - Array of journal IDs forming the loop path.
 * @returns {NextResponse} A JSON response containing the newly created loop.
 * @status 201 - Created: Loop successfully created.
 * @status 400 - Bad Request: Invalid request body or loop validation failed.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission CREATE_JOURNAL - Requires 'CREATE' action on 'JOURNAL' resource.
 */
export const POST = withAuthorization(
  async function POST(request: NextRequest, context: any, session: any) {
    try {
      const rawBody = await request.json();
      const validation = createLoopSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const newLoop = await loopService.createLoop(validation.data as CreateLoopData, session.user.id);

      return NextResponse.json(newLoop, { status: 201 });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API POST /api/loops Error", { error: e.message, stack: e.stack });

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
  { action: "CREATE", resource: "JOURNAL" }
);