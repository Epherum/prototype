// src/app/api/documents/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import documentService, {
  UpdateDocumentData,
  updateDocumentSchema,
} from "@/app/services/documentService";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";
import { apiLogger } from "@/lib/logger";

type RouteContext = { params: { id: string } };

/**
 * GET /api/documents/[id]
 * Fetches a single, detailed document by its ID.
 * This endpoint is used for retrieving specific document details, often for a "Gateway Lookup" view.
 * @param {NextRequest} _request - The incoming Next.js request object.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the document to fetch (can be a string representation of BigInt).
 * @returns {NextResponse} A JSON response containing the document data if found, or an error message.
 * @status 200 - OK: Document found and returned.
 * @status 400 - Bad Request: Invalid document ID format.
 * @status 404 - Not Found: Document with the specified ID does not exist.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission MANAGE_DOCUMENT - Requires 'MANAGE' action on 'DOCUMENT' resource.
 */
export const GET = withAuthorization(
  async function GET(_request: NextRequest, { params }: RouteContext) {
    try {
      const docId = parseBigInt(params.id, "document ID");
      if (docId === null) {
        return NextResponse.json(
          { message: `Invalid document ID format: '${params.id}'.` },
          { status: 400 }
        );
      }

      const document = await documentService.getDocumentById(docId);
      if (!document) {
        return NextResponse.json(
          { message: `Document with ID '${params.id}' not found.` },
          { status: 404 }
        );
      }

      const body = JSON.stringify(document, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      apiLogger.error(`API GET /api/documents/${params.id} Error:`, e);
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "MANAGE", resource: "DOCUMENT" }
);

/**
 * PUT /api/documents/[id]
 * Updates an existing document by its ID.
 * @param {NextRequest} request - The incoming Next.js request object containing the update payload.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the document to update (can be a string representation of BigInt).
 * @body {UpdateDocumentData} - The document fields to update.
 * @returns {NextResponse} A JSON response containing the updated document data or an error message.
 * @status 200 - OK: Document successfully updated.
 * @status 400 - Bad Request: Invalid document ID format or invalid request body.
 * @status 404 - Not Found: Document with the specified ID does not exist for update.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission MANAGE_DOCUMENT - Requires 'MANAGE' action on 'DOCUMENT' resource.
 */
export const PUT = withAuthorization(
  async function PUT(request: NextRequest, { params }: RouteContext) {
    try {
      const docId = parseBigInt(params.id, "document ID");
      if (docId === null) {
        return NextResponse.json(
          { message: `Invalid document ID format: '${params.id}'.` },
          { status: 400 }
        );
      }

      const rawBody = await request.json();
      const validation = updateDocumentSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body for update.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const updatedDocument = await documentService.updateDocument(
        docId,
        validation.data as UpdateDocumentData
      );

      const body = JSON.stringify(updatedDocument, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error & { code?: string };
      apiLogger.error(`API PUT /api/documents/${params.id} Error:`, e);

      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Document with ID '${params.id}' not found for update.` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "MANAGE", resource: "DOCUMENT" }
);

/**
 * DELETE /api/documents/[id]
 * Soft deletes a document by its ID. The document's `entityState` is set to 'DELETED'.
 * @param {NextRequest} _request - The incoming Next.js request object.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the document to delete (can be a string representation of BigInt).
 * @param {ExtendedSession} session - The authenticated user's session, used to record `deletedById`.
 * @returns {NextResponse} A JSON response indicating success or an error message.
 * @status 200 - OK: Document successfully soft deleted.
 * @status 400 - Bad Request: Invalid document ID format.
 * @status 404 - Not Found: Document with the specified ID does not exist for deletion.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission MANAGE_DOCUMENT - Requires 'MANAGE' action on 'DOCUMENT' resource.
 */
export const DELETE = withAuthorization(
  async function DELETE(
    _request: NextRequest,
    { params }: RouteContext,
    session: ExtendedSession
  ) {
    try {
      const docId = parseBigInt(params.id, "document ID");
      if (docId === null) {
        return NextResponse.json(
          { message: `Invalid document ID format: '${params.id}'.` },
          { status: 400 }
        );
      }

      await documentService.deleteDocument(docId, session.user!.id);
      return NextResponse.json(
        { message: `Document with ID '${params.id}' successfully deleted.` },
        { status: 200 }
      );
    } catch (error) {
      const e = error as Error & { code?: string };
      apiLogger.error(`API DELETE /api/documents/${params.id} Error:`, e);

      if (e.code === "P2025") {
        return NextResponse.json(
          {
            message: `Document with ID '${params.id}' not found for deletion.`,
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "MANAGE", resource: "DOCUMENT" }
);
