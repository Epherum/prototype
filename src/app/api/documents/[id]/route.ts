// src/app/api/documents/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import documentService, {
  UpdateDocumentData,
  updateDocumentSchema,
} from "@/app/services/documentService";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";

type RouteContext = { params: { id: string } };

/**
 * GET /api/documents/[id]
 * Fetches a single, detailed document for the "Gateway Lookup" view.
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
      console.error(`API GET /api/documents/${params.id} Error:`, e);
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
      console.error(`API PUT /api/documents/${params.id} Error:`, e);

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
 * This performs a soft delete as per the service logic.
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
      console.error(`API DELETE /api/documents/${params.id} Error:`, e);

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
