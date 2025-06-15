// File: src/app/api/journal-partner-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import journalPartnerLinkService, {
  CreateJournalPartnerLinkData,
} from "@/app/services/journalPartnerLinkService";
import { z } from "zod";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession } from "@/lib/auth/authOptions";

const createLinkSchema = z.object({
  journalId: z.string().min(1),
  partnerId: z.preprocess(
    (val) =>
      typeof val === "string" || typeof val === "number" ? BigInt(val) : val,
    z.bigint()
  ),
  partnershipType: z.string().max(50).optional().nullable(),
  exoneration: z.boolean().optional().nullable(),
  periodType: z.string().max(50).optional().nullable(),
  dateDebut: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  dateFin: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  documentReference: z.string().max(200).optional().nullable(),
});

export async function POST(request: NextRequest) {
  console.log(
    "API /journal-partner-links: Received request to link journal and partner."
  );
  try {
    // --- AUTH ---
    const session = (await getServerSession(
      authOptions
    )) as ExtendedSession | null;
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Unauthorized: User session is missing." },
        { status: 401 }
      );
    }
    // --- END AUTH ---

    const rawOrder = await request.json();
    const validation = createLinkSchema.safeParse(rawOrder);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid link payload.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    // The validated data is ready for the service. No companyId needed.
    const validOrderData: CreateJournalPartnerLinkData = {
      journalId: validation.data.journalId,
      partnerId: validation.data.partnerId,
      ...validation.data,
    };

    const newLink = await journalPartnerLinkService.createLink(validOrderData);
    const body = JSON.stringify(newLink, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error(
      "API /journal-partner-links: Failed to create link!",
      e.message
    );
    if (e.message.includes("not found")) {
      return NextResponse.json(
        {
          message: "Failed to create link: Journal or Partner not found.",
          error: e.message,
        },
        { status: 404 }
      );
    }
    // Prisma unique constraint error (P2002)
    if ((e as any)?.code === "P2002") {
      return NextResponse.json(
        {
          message:
            "Failed to create link. This exact link (Journal, Partner, Type) might already exist.",
          error: e.message,
          errorCode: "P2002",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "An unexpected error occurred.", error: e.message },
      { status: 500 }
    );
  }
}
