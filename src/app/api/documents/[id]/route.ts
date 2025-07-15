//src/app/api/documents/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import {
  authOptions,
  ExtendedSession,
  ExtendedUser,
} from "@/lib/auth/authOptions";
import { ZodError } from "zod";
import documentService, {
  updateDocumentSchema,
} from "@/app/services/documentService";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";
import prisma from "@/app/utils/prisma";

// --- GET Handler (Now Fully Public) ---
export async function GET(
  req: NextRequest,
  // MODIFIED: The 'params' object is now wrapped in a Promise as required by the build system.
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  // ADDED: Await the promise to get the actual parameters.
  const { id } = await paramsPromise;

  const documentId = parseBigIntParam(id, "id");
  if (documentId === null) {
    return NextResponse.json(
      { message: "Invalid document ID format." },
      { status: 400 }
    );
  }

  try {
    const document = await documentService.getDocumentById(documentId);
    if (!document) {
      return NextResponse.json(
        { message: "Document not found." },
        { status: 404 }
      );
    }
    const body = JSON.stringify(document, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`API /documents/${id} GET Error:`, error);
    return NextResponse.json(
      { message: "Failed to retrieve document." },
      { status: 500 }
    );
  }
}

// --- PUT Handler (Now Fully Public) ---
export async function PUT(
  request: NextRequest,
  // MODIFIED: The 'params' object is now wrapped in a Promise.
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  // ADDED: Await the promise to get the actual parameters.
  const { id } = await paramsPromise;

  const documentId = parseBigIntParam(id, "id");
  if (documentId === null) {
    return NextResponse.json(
      { message: "Invalid document ID format." },
      { status: 400 }
    );
  }

  try {
    const rawData = await request.json();
    const validation = updateDocumentSchema.safeParse(rawData);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid document payload.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const updatedDocument = await documentService.updateDocument(
      documentId,
      validation.data
    );
    const body = JSON.stringify(updatedDocument, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`API /documents/${id} PUT Error:`, error);
    if (error instanceof ZodError) {
      return NextResponse.json(
        { message: "Validation error.", errors: error.format() },
        { status: 400 }
      );
    }
    if ((error as any).code === "P2025") {
      return NextResponse.json(
        { message: "Document to update not found." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: "Failed to update document." },
      { status: 500 }
    );
  }
}

// --- DELETE Handler (Requires Authentication, Not Authorization) ---
export async function DELETE(
  request: NextRequest,
  // MODIFIED: The 'params' object is now wrapped in a Promise.
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  // ADDED: Await the promise to get the actual parameters.
  const { id } = await paramsPromise;

  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  if (!session?.user) {
    return NextResponse.json(
      { message: "Authentication is required to perform this action." },
      { status: 401 }
    );
  }

  const documentId = parseBigIntParam(id, "id");
  if (documentId === null) {
    return NextResponse.json(
      { message: "Invalid document ID format." },
      { status: 400 }
    );
  }

  try {
    // Fetch the full user data from the database for the audit trail
    const fullUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!fullUser) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    await documentService.deleteDocument(documentId, fullUser);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`API /documents/${id} DELETE Error:`, error);
    if ((error as any).code === "P2025") {
      return NextResponse.json(
        { message: "Document to delete not found." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: "Failed to delete document." },
      { status: 500 }
    );
  }
}
