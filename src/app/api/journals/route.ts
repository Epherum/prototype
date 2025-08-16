// src/app/api/journals/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  journalService,
  CreateJournalData,
} from "@/app/services/journalService";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";
import {
  getJournalsQuerySchema,
  createJournalSchema,
} from "@/lib/schemas/journal.schema";
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/journals
 * Fetches journals based on various contexts, acting as a router to the service layer.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @queryparam {string} [rootJournalId] - The ID of the root journal to fetch its sub-hierarchy.
 * @queryparam {string} [findByPartnerIds] - Comma-separated list of partner IDs to find associated journals.
 * @queryparam {string} [findByGoodIds] - Comma-separated list of good IDs to find associated journals.
 * @returns {NextResponse} A JSON response containing an array of journals.
 * @status 200 - OK: Journals successfully fetched.
 * @status 400 - Bad Request: Invalid query parameters.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_JOURNAL - Requires 'READ' action on 'JOURNAL' resource.
 */
export const GET = withAuthorization(
  async function GET(request: NextRequest) {
    try {
      console.log("=== JOURNALS API DEBUG START ===");
      console.log("Request URL:", request.url);
      console.log("Environment:", process.env.NODE_ENV);
      console.log("Database URL exists:", !!process.env.DATABASE_URL);
      
      const queryParams = Object.fromEntries(request.nextUrl.searchParams);
      console.log("Query params:", queryParams);
      
      const validation = getJournalsQuerySchema.safeParse(queryParams);

      if (!validation.success) {
        console.log("Validation failed:", validation.error.format());
        return NextResponse.json(
          {
            message: "Invalid query parameters.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { rootJournalId, findByPartnerIds, findByGoodIds } =
        validation.data;
      let journals;

      console.log("Parsed params:", { rootJournalId, findByPartnerIds, findByGoodIds });

      // Logic from the spec: Use an if/else if/else block to call the correct service function.
      if (rootJournalId) {
        console.log("Fetching journals for rootJournalId:", rootJournalId);
        journals = await journalService.getJournalSubHierarchy(rootJournalId);
      } else if (findByPartnerIds && findByPartnerIds.length > 0) {
        console.log("Fetching journals for partners:", findByPartnerIds);
        journals = await journalService.getJournalsForPartners(
          findByPartnerIds
        );
      } else if (findByGoodIds && findByGoodIds.length > 0) {
        console.log("Fetching journals for goods:", findByGoodIds);
        journals = await journalService.getJournalsForGoods(findByGoodIds);
      } else {
        console.log("Fetching root journals (no specific params)");
        apiLogger.info("No specific query params found, fetching root journals.");
        apiLogger.debug("Calling journalService.getJournalSubHierarchy with null for Admin user.");
        journals = await journalService.getJournalSubHierarchy(null);
        apiLogger.debug("Service returned journals", { count: journals?.length });
      }

      console.log("Journals fetched successfully, count:", journals?.length);
      console.log("=== JOURNALS API DEBUG END ===");
      
      // The service functions return a simple array, not the { data, totalCount } object.
      return NextResponse.json(journals);
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API GET /api/journals Error", { error: e.message, stack: e.stack });
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "JOURNAL" }
);

/**
 * POST /api/journals
 * Creates a new Journal.
 * @param {NextRequest} request - The incoming Next.js request object containing the journal creation payload.
 * @body {object} body - The journal creation data.
 * @body {string} body.id - The unique ID for the journal.
 * @body {string} body.name - The name of the journal.
 * @body {string} [body.parentId] - The ID of the parent journal.
 * @body {boolean} [body.isTerminal] - Whether the journal is a terminal node.
 * @body {any} [body.additionalDetails] - Additional JSON details.
 * @returns {NextResponse} A JSON response containing the newly created journal.
 * @status 201 - Created: Journal successfully created.
 * @status 400 - Bad Request: Invalid request body or parent journal not found.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission CREATE_JOURNAL - Requires 'CREATE' action on 'JOURNAL' resource.
 */
export const POST = withAuthorization(
  async function POST(request: NextRequest) {
    try {
      const rawBody = await request.json();
      const validation = createJournalSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const newJournal = await journalService.createJournal(
        validation.data as CreateJournalData
      );

      return NextResponse.json(newJournal, { status: 201 });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API POST /api/journals Error", { error: e.message, stack: e.stack });
      // Handle specific errors like a non-existent parent
      if (e.message.includes("not found")) {
        return NextResponse.json(
          { message: e.message },
          { status: 400 } // Bad Request
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
