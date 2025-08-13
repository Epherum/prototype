// src/app/api/journal-good-links/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import journalGoodLinkService, {
  CreateJournalGoodLinkData,
} from "@/app/services/journalGoodLinkService";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { Prisma } from "@prisma/client";

// Zod schema for the POST request body
const createLinkSchema = z.object({
  journalId: z.string().min(1, "journalId is required"),
  goodId: z.coerce.bigint(), // Coerces string/number from JSON to bigint
});

// Zod schema for validating GET query parameters
const getLinksQuerySchema = z.object({
  linkId: z.coerce.bigint().optional(),
  journalId: z.string().optional(),
  goodId: z.coerce.bigint().optional(),
});

// Zod schema for validating DELETE query parameters
const deleteLinksQuerySchema = z
  .object({
    linkId: z.coerce.bigint().optional(),
    journalId: z.string().optional(),
    goodId: z.coerce.bigint().optional(),
  })
  .superRefine((data, ctx) => {
    const hasLinkId = data.linkId !== undefined;
    const hasCompositeKey =
      data.journalId !== undefined && data.goodId !== undefined;

    if (hasLinkId && (data.journalId || data.goodId)) {
      ctx.addIssue({
        code: "custom",
        message: "Cannot provide journalId or goodId when linkId is present.",
      });
    } else if (!hasLinkId && !hasCompositeKey) {
      ctx.addIssue({
        code: "custom",
        message: "Either linkId or both journalId and goodId must be provided.",
      });
    }
  });

/**
 * POST /api/journal-good-links
 * Creates a new link between a Journal and a Good.
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
      console.error("API POST /api/journal-good-links Error:", e);
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
 * Fetches JournalGoodLink records based on query parameters.
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
      console.error("API GET /api/journal-good-links Error:", e);
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
 * Deletes one or more JournalGoodLink records.
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
        const { count } =
          await journalGoodLinkService.deleteLinkByJournalAndGood(
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
      console.error("API DELETE /api/journal-good-links Error:", e);
      return NextResponse.json(
        { message: "An internal error occurred." },
        { status: 500 }
      );
    }
  },
  { action: "DELETE", resource: "JOURNAL" }
);
