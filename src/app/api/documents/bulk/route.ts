import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession } from "@/lib/auth/authOptions";
import documentService, {
  createDocumentSchema,
} from "@/app/services/documentService";
import { ZodError, z } from "zod";

// Schema for the bulk creation request body
const createBulkDocumentsSchema = z.object({
  documents: z
    .array(createDocumentSchema)
    .min(1, "The documents array cannot be empty."),
});

export async function POST(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  // Authentication check
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
    const validation = createBulkDocumentsSchema.safeParse(rawData);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid bulk document payload.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const createdCount = await documentService.createBulkDocuments(
      validation.data.documents,
      createdById,
      createdByIp
    );

    return NextResponse.json(
      { success: true, createdCount: createdCount },
      { status: 201 }
    );
  } catch (error) {
    console.error("API /documents/bulk POST Error:", error);
    if (error instanceof ZodError) {
      return NextResponse.json(
        { message: "Validation error.", errors: error.format() },
        { status: 400 }
      );
    }
    // Handle Prisma transaction errors or other potential issues
    return NextResponse.json(
      { message: "Failed to create documents." },
      { status: 500 }
    );
  }
}
