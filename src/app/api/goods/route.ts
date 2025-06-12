// File: src/app/api/goods/route.ts
import { NextRequest, NextResponse } from "next/server";
import goodsService, {
  CreateGoodsData,
  GetAllGoodsOptions,
} from "@/app/services/goodsService"; // Import new options type
import { z } from "zod";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt"; // Our BigInt helper
import journalGoodLinkService from "@/app/services/journalGoodLinkService"; // Import the new service
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService"; // Import the new service
import { GoodsAndService, Prisma } from "@prisma/client"; // Added Prisma and GoodsAndService
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedUser } from "@/lib/authOptions";

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
  const session = await getServerSession(authOptions);
  const user = session?.user as ExtendedUser | undefined;

  if (!user?.companyId) {
    return NextResponse.json(
      { message: "Unauthorized or company session data is missing." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);

  // --- Parse Parameters ---
  const filterStatus = searchParams.get("filterStatus") as
    | "affected"
    | "unaffected"
    | "inProcess"
    | null;
  const contextJournalIdsParam = searchParams.get("contextJournalIds");
  const restrictedJournalId = searchParams.get("restrictedJournalId");

  const forJournalIdsParam = searchParams.get("forJournalIds");
  const forPartnerIdStr = searchParams.get("forPartnerId");
  const includeJournalChildrenParam = searchParams.get(
    "includeJournalChildren"
  );

  const typeCode = searchParams.get("typeCode") || undefined;
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const take = limitParam ? parseInt(limitParam, 10) : undefined;
  const skip = offsetParam ? parseInt(offsetParam, 10) : undefined;

  // --- Build Service Call Options ---
  const serviceCallOptions: GetAllGoodsOptions = {
    companyId: user.companyId,
    currentUserId: user.id, // Pass for the new filter logic
    take,
    skip,
    typeCode,
  };

  try {
    // Priority 1: J-P-G (3-way linking) - This is a highly specific query that bypasses the standard filters.
    if (forJournalIdsParam && forPartnerIdStr) {
      console.log(
        `API /goods: J-P-G flow. Journals: '${forJournalIdsParam}', Partner: '${forPartnerIdStr}'.`
      );
      // This flow is so specific, we can still use the dedicated service for it as it's an override.
      const journalIds = forJournalIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      const partnerId = parseBigIntParam(forPartnerIdStr, "forPartnerId");
      if (journalIds.length === 0 || partnerId === null) {
        return NextResponse.json(
          { message: "Invalid parameters for J-P-G flow." },
          { status: 400 }
        );
      }
      const goodsArray = await jpgLinkService.getGoodsForJournalsAndPartner(
        journalIds,
        partnerId,
        includeJournalChildrenParam !== "false"
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

    // Priority 2: Standard Journal-as-Root filtering (our main feature)
    if (filterStatus) {
      serviceCallOptions.filterStatus = filterStatus;
      serviceCallOptions.restrictedJournalId = restrictedJournalId || null;
      if (filterStatus === "affected") {
        serviceCallOptions.contextJournalIds =
          contextJournalIdsParam
            ?.split(",")
            .map((id) => id.trim())
            .filter(Boolean) || [];
      }
    }

    // Now, just call the refactored service. It handles all the logic.
    const goodsResult = await goodsService.getAllGoods(serviceCallOptions);

    const responsePayload = {
      data: goodsResult.goods,
      total: goodsResult.totalCount,
    };
    const body = JSON.stringify(responsePayload, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // ... Error handling remains the same ...
    const e = error as Error;
    console.error("API /goods GET Error:", e.message, e.stack);
    return NextResponse.json(
      { message: "Failed to fetch goods.", error: e.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as ExtendedUser | undefined;

  if (!user?.companyId || !user?.id) {
    return NextResponse.json(
      { message: "Unauthorized or user/company session data is missing." },
      { status: 401 }
    );
  }
  const companyId = user.companyId;
  const createdById = user.id;

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

    // --- Start of the Correct and Final Fix ---

    // The spread syntax (...) is causing a type inference issue.
    // We will build the object explicitly to guarantee its shape for TypeScript.
    // This removes all ambiguity.
    const serviceData: CreateGoodsData = {
      // Server-side required properties
      companyId: companyId,
      createdById: createdById,

      // Client-side required properties (from validation)
      label: validation.data.label,

      // Client-side optional properties (from validation)
      referenceCode: validation.data.referenceCode,
      barcode: validation.data.barcode,
      taxCodeId: validation.data.taxCodeId,
      typeCode: validation.data.typeCode,
      description: validation.data.description,
      unitCodeId: validation.data.unitCodeId,
      stockTrackingMethod: validation.data.stockTrackingMethod,
      packagingTypeCode: validation.data.packagingTypeCode,
      photoUrl: validation.data.photoUrl,
      additionalDetails: validation.data.additionalDetails,
    };

    // --- End of the Correct and Final Fix ---

    console.log(
      "Waiter (API /goods): Order for new good is clear. Passing to Chef."
    );

    // Now, pass the correctly and explicitly shaped object to the service.
    const newGood = await goodsService.createGood(serviceData);

    console.log(
      "Waiter (API /goods): Chef added the new good! Preparing for customer."
    );
    const body = JSON.stringify(newGood, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // ... rest of error handling remains the same
    const e = error as Error;
    console.error(
      "Waiter (API /goods): Chef couldn't add new good!",
      e.message,
      e
    );
    if ((e as any)?.code === "P2002") {
      return NextResponse.json(
        {
          message:
            "Failed to create good. A similar item (e.g., same reference code or barcode) might already exist.",
          error: e.message,
          errorCode: "P2002",
        },
        { status: 409 }
      );
    }
    if (e.message.includes("not found")) {
      return NextResponse.json(
        { message: "Failed to create good.", error: e.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Chef couldn't add the new good.", error: e.message },
      { status: 500 }
    );
  }
}
