// File: src/app/api/journal-partner-good-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService";
import { z } from "zod";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedUser } from "@/lib/authOptions";

// Define a schema for what we EXPECT FROM THE CLIENT.
// It should NOT include server-side data like companyId.
const ClientPayloadSchema = z.object({
  journalId: z.string().min(1, "Journal ID is required"),
  partnerId: z
    .union([z.string(), z.number().int().positive()])
    .transform((v) => BigInt(v)), // Allow string from client for partnerId
  goodId: z
    .union([z.string(), z.number().int().positive()])
    .transform((v) => BigInt(v)), // Allow string from client for goodId
  partnershipType: z.string().optional().default("STANDARD_TRANSACTION"),
  descriptiveText: z.string().optional().nullable(),
  contextualTaxCodeId: z.number().int().positive().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as ExtendedUser | undefined;

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  console.log("API /jp-good-links: Received request to create a 3-way link.");
  try {
    const rawOrder = await request.json();

    const validation = ClientPayloadSchema.safeParse(rawOrder);

    if (!validation.success) {
      console.error("Validation errors:", validation.error.format());
      return NextResponse.json(
        {
          message: "Invalid payload for 3-way link.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    // The service data is now just the validated client payload.
    // The service will no longer expect a companyId.
    const serviceData = validation.data;

    const newLink = await jpgLinkService.createFullJpgLink(serviceData);

    const body = JSON.stringify(newLink, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error & { code?: string; meta?: any };
    console.error(
      "API /jp-good-links: Failed to create 3-way link!",
      e.message,
      e
    );
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Internal data shaping error.", error: e.format() },
        { status: 500 }
      );
    }
    if (
      e.message.includes("not found") ||
      (e.code === "P2003" && e.meta?.field_name?.includes("goodId"))
    ) {
      return NextResponse.json(
        {
          message:
            "Failed to create link: Referenced Good, Partner, Journal, or Tax Code not found.",
          error: e.message,
        },
        { status: 404 }
      );
    }
    if (e.code === "P2002") {
      return NextResponse.json(
        {
          message:
            "Failed to create link. This specific Journal-Partner-Good combination already exists.",
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

// GET for specific JPL ID to fetch its associated goods (via JPGL)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jplIdStr = searchParams.get("journalPartnerLinkId");

  if (jplIdStr) {
    try {
      const jplId = BigInt(jplIdStr);
      // Assuming jpgLinkService is refactored and no longer needs company context
      const fullLinks = await jpgLinkService.getFullLinksForJPL(jplId);
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
