//src/app/api/documents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import {
  authOptions,
  ExtendedSession,
  ExtendedUser,
} from "@/lib/auth/authOptions";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";
// REMOVED: withAuthorization is no longer used here.
import documentService, {
  createDocumentSchema,
} from "@/app/services/documentService";
import { ZodError } from "zod";

// --- GET Handler (Now Fully Public) ---
export async function GET(request: NextRequest) {
  // REMOVED: Manual session check is gone.

  const { searchParams } = new URL(request.url);
  const partnerIdStr = searchParams.get("partnerId");

  if (!partnerIdStr) {
    return NextResponse.json(
      { message: "Missing required 'partnerId' query parameter." },
      { status: 400 }
    );
  }

  const partnerId = parseBigIntParam(partnerIdStr, "partnerId");
  if (partnerId === null) {
    return NextResponse.json(
      { message: "Invalid 'partnerId' format." },
      { status: 400 }
    );
  }

  try {
    const result = await documentService.getDocuments({ partnerId });
    const body = JSON.stringify(
      { data: result.documents, total: result.totalCount },
      jsonBigIntReplacer
    );
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API /documents GET Error:", error);
    return NextResponse.json(
      { message: "Failed to retrieve documents." },
      { status: 500 }
    );
  }
}

// --- POST Handler (Requires Authentication, Not Authorization) ---
export async function POST(request: NextRequest) {
  // MODIFIED: Manually get session for authentication.
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  // This check is for AUTHENTICATION, which is required.
  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "Authentication is required to perform this action." },
      { status: 401 }
    );
  }

  const createdById = session.user.id;
  const createdByIp =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  try {
    const rawData = await request.json();
    const validation = createDocumentSchema.safeParse(rawData);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid document payload.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const newDocument = await documentService.createDocument(
      validation.data,
      createdById,
      createdByIp
    );

    const body = JSON.stringify(newDocument, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API /documents POST Error:", error);
    if (error instanceof ZodError) {
      return NextResponse.json(
        { message: "Validation error.", errors: error.format() },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Failed to create document." },
      { status: 500 }
    );
  }
}
