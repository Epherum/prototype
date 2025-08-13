// src/app/api/journal-partner-links/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import journalPartnerLinkService, {
  CreateJournalPartnerLinkData,
} from "@/app/services/journalPartnerLinkService";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { Prisma } from "@prisma/client";

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

// Zod schema for validating GET query parameters
const getLinksQuerySchema = z.object({
  linkId: z.coerce.bigint().optional(),
  journalId: z.string().optional(),
  partnerId: z.coerce.bigint().optional(),
});

// Zod schema for validating DELETE query parameters, as per the spec
const deleteLinksQuerySchema = z
  .object({
    linkId: z.coerce.bigint().optional(),
    journalId: z.string().optional(),
    partnerId: z.coerce.bigint().optional(),
    partnershipType: z.string().optional(), // Note: .nullable() not needed for optional query param
  })
  .superRefine((data, ctx) => {
    const hasLinkId = data.linkId !== undefined;
    const hasCompositeKey =
      data.journalId !== undefined && data.partnerId !== undefined;

    if (hasLinkId && (data.journalId || data.partnerId)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Cannot provide journalId or partnerId when linkId is present.",
      });
    } else if (!hasLinkId && !hasCompositeKey) {
      ctx.addIssue({
        code: "custom",
        message:
          "Either linkId or both journalId and partnerId must be provided.",
      });
    }
  });

/**
 * POST /api/journal-partner-links
 * Creates a new link between a Journal and a Partner.
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
      console.error("API POST /api/journal-partner-links Error:", e);
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
 * Fetches JournalPartnerLink records based on query parameters.
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
      console.error("API GET /api/journal-partner-links Error:", e);
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
 * Deletes one or more JournalPartnerLink records.
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
        const { count } =
          await journalPartnerLinkService.deleteLinkByJournalAndPartner(
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
      console.error("API DELETE /api/journal-partner-links Error:", e);
      return NextResponse.json(
        { message: "An internal error occurred." },
        { status: 500 }
      );
    }
  },
  { action: "DELETE", resource: "JOURNAL" }
);
