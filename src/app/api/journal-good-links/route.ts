// File: src/app/api/journal-good-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import journalGoodLinkService, {
  CreateJournalGoodLinkData,
} from "@/app/services/journalGoodLinkService";
import { z } from "zod";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";

const createLinkSchema = z.object({
  journalId: z.string().min(1),
  goodId: z.preprocess(
    (val) =>
      typeof val === "string" || typeof val === "number" ? BigInt(val) : val,
    z.bigint()
  ),
  // Add other fields if your CreateJournalGoodLinkData type has them
});

export async function POST(request: NextRequest) {
  console.log(
    "Waiter (API /journal-good-links): Customer wants to link a journal and good."
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

    const validOrderData = validation.data as CreateJournalGoodLinkData;
    // Ensure BigInt conversion for goodId
    if (
      typeof validOrderData.goodId === "string" ||
      typeof validOrderData.goodId === "number"
    ) {
      validOrderData.goodId = BigInt(validOrderData.goodId);
    }

    const newLink = await journalGoodLinkService.createLink(validOrderData);
    const body = JSON.stringify(newLink, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error(
      "Waiter (API /journal-good-links): Chef couldn't create link!",
      e.message
    );
    if (e.message.includes("not found")) {
      return NextResponse.json(
        {
          message: "Failed to create link: Journal or Good/Service not found.",
          error: e.message,
        },
        { status: 404 }
      );
    }
    if ((e as any)?.code === "P2002") {
      // Prisma unique constraint error
      return NextResponse.json(
        {
          message:
            "Failed to create link. This Journal-Good link already exists.",
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

// Optional: GET all links for JournalGoodLink
// export async function GET(request: NextRequest) { ... }
