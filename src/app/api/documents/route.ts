// src/app/api/documents/route.ts

import { NextRequest, NextResponse } from "next/server";
import documentService, {
  CreateDocumentData,
} from "@/app/services/documentService";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";
import {
  getDocumentsQuerySchema,
  apiCreateDocumentSchema,
} from "@/lib/schemas/document.schema";
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/documents
 * Fetches documents based on various query parameters.
 * Supports pagination, filtering by journal IDs, partner IDs, and good IDs.
 * Applies user's journal restriction if present.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @param {object} _context - The context object (unused).
 * @param {ExtendedSession} session - The authenticated user's session.
 * @queryparam {number} [take] - Number of records to take (for pagination).
 * @queryparam {number} [skip] - Number of records to skip (for pagination).
 * @queryparam {string} [filterByJournalIds] - Comma-separated list of journal IDs to filter by.
 * @queryparam {string} [filterByPartnerIds] - Comma-separated list of partner IDs to filter by.
 * @queryparam {string} [filterByGoodIds] - Comma-separated list of good IDs to filter by.
 * @returns {NextResponse} A JSON response containing a paginated list of documents.
 * @status 200 - OK: Documents successfully fetched.
 * @status 400 - Bad Request: Invalid query parameters.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission MANAGE_DOCUMENT - Requires 'MANAGE' action on 'DOCUMENT' resource.
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
      apiLogger.error("API GET /api/documents Error", { error: e.message, stack: e.stack });
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
 * Creates a new Document.
 * @param {NextRequest} request - The incoming Next.js request object containing the document creation payload.
 * @param {object} _context - The context object (unused).
 * @param {ExtendedSession} session - The authenticated user's session, used to record `createdById`.
 * @body {object} - The document creation data.
 * @body {string} body.journalId - The ID of the journal the document belongs to.
 * @body {CreateDocumentData} body - Other document fields as defined by `CreateDocumentData`.
 * @returns {NextResponse} A JSON response containing the newly created document.
 * @status 201 - Created: Document successfully created.
 * @status 400 - Bad Request: Invalid request body.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission MANAGE_DOCUMENT - Requires 'MANAGE' action on 'DOCUMENT' resource.
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

      const { journalId, partnerId, lines, ...documentData } = validation.data;
      
      // Convert string IDs to bigint for the service
      const createData: CreateDocumentData = {
        ...documentData,
        partnerId: BigInt(partnerId),
        lines: lines?.map(line => ({
          ...line,
          journalPartnerGoodLinkId: BigInt(line.journalPartnerGoodLinkId),
        })) || [],
      };

      const newDocument = await documentService.createDocument(
        createData,
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
      apiLogger.error("API POST /api/documents Error", { error: e.message, stack: e.stack });
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
