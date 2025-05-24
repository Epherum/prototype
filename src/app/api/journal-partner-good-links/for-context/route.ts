// src/app/api/journal-partner-good-links/for-context/route.ts (NEW FILE)
import { NextRequest, NextResponse } from "next/server";
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";
import { z } from "zod";

const querySchema = z.object({
  goodId: z.string().min(1),
  journalId: z.string().min(1),
  // partnershipType: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = {
    goodId: searchParams.get("goodId"),
    journalId: searchParams.get("journalId"),
    // partnershipType: searchParams.get("partnershipType"),
  };

  const validation = querySchema.safeParse(params);
  if (!validation.success) {
    return NextResponse.json(
      {
        message: "Invalid query parameters",
        errors: validation.error.format(),
      },
      { status: 400 }
    );
  }

  const goodId = parseBigIntParam(validation.data.goodId, "goodId");
  if (!goodId) {
    return NextResponse.json(
      { message: "Invalid goodId format" },
      { status: 400 }
    );
  }

  try {
    const links = await jpgLinkService.getJpglsForGoodAndJournalContext(
      goodId,
      validation.data.journalId
      // validation.data.partnershipType
    );
    const body = JSON.stringify(links, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error("[API JPGL for-context GET] Error:", e);
    return NextResponse.json(
      { message: "Could not fetch links for context.", error: e.message },
      { status: 500 }
    );
  }
}
