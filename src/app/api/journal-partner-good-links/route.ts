// File: src/app/api/journal-partner-good-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import jpgLinkService, {
  CreateJPGLData,
  OrchestratedCreateJPGLSchema,
} from "@/app/services/journalPartnerGoodLinkService";
import { z } from "zod";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";

const createJPGLSchema = z.object({
  journalPartnerLinkId: z.preprocess(
    (val) =>
      typeof val === "string" || typeof val === "number" ? BigInt(val) : val,
    z.bigint()
  ),
  goodId: z.preprocess(
    (val) =>
      typeof val === "string" || typeof val === "number" ? BigInt(val) : val,
    z.bigint()
  ),
  descriptiveText: z.string().optional().nullable(),
  contextualTaxCodeId: z.number().int().positive().optional().nullable(),
});

// Zod schema for client-side numbers/strings that need to be BigInt for the service
const ApiOrchestratedCreateJPGLSchema = OrchestratedCreateJPGLSchema.extend({
  partnerId: z
    .union([z.string(), z.number().int().positive()])
    .transform((v) => BigInt(v)), // Allow string from client for partnerId
  goodId: z
    .union([z.string(), z.number().int().positive()])
    .transform((v) => BigInt(v)), // Allow string from client for goodId
});

export async function POST(request: NextRequest) {
  console.log(
    "Waiter (API /jp-good-links): Customer wants to create a 3-way link (orchestrated)."
  );
  try {
    const rawOrder = await request.json();
    const validation = ApiOrchestratedCreateJPGLSchema.safeParse(rawOrder);

    if (!validation.success) {
      console.error("Validation errors:", validation.error.format());
      return NextResponse.json(
        {
          message: "3-way link order is unclear.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    // The data is already transformed to include BigInts by Zod's .transform
    const newLink = await jpgLinkService.createFullJpgLink(validation.data);
    const body = JSON.stringify(newLink, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error & { code?: string; meta?: any }; // Add code and meta for Prisma errors
    console.error(
      "Waiter (API /jp-good-links): Chef couldn't create 3-way link!",
      e.message,
      e.code,
      e.stack
    );
    if (
      e.message.includes("not found") ||
      (e.code === "P2003" && e.meta?.field_name?.includes("goodId"))
    ) {
      // P2003 is foreign key constraint
      return NextResponse.json(
        {
          message:
            "Failed to create link: Referenced Good, Partner, Journal, or Tax Code not found.",
          error: e.message,
        },
        { status: 404 } // Or 400 for bad reference
      );
    }
    if (e.code === "P2002") {
      // Prisma unique constraint error (likely on JPGL itself if JPL was created)
      return NextResponse.json(
        {
          message:
            "Failed to create link. This specific Journal-Partner-Good combination already exists.",
          error: e.message,
          errorCode: "P2002",
        },
        { status: 409 } // Conflict
      );
    }
    return NextResponse.json(
      { message: "Chef couldn't create the 3-way link.", error: e.message },
      { status: 500 }
    );
  }
}

// GET for specific JPL ID to fetch its associated goods (via JPGL)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jplIdStr = searchParams.get("journalPartnerLinkId");

  if (jplIdStr) {
    try {
      const jplId = BigInt(jplIdStr);
      // const goods = await jpgLinkService.getGoodsForJournalPartnerLink(jplId); // Just goods
      const fullLinks = await jpgLinkService.getFullLinksForJPL(jplId); // Get full JPGL details for this JPL
      const body = JSON.stringify(fullLinks, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return NextResponse.json(
        {
          message:
            "Invalid journalPartnerLinkId format or error fetching links.",
          error: (e as Error).message,
        },
        { status: 400 }
      );
    }
  }
  return NextResponse.json(
    { message: "Missing journalPartnerLinkId query parameter." },
    { status: 400 }
  );
}
