// src/app/api/documents/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import documentService, {
  CreateDocumentData,
  createDocumentSchema,
} from "@/app/services/documentService";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";

// ... (your zod schemas remain unchanged)
const getDocumentsQuerySchema = z.object({
  take: z.coerce.number().int().positive().optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  filterByJournalIds: z
    .string()
    .transform((val) => val.split(","))
    .optional(),
  filterByPartnerIds: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((id) => parseBigInt(id, "partner ID"))
        .filter((id): id is bigint => id !== null)
    )
    .optional(),
  filterByGoodIds: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((id) => parseBigInt(id, "good ID"))
        .filter((id): id is bigint => id !== null)
    )
    .optional(),
});

const apiCreateDocumentSchema = createDocumentSchema.extend({
  journalId: z.string().min(1, "Journal ID is required for creation."),
});

/**
 * GET /api/documents
 * Fetches documents. Requires full management permission for the DOCUMENT resource.
 */
export const GET = withAuthorization(
  async function GET(request: NextRequest, _context, session: ExtendedSession) {
    try {
      const queryParams = Object.fromEntries(request.nextUrl.searchParams);
      const validation = getDocumentsQuerySchema.safeParse(queryParams);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid query parameters.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const result = await documentService.getAllDocuments({
        ...validation.data,
        restrictedJournalId: session.user?.restrictedTopLevelJournalId,
      });

      const body = JSON.stringify(result, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      console.error("API GET /api/documents Error:", e);
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  // CORRECTED: Uses the exact, type-safe values from our central definition.
  { action: "MANAGE", resource: "DOCUMENT" }
);

/**
 * POST /api/documents
 * Creates a new Document. This is part of 'managing' documents.
 */
export const POST = withAuthorization(
  async function POST(
    request: NextRequest,
    _context,
    session: ExtendedSession
  ) {
    try {
      const rawBody = await request.json();
      const validation = apiCreateDocumentSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body for creating a document.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { journalId, ...documentData } = validation.data;
      const newDocument = await documentService.createDocument(
        documentData as CreateDocumentData,
        session.user!.id,
        journalId
      );

      const body = JSON.stringify(newDocument, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      console.error("API POST /api/documents Error:", e);
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  // CORRECTED: Creating a document falls under the 'MANAGE' permission.
  // This aligns with our central definition and simplifies the permission model.
  { action: "MANAGE", resource: "DOCUMENT" }
);
