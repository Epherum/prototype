// src/app/api/journal-partner-good-links/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jpgLinkService, {
  OrchestratedCreateJPGLSchema,
} from "@/app/services/journalPartnerGoodLinkService";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import prisma from "@/app/utils/prisma";

// Zod schema for validating GET query parameters as per the spec
const getLinksQuerySchema = z
  .object({
    linkId: z.coerce.bigint().optional(),
    journalPartnerLinkId: z.coerce.bigint().optional(),
    // Contextual lookup
    goodId: z.coerce.bigint().optional(),
    journalId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Enforce that for contextual lookup, both goodId and journalId are present
    if (data.goodId && !data.journalId) {
      ctx.addIssue({
        code: "custom",
        path: ["journalId"],
        message: "journalId is required when goodId is provided.",
      });
    }
    if (data.journalId && !data.goodId) {
      ctx.addIssue({
        code: "custom",
        path: ["goodId"],
        message: "goodId is required when journalId is provided.",
      });
    }
  });

// Zod schema for validating DELETE query parameters
const deleteLinksQuerySchema = z
  .object({
    linkId: z.coerce.bigint().optional(),
    // Composite key
    journalPartnerLinkId: z.coerce.bigint().optional(),
    goodId: z.coerce.bigint().optional(),
  })
  .superRefine((data, ctx) => {
    const hasLinkId = data.linkId !== undefined;
    const hasCompositeKey =
      data.journalPartnerLinkId !== undefined && data.goodId !== undefined;

    if (!hasLinkId && !hasCompositeKey) {
      ctx.addIssue({
        code: "custom",
        message:
          "Either linkId or both journalPartnerLinkId and goodId must be provided.",
      });
    }
  });

/**
 * POST /api/journal-partner-good-links
 * Creates the full three-way link using the orchestration service.
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
      console.error("API POST /api/journal-partner-good-links Error:", e);
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
 * Fetches JournalPartnerGoodLink records based on specific contexts.
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

      const { linkId, journalPartnerLinkId, goodId, journalId } =
        validation.data;
      let result;

      // Logic from the spec: Prioritize the most specific query
      if (linkId) {
        result = await jpgLinkService.getLinkById(linkId);
        result = result ? [result] : []; // Standardize to array
      } else if (journalPartnerLinkId) {
        result = await jpgLinkService.getFullLinksForJPL(journalPartnerLinkId);
      } else if (goodId && journalId) {
        result = await jpgLinkService.getJpglsForGoodAndJournalContext(
          goodId,
          journalId
        );
      } else {
        return NextResponse.json(
          { message: "Insufficient query parameters provided." },
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
      console.error("API GET /api/journal-partner-good-links Error:", e);
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
 * Deletes a JournalPartnerGoodLink record.
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
      console.error("API DELETE /api/journal-partner-good-links Error:", e);
      return NextResponse.json(
        { message: "An internal error occurred." },
        { status: 500 }
      );
    }
  },
  { action: "DELETE", resource: "JOURNAL" }
);
