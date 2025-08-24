// src/app/api/journal-partner-good-links/route.ts

import { NextRequest, NextResponse } from "next/server";
import jpgLinkService, {
  OrchestratedCreateJPGLSchema,
} from "@/app/services/journalPartnerGoodLinkService";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import prisma from "@/app/utils/prisma";
import {
  getLinksQuerySchema,
  deleteLinksQuerySchema,
} from "@/lib/schemas/journalPartnerGoodLink.schema";
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/journal-partner-good-links
 * Creates a new three-way link (Journal-Partner-Good).
 * This endpoint orchestrates the creation of the `JournalPartnerLink` if it doesn't exist,
 * and then creates the `JournalPartnerGoodLink`.
 * @param {NextRequest} request - The incoming Next.js request object containing the link creation payload.
 * @body {object} body - The link creation data.
 * @body {string} body.journalId - The ID of the journal.
 * @body {bigint} body.partnerId - The ID of the partner.
 * @body {bigint} body.goodId - The ID of the good.
 * @body {string} [body.partnershipType] - The type of partnership (defaults to "STANDARD_TRANSACTION").
 * @body {string} [body.descriptiveText] - Additional descriptive text for the link.
 * @body {number} [body.contextualTaxCodeId] - ID of the contextual tax code.
 * @returns {NextResponse} A JSON response containing the newly created three-way link.
 * @status 201 - Created: Link successfully created.
 * @status 400 - Bad Request: Invalid request body, or related entities not found.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission CREATE_JOURNAL - Requires 'CREATE' action on 'JOURNAL' resource.
 */
export const POST = withAuthorization(
  async function POST(request: NextRequest) {
    try {
      const rawBody = await request.json();
      // Use the orchestrated schema from the service
      const validation = OrchestratedCreateJPGLSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body for 3-way link.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const newLink = await jpgLinkService.createFullJpgLink(validation.data);
      const body = JSON.stringify(newLink, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API POST /api/journal-partner-good-links Error", { error: e.message, stack: e.stack });
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
 * GET /api/journal-partner-good-links
 * Fetches Journal-Partner-Good link records based on specific contexts.
 * Requires either `linkId`, `journalPartnerLinkId`, or both `goodId` and `journalId`.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @queryparam {bigint} [linkId] - The ID of a specific three-way link to fetch.
 * @queryparam {bigint} [journalPartnerLinkId] - The ID of the Journal-Partner link to filter by.
 * @queryparam {bigint} [goodId] - The ID of the good for contextual lookup (requires `journalId`).
 * @queryparam {string} [journalId] - The ID of the journal for contextual lookup (requires `goodId`).
 * @returns {NextResponse} A JSON response containing an array of Journal-Partner-Good links.
 * @status 200 - OK: Links successfully fetched.
 * @status 400 - Bad Request: Invalid or insufficient query parameters.
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

      const { linkId, journalPartnerLinkId, goodId, journalId, journalIds, partnerId, expandRelations } =
        validation.data;
      let result;

      // Logic from the spec: Prioritize the most specific query
      if (linkId) {
        result = await jpgLinkService.getLinkById(linkId);
        result = result ? [result] : []; // Standardize to array
      } else if (journalPartnerLinkId) {
        result = await jpgLinkService.getFullLinksForJPL(journalPartnerLinkId);
      } else if (partnerId && journalIds) {
        // New: Fetch links for a partner across multiple journals
        result = await jpgLinkService.getLinksForPartnerInJournals(partnerId, journalIds, expandRelations);
      } else if (goodId && journalIds) {
        // New: Fetch links for a good across multiple journals
        result = await jpgLinkService.getLinksForGoodInJournals(goodId, journalIds, expandRelations);
      } else if (goodId && journalId) {
        result = await jpgLinkService.getJpglsForGoodAndJournalContext(
          goodId,
          journalId
        );
      } else {
        return NextResponse.json(
          { message: "Insufficient query parameters provided. Require either: linkId, journalPartnerLinkId, (partnerId + journalIds), (goodId + journalIds), or (goodId + journalId)." },
          { status: 400 }
        );
      }

      const body = JSON.stringify(result, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API GET /api/journal-partner-good-links Error", { error: e.message, stack: e.stack });
      return NextResponse.json(
        { message: "An internal error occurred." },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "JOURNAL" }
);

/**
 * DELETE /api/journal-partner-good-links
 * Deletes a Journal-Partner-Good link record.
 * Requires either `linkId` or both `journalPartnerLinkId` and `goodId` for deletion.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @queryparam {bigint} [linkId] - The ID of the specific three-way link to delete.
 * @queryparam {bigint} [journalPartnerLinkId] - The ID of the Journal-Partner link for composite key deletion.
 * @queryparam {bigint} [goodId] - The ID of the good for composite key deletion.
 * @returns {NextResponse} A JSON response indicating success or an error message.
 * @status 200 - OK: Link successfully deleted.
 * @status 400 - Bad Request: Invalid query parameters for deletion.
 * @status 404 - Not Found: Link not found for deletion.
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

      const { linkId, journalPartnerLinkId, goodId } = validation.data;
      let resultMessage = "";

      if (linkId) {
        const deleted = await jpgLinkService.deleteLinkById(linkId);
        if (!deleted) {
          return NextResponse.json(
            { message: `Link with ID ${linkId} not found.` },
            { status: 404 }
          );
        }
        resultMessage = `Successfully deleted link with ID ${linkId}.`;
      } else if (journalPartnerLinkId && goodId) {
        // This requires a new service function: deleteByCompositeKey
        // For now, let's find the link first then delete by ID.
        const linkToDelete = await prisma.journalPartnerGoodLink.findUnique({
          where: {
            journalPartnerLinkId_goodId: { journalPartnerLinkId, goodId },
          },
          select: { id: true },
        });

        if (!linkToDelete) {
          return NextResponse.json(
            {
              message: `Link not found for JPL ID ${journalPartnerLinkId} and Good ID ${goodId}.`,
            },
            { status: 404 }
          );
        }

        await jpgLinkService.deleteLinkById(linkToDelete.id);
        resultMessage = `Successfully deleted link for JPL ID ${journalPartnerLinkId} and Good ID ${goodId}.`;
      }

      return NextResponse.json({ message: resultMessage }, { status: 200 });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API DELETE /api/journal-partner-good-links Error", { error: e.message, stack: e.stack });
      return NextResponse.json(
        { message: "An internal error occurred." },
        { status: 500 }
      );
    }
  },
  { action: "DELETE", resource: "JOURNAL" }
);
