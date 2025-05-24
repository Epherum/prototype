// File: src/app/api/journal-partner-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import journalPartnerLinkService, {
  CreateJournalPartnerLinkData,
} from "@/app/services/journalPartnerLinkService";
import { z } from "zod";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";

const createLinkSchema = z.object({
  journalId: z.string().min(1),
  partnerId: z.preprocess(
    // Preprocess to convert string/number to BigInt for validation
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
    "Waiter (API /journal-partner-links): Customer wants to link a journal and partner."
  );
  try {
    const rawOrder = await request.json();
    const validation = createLinkSchema.safeParse(rawOrder);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Link order is unclear.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const validOrderData = validation.data as CreateJournalPartnerLinkData; // Zod's output should match after transform
    // Ensure BigInt conversion for partnerId if not handled by Zod preprocess perfectly
    if (
      typeof validOrderData.partnerId === "string" ||
      typeof validOrderData.partnerId === "number"
    ) {
      validOrderData.partnerId = BigInt(validOrderData.partnerId);
    }

    const newLink = await journalPartnerLinkService.createLink(validOrderData);
    const body = JSON.stringify(newLink, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error(
      "Waiter (API /journal-partner-links): Chef couldn't create link!",
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
      { message: "Chef couldn't create the link.", error: e.message },
      { status: 500 }
    );
  }
}

// Optional: GET all links (can be very large, use with caution or add pagination/filters)
// export async function GET(request: NextRequest) { ... }
