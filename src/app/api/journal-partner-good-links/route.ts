// File: src/app/api/journal-partner-good-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import jpgLinkService, {
  CreateJPGLData,
  OrchestratedCreateJPGLSchema,
} from "@/app/services/journalPartnerGoodLinkService";
import { z } from "zod";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedUser } from "@/lib/authOptions"; // Import ExtendedUser from its actual location

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

  if (!user?.companyId) {
    return NextResponse.json(
      { message: "Unauthorized or company not found for user" },
      { status: 401 }
    );
  }
  const companyId = user.companyId;

  console.log(
    "Waiter (API /jp-good-links): Customer wants to create a 3-way link (orchestrated)."
  );
  try {
    const rawOrder = await request.json();

    // Validate the incoming payload against the client-only schema
    const validation = ClientPayloadSchema.safeParse(rawOrder);

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

    // Now, create the full data object for the service, combining client data with server data.
    const serviceData = {
      ...validation.data, // The clean, validated data from the client
      companyId: companyId, // The secure, server-side companyId
    };

    // Pass the complete, correct object to the service.
    // The service's internal validation will now pass.
    const newLink = await jpgLinkService.createFullJpgLink(serviceData);

    const body = JSON.stringify(newLink, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // This error handling is now more robust because it can catch errors from the service layer too.
    const e = error as Error & { code?: string; meta?: any };
    console.error(
      "Waiter (API /jp-good-links): Chef couldn't create 3-way link!",
      e.message,
      e
    );
    if (e instanceof z.ZodError) {
      // This would catch a mismatch between what the API sends and what the service expects.
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
