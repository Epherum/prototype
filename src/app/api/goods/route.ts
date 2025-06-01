// File: src/app/api/goods/route.ts
import { NextRequest, NextResponse } from "next/server";
import goodsService, { CreateGoodsData } from "@/app/services/goodsService";
import { z } from "zod";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt"; // Our BigInt helper
import journalGoodLinkService from "@/app/services/journalGoodLinkService"; // Import the new service
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService"; // Import the new service
import { GoodsAndService, Prisma } from "@prisma/client"; // Added Prisma and GoodsAndService

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

  // New filters for Journal Root -> Goods scenario
  const filterStatus = searchParams.get("filterStatus") as
    | "affected"
    | "unaffected"
    | "all"
    | null;
  const contextJournalIdsForFilterStatus =
    searchParams.get("contextJournalIds");

  // Existing filters
  const typeCode = searchParams.get("typeCode") || undefined;
  const forJournalIdsParam = searchParams.get("forJournalIds"); // For J-P-G
  const forPartnerIdStr = searchParams.get("forPartnerId"); // For J-P-G
  const includeJournalChildrenParam = searchParams.get(
    "includeJournalChildren"
  ); // UI should resolve this
  const linkedToPartnerIdStr = searchParams.get("linkedToPartnerId"); // For P-G
  const linkedToJournalIdsParam = searchParams.get("linkedToJournalIds"); // For J-G

  // Pagination
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const take = limitParam ? parseInt(limitParam, 10) : undefined;
  const skip = offsetParam ? parseInt(offsetParam, 10) : undefined;

  // Base options for goodsService.getAllGoods
  const serviceCallOptions: {
    typeCode?: string;
    take?: number;
    skip?: number;
    where?: Prisma.GoodsAndServiceWhereInput;
    filterByAffectedJournals?: string[];
    filterByUnaffected?: boolean;
  } = { typeCode, take, skip };

  try {
    let goodsResult: { goods: GoodsAndService[]; totalCount: number } | null =
      null;

    // Priority 1: J-P-G (Journal(s) -> Partner -> Good)
    if (forJournalIdsParam && forPartnerIdStr) {
      console.log(
        `API /goods: J-P-G flow. Journals: '${forJournalIdsParam}', Partner: '${forPartnerIdStr}'.`
      );
      const journalIds = forJournalIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
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
      goodsResult = { goods: goodsArray, totalCount: goodsArray.length };
    }
    // Priority 2: P-G (Partner -> Good)
    else if (linkedToPartnerIdStr) {
      console.log(`API /goods: P-G flow. Partner: '${linkedToPartnerIdStr}'.`);
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
      if (goodIds.length === 0) {
        goodsResult = { goods: [], totalCount: 0 };
      } else {
        serviceCallOptions.where = { id: { in: goodIds } };
        goodsResult = await goodsService.getAllGoods(serviceCallOptions);
      }
    }
    // Priority 3: New Journal Root -> Goods filtering with "filterStatus"
    else if (filterStatus) {
      console.log(
        `API /goods: Journal Root flow with filterStatus: '${filterStatus}'.`
      );
      if (filterStatus === "unaffected") {
        serviceCallOptions.filterByUnaffected = true;
      } else if (filterStatus === "affected") {
        const journalIds =
          contextJournalIdsForFilterStatus
            ?.split(",")
            .map((id) => id.trim())
            .filter(Boolean) || [];
        serviceCallOptions.filterByAffectedJournals = journalIds;
      } else if (filterStatus === "all") {
        // "all" means no *additional* journal link filtering from this specific mechanism.
      } else {
        return NextResponse.json(
          { message: `Invalid filterStatus: ${filterStatus}` },
          { status: 400 }
        );
      }
      goodsResult = await goodsService.getAllGoods(serviceCallOptions);
    }
    // Priority 4: J-G (Journal(s) -> Good)
    else if (linkedToJournalIdsParam) {
      console.log(
        `API /goods: J-G flow. Journals: '${linkedToJournalIdsParam}'.`
      );
      const journalIds = linkedToJournalIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (journalIds.length === 0)
        return NextResponse.json(
          { message: "No valid journal IDs in linkedToJournalIds." },
          { status: 400 }
        );

      const includeChildren = includeJournalChildrenParam === "true"; // UI resolves
      // This uses the old direct service call for J-G.
      // To integrate with the new affected/unaffected pattern for J-G as well,
      // this block would also use goodsService.getAllGoods with filterByAffectedJournals.
      // For now, keeping existing J-G logic that directly fetches.
      // Consider if J-G should also use the new filterByAffectedJournals in goodsService.getAllGoods for consistency
      // If so, it would look like:
      // serviceCallOptions.filterByAffectedJournals = journalIds;
      // goodsResult = await goodsService.getAllGoods(serviceCallOptions);
      // For now, using the dedicated service as per original structure:
      const goodsArray = await journalGoodLinkService.getGoodsForJournals(
        journalIds,
        includeChildren
      );
      goodsResult = { goods: goodsArray, totalCount: goodsArray.length };
    }
    // Priority 5: Default to "affected" if contextJournalIdsForFilterStatus provided, but no filterStatus
    // (Handles "neither button pressed" in the Journal root scenario when journals are selected)
    else if (contextJournalIdsForFilterStatus) {
      console.log(
        `API /goods: Defaulting to 'affected' from contextJournalIds: [${contextJournalIdsForFilterStatus}].`
      );
      const journalIds =
        contextJournalIdsForFilterStatus
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean) || [];
      serviceCallOptions.filterByAffectedJournals = journalIds;
      goodsResult = await goodsService.getAllGoods(serviceCallOptions);
    }
    // Priority 6: Get all goods (with pagination/typeCode)
    else {
      console.log(`API /goods: General goods fetch. TypeCode: ${typeCode}`);
      goodsResult = await goodsService.getAllGoods(serviceCallOptions);
    }

    // Send response
    if (goodsResult) {
      const responsePayload = {
        data: goodsResult.goods,
        total: goodsResult.totalCount,
      };
      const body = JSON.stringify(responsePayload, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      console.error("API /goods GET Error: goodsResult was unexpectedly null.");
      return NextResponse.json(
        { message: "Failed to determine goods data." },
        { status: 500 }
      );
    }
  } catch (error) {
    const e = error as Error;
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
