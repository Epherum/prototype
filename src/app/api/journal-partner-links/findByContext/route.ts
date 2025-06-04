// src/app/api/journal-partner-links/findByContext/route.ts
import { NextRequest, NextResponse } from "next/server";
import jplService from "@/app/services/journalPartnerLinkService"; // Your JPL service
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { z } from "zod";

const FindJPLQuerySchema = z.object({
  journalId: z.string(),
  partnerId: z.string(), // Client sends string, convert to BigInt
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  try {
    const queryParams = Object.fromEntries(searchParams.entries());
    const validation = FindJPLQuerySchema.safeParse(queryParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid query parameters",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }
    const { journalId, partnerId } = validation.data;

    const jpl = await jplService.findByJournalAndPartner(
      journalId,
      BigInt(partnerId)
    );

    if (!jpl) {
      return NextResponse.json(
        { message: "Journal-Partner link not found for the given context." },
        { status: 404 }
      );
    }

    const body = JSON.stringify(jpl, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error("API Error finding JPL by context:", e.message, e.stack);
    return NextResponse.json(
      { message: "Error finding Journal-Partner link.", error: e.message },
      { status: 500 }
    );
  }
}
