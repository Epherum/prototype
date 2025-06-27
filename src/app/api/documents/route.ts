// src/app/api/documents/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import {
  authOptions,
  ExtendedSession,
  ExtendedUser,
} from "@/lib/auth/authOptions";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import documentService, {
  createDocumentSchema,
} from "@/app/services/documentService";
import { ZodError } from "zod";

// --- GET Handler: List Documents ---
export async function GET(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

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

// --- POST Handler: Create a New Document ---
const postHandler = async (
  request: NextRequest,
  context: {}, // No params here, but needed for HOF
  session: ExtendedSession
) => {
  const createdById = (session.user as ExtendedUser).id;
  const createdByIp =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;

  try {
    const rawData = await request.json();

    // Use a reviver to handle BigInts from JSON string
    const dataWithBigInts = JSON.parse(
      JSON.stringify(rawData),
      (key, value) => {
        if (key === "partnerId" || key === "journalPartnerGoodLinkId") {
          try {
            return BigInt(value);
          } catch (e) {
            // Let Zod handle the error for better reporting
            return value;
          }
        }
        return value;
      }
    );

    const validation = createDocumentSchema.safeParse(dataWithBigInts);
    if (!validation.success) {
      console.warn(
        "API /documents: Invalid payload for new document:",
        validation.error.format()
      );
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
};

// Wrap the handler with authorization
export const POST = withAuthorization(postHandler, {
  action: "CREATE",
  resource: "PARTNER",
});
