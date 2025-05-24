// File: src/app/api/partners/route.ts
import { NextRequest, NextResponse } from "next/server";
import partnerService, {
  CreatePartnerData,
} from "@/app/services/partnerService";
import { z } from "zod";
import { PartnerType } from "@prisma/client";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt"; // Verify this path
import journalPartnerLinkService from "@/app/services/journalPartnerLinkService";
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService";

const createPartnerSchema = z.object({
  name: z.string().min(1, "Partner name is required").max(255),
  partnerType: z.nativeEnum(PartnerType),
  notes: z.string().optional().nullable(),
  logoUrl: z.string().url("Invalid logo URL format").optional().nullable(),
  photoUrl: z.string().url("Invalid photo URL format").optional().nullable(),
  isUs: z.boolean().optional().nullable(),
  registrationNumber: z.string().max(100).optional().nullable(),
  taxId: z.string().max(100).optional().nullable(),
  bioFatherName: z.string().max(100).optional().nullable(),
  bioMotherName: z.string().max(100).optional().nullable(),
  additionalDetails: z.any().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partnerTypeParam = searchParams.get(
    "partnerType"
  ) as PartnerType | null;
  const linkedToJournalIdsParam = searchParams.get("linkedToJournalIds"); // Plural
  const includeChildrenParam = searchParams.get("includeChildren");
  const linkedToGoodIdStr = searchParams.get("linkedToGoodId");

  try {
    // Scenario: Filter by Journal(s) AND Good (J-G-P flow) +++ MODIFIED +++
    if (linkedToJournalIdsParam && linkedToGoodIdStr) {
      console.log(
        `Waiter (API /partners): Customer wants partners for Journal(s) '${linkedToJournalIdsParam}' AND Good '${linkedToGoodIdStr}'.`
      );
      const journalIds = linkedToJournalIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id);
      if (journalIds.length === 0) {
        return NextResponse.json(
          { message: "No valid journal IDs provided in linkedToJournalIds." },
          { status: 400 }
        );
      }
      const goodId = parseBigIntParam(linkedToGoodIdStr, "linkedToGoodId");
      if (goodId === null) {
        return NextResponse.json(
          { message: "Invalid linkedToGoodId format." },
          { status: 400 }
        );
      }

      const includeChildren = includeChildrenParam !== "false"; // Default to true if param not 'false'

      // Use the modified service method
      const partnerIds = await jpgLinkService.getPartnerIdsForJournalsAndGood(
        journalIds,
        goodId,
        includeChildren
      );

      if (partnerIds.length === 0) {
        return NextResponse.json({ data: [], total: 0 }, { status: 200 });
      }
      const { partners, totalCount } = await partnerService.getAllPartners({
        where: { id: { in: partnerIds } }, // Fetch full partner details for these IDs
      });
      const body = JSON.stringify(
        { data: partners, total: totalCount },
        jsonBigIntReplacer
      );
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Scenario: Filter by Good ID only
    else if (linkedToGoodIdStr) {
      // ... (this part remains largely the same as it doesn't involve multiple journal IDs)
      console.log(
        `Waiter (API /partners): Customer wants partners linked to good '${linkedToGoodIdStr}'.`
      );
      const goodId = parseBigIntParam(linkedToGoodIdStr, "linkedToGoodId");
      if (goodId === null)
        return NextResponse.json(
          { message: "Invalid linkedToGoodId." },
          { status: 400 }
        );
      const partnerIds = await jpgLinkService.getPartnerIdsForGood(goodId);
      if (partnerIds.length === 0)
        return NextResponse.json({ data: [], total: 0 });
      const { partners, totalCount } = await partnerService.getAllPartners({
        where: { id: { in: partnerIds } },
      });
      return new NextResponse(
        JSON.stringify(
          { data: partners, total: totalCount },
          jsonBigIntReplacer
        ),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    // Scenario: Filter by Journal ID(s) only +++ MODIFIED +++
    else if (linkedToJournalIdsParam) {
      console.log(
        `Waiter (API /partners): Customer wants partners linked to journal(s) '${linkedToJournalIdsParam}'.`
      );
      const journalIds = linkedToJournalIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id);
      if (journalIds.length === 0) {
        return NextResponse.json(
          { message: "No valid journal IDs provided in linkedToJournalIds." },
          { status: 400 }
        );
      }
      const includeChildren = includeChildrenParam === "true";

      // Use the modified service method
      const partnersFromJournalLink =
        await journalPartnerLinkService.getPartnersForJournals(
          journalIds,
          includeChildren
        );
      const body = JSON.stringify(
        {
          data: partnersFromJournalLink,
          total: partnersFromJournalLink.length,
        }, // Still assuming direct array return
        jsonBigIntReplacer
      );
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      // General partner fetching with pagination
      const limitParam = searchParams.get("limit");
      const offsetParam = searchParams.get("offset");

      const take = limitParam ? parseInt(limitParam, 10) : undefined;
      const skip = offsetParam ? parseInt(offsetParam, 10) : undefined;

      console.log(
        `Waiter (API /partners): Customer wants the list of partners. Limit: ${take}, Offset: ${skip}, Type: ${partnerTypeParam}`
      );

      const serviceOptions: {
        partnerType?: PartnerType;
        take?: number;
        skip?: number;
      } = {};

      if (
        partnerTypeParam &&
        Object.values(PartnerType).includes(partnerTypeParam)
      ) {
        serviceOptions.partnerType = partnerTypeParam;
      }
      if (take !== undefined && !isNaN(take) && take > 0) {
        serviceOptions.take = take;
      }
      if (skip !== undefined && !isNaN(skip) && skip >= 0) {
        serviceOptions.skip = skip;
      }

      const { partners, totalCount } = await partnerService.getAllPartners(
        serviceOptions
      );
      const responsePayload = { data: partners, total: totalCount };
      const body = JSON.stringify(responsePayload, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    const e = error as Error;
    // Basic error handling for BigInt conversion, can be made more specific
    if (
      e.message.includes("Cannot convert") &&
      e.message.includes("to a BigInt")
    ) {
      return NextResponse.json(
        { message: "Invalid ID format provided.", error: e.message },
        { status: 400 }
      );
    }
    console.error("API /partners GET Error:", e.message, e.stack);
    return NextResponse.json(
      { message: "Chef couldn't get the partner list.", error: e.message },
      { status: 500 }
    );
  }
}

// POST handler remains the same
export async function POST(request: NextRequest) {
  console.log("Waiter (API /partners): Customer wants to add a new partner.");
  try {
    const rawOrder = await request.json();
    console.log(
      "Waiter (API /partners): Customer's raw order for new partner:",
      rawOrder
    );

    const validation = createPartnerSchema.safeParse(rawOrder);
    if (!validation.success) {
      console.warn(
        "Waiter (API /partners): Customer's order for new partner is unclear/invalid:",
        validation.error.format()
      );
      return NextResponse.json(
        {
          message: "Order for new partner is unclear.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const validOrderData = validation.data as CreatePartnerData;
    console.log(
      "Waiter (API /partners): Order for new partner is clear. Passing to Chef."
    );

    const newPartner = await partnerService.createPartner(validOrderData);
    const body = JSON.stringify(newPartner, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error(
      "Waiter (API /partners): Chef couldn't add new partner!",
      e.message
    );
    return NextResponse.json(
      { message: "Chef couldn't add the new partner.", error: e.message },
      { status: 500 }
    );
  }
}
