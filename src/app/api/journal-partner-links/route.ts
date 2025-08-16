// src/app/api/journal-partner-links/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import journalPartnerLinkService, {
  CreateJournalPartnerLinkData,
} from "@/app/services/journalPartnerLinkService";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { Prisma } from "@prisma/client";
import {
  getLinksQuerySchema,
  deleteLinksQuerySchema,
} from "@/lib/schemas/journalPartnerLink.schema";
import { apiLogger } from "@/lib/logger";

// Zod schema for the POST request body
const createLinkSchema = z.object({
  journalId: z.string().min(1, "journalId is required"),
  partnerId: z.coerce.bigint(),
  partnershipType: z.string().optional().nullable(),
  exoneration: z.boolean().optional().nullable(),
  periodType: z.string().optional().nullable(),
  dateDebut: z.string().datetime().optional().nullable(), // Validate as ISO string
  dateFin: z.string().datetime().optional().nullable(),
  documentReference: z.string().optional().nullable(),
});


/**
 * POST /api/journal-partner-links
 * Creates a new link between a Journal and a Partner.
 * Enforces business rule: a Partner cannot be linked to a child Journal unless it's also linked to its parent.
 * @param {NextRequest} request - The incoming Next.js request object containing the link creation payload.
 * @body {object} body - The link creation data.
 * @body {string} body.journalId - The ID of the journal to link.
 * @body {bigint} body.partnerId - The ID of the partner to link.
 * @body {string} [body.partnershipType] - The type of partnership.
 * @body {boolean} [body.exoneration] - Exoneration status.
 * @body {string} [body.periodType] - Period type.
 * @body {string} [body.dateDebut] - Start date (ISO string).
 * @body {string} [body.dateFin] - End date (ISO string).
 * @body {string} [body.documentReference] - Document reference.
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

      const newLink = await journalPartnerLinkService.createLink(
        validation.data as CreateJournalPartnerLinkData
      );

      const body = JSON.stringify(newLink, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API POST /api/journal-partner-links Error", { error: e.message, stack: e.stack });
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
 * GET /api/journal-partner-links
 * Fetches Journal-Partner link records based on query parameters.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @queryparam {bigint} [linkId] - The ID of a specific link to fetch.
 * @queryparam {string} [journalId] - The ID of the journal to filter links by.
 * @queryparam {bigint} [partnerId] - The ID of the partner to filter links by.
 * @returns {NextResponse} A JSON response containing an array of Journal-Partner links.
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

      const { linkId, journalId, partnerId } = validation.data;
      let result;

      if (linkId) {
        result = await journalPartnerLinkService.getLinkById(linkId);
        result = result ? [result] : []; // Standardize to array
      } else if (journalId) {
        result = await journalPartnerLinkService.getLinksForJournal(journalId);
      } else if (partnerId) {
        result = await journalPartnerLinkService.getLinksForPartner(partnerId);
      } else {
        result = []; // No params, return empty
      }

      const body = JSON.stringify(result, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API GET /api/journal-partner-links Error", { error: e.message, stack: e.stack });
      return NextResponse.json(
        { message: "An internal error occurred." },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "JOURNAL" }
);

/**
 * DELETE /api/journal-partner-links
 * Deletes one or more Journal-Partner link records.
 * Requires either `linkId` or both `journalId` and `partnerId` for deletion.
 * Optionally, `partnershipType` can be provided for more specific deletion.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @queryparam {bigint} [linkId] - The ID of the specific link to delete.
 * @queryparam {string} [journalId] - The ID of the journal for composite key deletion.
 * @queryparam {bigint} [partnerId] - The ID of the partner for composite key deletion.
 * @queryparam {string} [partnershipType] - The partnership type for composite key deletion.
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

      const { linkId, journalId, partnerId, partnershipType } = validation.data;
      let resultMessage = "";

      if (linkId) {
        const deletedLink = await journalPartnerLinkService.deleteLinkById(
          linkId
        );
        if (!deletedLink) {
          return NextResponse.json(
            { message: `Link with ID ${linkId} not found.` },
            { status: 404 }
          );
        }
        resultMessage = `Successfully deleted link with ID ${linkId}.`;
      } else if (journalId && partnerId) {
        const { count } = await journalPartnerLinkService.deleteLinkByJournalAndPartner(
          journalId,
          partnerId,
          partnershipType
        );
        if (count === 0) {
          return NextResponse.json(
            {
              message: `No link found for journal '${journalId}' and partner '${partnerId}'.`,
            },
            { status: 404 }
          );
        }
        resultMessage = `Successfully deleted ${count} link(s).`;
      }

      return NextResponse.json({ message: resultMessage }, { status: 200 });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API DELETE /api/journal-partner-links Error", { error: e.message, stack: e.stack });
      return NextResponse.json(
        { message: "An internal error occurred." },
        { status: 500 }
      );
    }
  },
  { action: "DELETE", resource: "JOURNAL" }
);



