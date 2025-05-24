// File: src/app/api/goods/route.ts
import { NextRequest, NextResponse } from "next/server";
import goodsService, { CreateGoodsData } from "@/app/services/goodsService";
import { z } from "zod";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt"; // Our BigInt helper
import journalGoodLinkService from "@/app/services/journalGoodLinkService"; // Import the new service
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService"; // Import the new service

// Waiter's checklist for "Create New Good/Service"
const createGoodsSchema = z.object({
  label: z.string().min(1, "Label is required").max(255),
  referenceCode: z.string().max(50).optional().nullable(),
  barcode: z.string().max(50).optional().nullable(),
  taxCodeId: z.number().int().positive().optional().nullable(),
  typeCode: z.string().max(25).optional().nullable(),
  description: z.string().optional().nullable(),
  unitCodeId: z.number().int().positive().optional().nullable(),
  stockTrackingMethod: z.string().max(50).optional().nullable(),
  packagingTypeCode: z.string().max(25).optional().nullable(),
  photoUrl: z.string().url("Invalid photo URL").optional().nullable(),
  additionalDetails: z.any().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const typeCode = searchParams.get("typeCode") || undefined;
  const forJournalIdsParam = searchParams.get("forJournalIds");
  const forPartnerIdStr = searchParams.get("forPartnerId");
  const includeJournalChildrenParam = searchParams.get(
    "includeJournalChildren"
  );
  const linkedToPartnerIdStr = searchParams.get("linkedToPartnerId");
  // const linkedToJournalIdParam = searchParams.get("linkedToJournalId"); // Old single ID
  const linkedToJournalIdsParam = searchParams.get("linkedToJournalIds"); // +++ NEW: Plural for J-G flow

  try {
    // Scenario: J-P-G (Journal(s) -> Partner -> Good)
    if (forJournalIdsParam && forPartnerIdStr) {
      // ... (this logic remains as previously updated for multi-journal)
      console.log(
        `API /goods: Fetching goods for Journal(s) '${forJournalIdsParam}' AND Partner '${forPartnerIdStr}'.`
      );
      const journalIds = forJournalIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id);
      if (journalIds.length === 0)
        return NextResponse.json(
          { message: "No valid journal IDs in forJournalIds." },
          { status: 400 }
        );
      const partnerId = parseBigIntParam(forPartnerIdStr, "forPartnerId");
      if (partnerId === null)
        return NextResponse.json(
          { message: "Invalid forPartnerId." },
          { status: 400 }
        );
      const includeChildren = includeJournalChildrenParam !== "false";
      const goodsArray = await jpgLinkService.getGoodsForJournalsAndPartner(
        journalIds,
        partnerId,
        includeChildren
      );
      return new NextResponse(
        JSON.stringify(
          { data: goodsArray, total: goodsArray.length },
          jsonBigIntReplacer
        ),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    // Scenario: Filter by Partner ID only (P-G flow, uses jpgLinkService)
    else if (linkedToPartnerIdStr) {
      // ... (this logic remains)
      console.log(
        `API /goods: Fetching goods linked to partner '${linkedToPartnerIdStr}'.`
      );
      const partnerId = parseBigIntParam(
        linkedToPartnerIdStr,
        "linkedToPartnerId"
      );
      if (partnerId === null)
        return NextResponse.json(
          { message: "Invalid linkedToPartnerId." },
          { status: 400 }
        );
      const goodIds = await jpgLinkService.getGoodIdsForPartner(partnerId);
      if (goodIds.length === 0)
        return NextResponse.json({ data: [], total: 0 });
      const { goods, totalCount } = await goodsService.getAllGoods({
        where: { id: { in: goodIds } },
      });
      return new NextResponse(
        JSON.stringify({ data: goods, total: totalCount }, jsonBigIntReplacer),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    // Scenario: Filter by Journal ID(s) only (J-G flow, uses journalGoodLinkService) +++ MODIFIED +++
    else if (linkedToJournalIdsParam) {
      console.log(
        `API /goods: Fetching goods linked to journal(s) '${linkedToJournalIdsParam}'.`
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
      const includeChildren = includeJournalChildrenParam === "true"; // Default to false if not specified?
      // Use the modified service method
      const goodsArray = await journalGoodLinkService.getGoodsForJournals(
        journalIds,
        includeChildren
      );
      const body = JSON.stringify(
        { data: goodsArray, total: goodsArray.length },
        jsonBigIntReplacer
      );
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Scenario: Get all goods with optional pagination
    else {
      const limitParam = searchParams.get("limit");
      const offsetParam = searchParams.get("offset");
      const take = limitParam ? parseInt(limitParam, 10) : undefined;
      const skip = offsetParam ? parseInt(offsetParam, 10) : undefined;

      console.log(
        `API /goods: Fetching all goods. Limit: ${take}, Offset: ${skip}, TypeCode: ${typeCode}`
      );
      const { goods, totalCount } = await goodsService.getAllGoods({
        typeCode,
        take,
        skip,
      });
      const responsePayload = { data: goods, total: totalCount };
      const body = JSON.stringify(responsePayload, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    const e = error as Error;
    // Simplified error handling, more specific checks can be added
    if (
      e.message.includes("Invalid BigInt") ||
      (e.cause as any)?.message?.includes("Invalid BigInt")
    ) {
      return NextResponse.json(
        { message: "Invalid ID format provided.", error: e.message },
        { status: 400 }
      );
    }
    console.error("API /goods GET Error:", e.message, e.stack);
    return NextResponse.json(
      { message: "Failed to fetch goods.", error: e.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log("Waiter (API /goods): Customer wants to add a new good/service.");
  try {
    const rawOrder = await request.json();
    console.log(
      "Waiter (API /goods): Customer's raw order for new good:",
      rawOrder
    );

    const validation = createGoodsSchema.safeParse(rawOrder);
    if (!validation.success) {
      console.warn(
        "Waiter (API /goods): Customer's order for new good is invalid:",
        validation.error.format()
      );
      return NextResponse.json(
        {
          message: "Order for new good is unclear.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const validOrderData = validation.data as CreateGoodsData;
    console.log(
      "Waiter (API /goods): Order for new good is clear. Passing to Chef."
    );

    const newGood = await goodsService.createGood(validOrderData);
    console.log(
      "Waiter (API /goods): Chef added the new good! Preparing for customer."
    );
    const body = JSON.stringify(newGood, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error(
      "Waiter (API /goods): Chef couldn't add new good!",
      e.message
    );
    // Prisma unique constraint errors (like for referenceCode or barcode) have code P2002
    if ((e as any)?.code === "P2002") {
      return NextResponse.json(
        {
          message:
            "Failed to create good. A similar item (e.g., same reference code or barcode) might already exist.",
          error: e.message,
          errorCode: "P2002",
        },
        { status: 409 }
      ); // Conflict
    }
    if (e.message.includes("not found")) {
      // For FK violations like TaxCode not found
      return NextResponse.json(
        { message: "Failed to create good.", error: e.message },
        { status: 400 }
      ); // Bad request
    }
    return NextResponse.json(
      { message: "Chef couldn't add the new good.", error: e.message },
      { status: 500 }
    );
  }
}
