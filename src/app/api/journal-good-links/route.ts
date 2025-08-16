// src/app/api/journal-good-links/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import journalGoodLinkService, {
  CreateJournalGoodLinkData,
} from "@/app/services/journalGoodLinkService";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { Prisma } from "@prisma/client";
import {
  getLinksQuerySchema,
  deleteLinksQuerySchema,
} from "@/lib/schemas/journalGoodLink.schema";
import { apiLogger } from "@/lib/logger";

// Zod schema for the POST request body
const createLinkSchema = z.object({
  journalId: z.string().min(1, "journalId is required"),
  goodId: z.coerce.bigint(), // Coerces string/number from JSON to bigint
});

/**
 * POST /api/journal-good-links
 * Creates a new link between a Journal and a Good.
 */
/**
 * POST /api/journal-good-links
 * Creates a new link between a Journal and a Good.
 * Enforces business rule: a Good cannot be linked to a child Journal unless it's also linked to its parent.
 * @param {NextRequest} request - The incoming Next.js request object containing the link creation payload.
 * @body {object} body - The link creation data.
 * @body {string} body.journalId - The ID of the journal to link.
 * @body {bigint} body.goodId - The ID of the good to link.
 * @returns {NextResponse} A JSON response containing the newly created link.
 * @status 201 - Created: Link successfully created.
 * @status 400 - Bad Request: Invalid request body, or business rule violation (e.g., parent link missing).
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission CREATE_JOURNAL - Requires 'CREATE' action on 'JOURNAL' resource.
 */
export const POST = withAuthorization(
  async function POST(request: NextRequest) {
    try {
      const rawBody = await request.json();
      const validation = createLinkSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const newLink = await journalGoodLinkService.createLink(
        validation.data as CreateJournalGoodLinkData
      );

      const body = JSON.stringify(newLink, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API POST /api/journal-good-links Error", { error: e.message, stack: e.stack });
      // Catch specific business rule violations or not-found errors from the service
      if (e.message.includes("not found") || e.message.includes("Violation")) {
        return NextResponse.json({ message: e.message }, { status: 400 });
      }
      return NextResponse.json(
        { message: "An internal error occurred." },
        { status: 500 }
      );
    }
  },
  { action: "CREATE", resource: "JOURNAL" }
);

/**
 * GET /api/journal-good-links
 * Fetches Journal-Good link records based on query parameters.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @queryparam {bigint} [linkId] - The ID of a specific link to fetch.
 * @queryparam {string} [journalId] - The ID of the journal to filter links by.
 * @queryparam {bigint} [goodId] - The ID of the good to filter links by.
 * @returns {NextResponse} A JSON response containing an array of Journal-Good links.
 * @status 200 - OK: Links successfully fetched.
 * @status 400 - Bad Request: Invalid query parameters.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_JOURNAL - Requires 'READ' action on 'JOURNAL' resource.
 */
export const GET = withAuthorization(
  async function GET(request: NextRequest) {
    try {
      const queryParams = Object.fromEntries(request.nextUrl.searchParams);
      const validation = getLinksQuerySchema.safeParse(queryParams);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid query parameters.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { linkId, journalId, goodId } = validation.data;

      // As per the spec, we build a dynamic where clause for findMany.
      // This is more flexible than calling a specific service function here.
      const where: Prisma.JournalGoodLinkWhereInput = {};
      if (linkId) where.id = linkId;
      if (journalId) where.journalId = journalId;
      if (goodId) where.goodId = goodId;

      // Using service functions is preferred, but for a generic find, direct prisma is fine.
      // Here, we'll use the specific functions to adhere to service layer abstraction.
      let result;
      if (linkId) {
        result = await journalGoodLinkService.getLinkById(linkId);
        result = result ? [result] : []; // Standardize to array
      } else if (journalId) {
        result = await journalGoodLinkService.getLinksForJournal(journalId);
      } else if (goodId) {
        result = await journalGoodLinkService.getLinksForGood(goodId);
      } else {
        result = []; // No params, return empty array
      }

      const body = JSON.stringify(result, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API GET /api/journal-good-links Error", { error: e.message, stack: e.stack });
      return NextResponse.json(
        { message: "An internal error occurred." },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "JOURNAL" }
);

/**
 * DELETE /api/journal-good-links
 * Deletes one or more Journal-Good link records.
 * Requires either `linkId` or both `journalId` and `goodId` for deletion.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @queryparam {bigint} [linkId] - The ID of the specific link to delete.
 * @queryparam {string} [journalId] - The ID of the journal for composite key deletion.
 * @queryparam {bigint} [goodId] - The ID of the good for composite key deletion.
 * @returns {NextResponse} A JSON response indicating success or an error message.
 * @status 200 - OK: Link(s) successfully deleted.
 * @status 400 - Bad Request: Invalid query parameters for deletion.
 * @status 404 - Not Found: Link(s) not found for deletion.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission DELETE_JOURNAL - Requires 'DELETE' action on 'JOURNAL' resource.
 */
export const DELETE = withAuthorization(
  async function DELETE(request: NextRequest) {
    try {
      const queryParams = Object.fromEntries(request.nextUrl.searchParams);
      const validation = deleteLinksQuerySchema.safeParse(queryParams);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid query parameters for deletion.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { linkId, journalId, goodId } = validation.data;
      let resultMessage = "";

      if (linkId) {
        const deletedLink = await journalGoodLinkService.deleteLinkById(linkId);
        if (!deletedLink) {
          return NextResponse.json(
            { message: `Link with ID ${linkId} not found.` },
            { status: 404 }
          );
        }
        resultMessage = `Successfully deleted link with ID ${linkId}.`;
      } else if (journalId && goodId) {
        const { count } = await journalGoodLinkService.deleteLinkByJournalAndGood(
          journalId,
          goodId
        );
        if (count === 0) {
          return NextResponse.json(
            {
              message: `No link found for journal '${journalId}' and good '${goodId}'.`,
            },
            { status: 404 }
          );
        }
        resultMessage = `Successfully deleted ${count} link(s).`;
      }

      return NextResponse.json({ message: resultMessage }, { status: 200 });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API DELETE /api/journal-good-links Error", { error: e.message, stack: e.stack });
      return NextResponse.json(
        { message: "An internal error occurred." },
        { status: 500 }
      );
    }
  },
  { action: "DELETE", resource: "JOURNAL" }
);


