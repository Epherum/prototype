// File: src/app/api/goods/route.ts
import { NextRequest, NextResponse } from "next/server";
import goodsService, {
  CreateGoodsData,
  GetAllGoodsOptions,
} from "@/app/services/goodsService";
import { z } from "zod";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedUser } from "@/lib/authOptions"; // Assuming this is the correct path post-refactor
import { PartnerGoodFilterStatus } from "@/lib/types";

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

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // --- Parse All Potential Parameters ---
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const take = limitParam ? parseInt(limitParam, 10) : undefined;
  const skip = offsetParam ? parseInt(offsetParam, 10) : undefined;

  // J-P-G flow params
  const forJournalIdsParam = searchParams.get("forJournalIds");
  const forPartnerIdStr = searchParams.get("forPartnerId");
  const includeJournalChildrenParam = searchParams.get(
    "includeJournalChildren"
  );

  // J-G flow params
  const filterStatusesParam = searchParams.get("filterStatuses");
  const contextJournalIdsParam = searchParams.get("contextJournalIds");
  const restrictedJournalId = searchParams.get("restrictedJournalId");
  const typeCode = searchParams.get("typeCode") || undefined;

  try {
    const serviceCallOptions: GetAllGoodsOptions = {
      currentUserId: user.id,
      take,
      skip,
      typeCode,
    };

    // Priority 1: J-P-G (3-way linking) - Highly specific override
    if (forJournalIdsParam && forPartnerIdStr) {
      const journalIds = forJournalIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      const partnerId = parseBigIntParam(forPartnerIdStr, "forPartnerId");
      if (journalIds.length === 0 || partnerId === null) {
        return NextResponse.json(
          { message: "Invalid params for J-P-G flow." },
          { status: 400 }
        );
      }
      // Assuming jpgLinkService is refactored to not require companyId
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

    // --- REFACTORED: Priority 2: Standard Journal-as-Root filtering flow ---
    const filterStatuses = filterStatusesParam
      ? (filterStatusesParam
          .split(",")
          .filter(Boolean) as PartnerGoodFilterStatus[])
      : [];

    if (filterStatuses.length > 0) {
      serviceCallOptions.filterStatuses = filterStatuses;
      serviceCallOptions.restrictedJournalId = restrictedJournalId || null;
      if (filterStatuses.includes("affected")) {
        serviceCallOptions.contextJournalIds =
          contextJournalIdsParam
            ?.split(",")
            .map((id) => id.trim())
            .filter(Boolean) || [];
      }
    }

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

  if (!user?.id) {
    return NextResponse.json(
      { message: "Unauthorized or user session data is missing." },
      { status: 401 }
    );
  }
  const createdById = user.id;

  console.log("API /goods: Received request to add a new good/service.");
  try {
    const rawOrder = await request.json();
    const validation = createGoodsSchema.safeParse(rawOrder);

    if (!validation.success) {
      console.warn(
        "API /goods: Invalid payload for new good:",
        validation.error.format()
      );
      return NextResponse.json(
        {
          message: "Invalid payload for new good.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    // Build the data object for the service, now without companyId.
    const serviceData: CreateGoodsData = {
      // Server-side required properties
      createdById: createdById,

      // Client-side properties from validation
      label: validation.data.label,
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

    console.log("API /goods: Payload is valid. Creating new good...");
    const newGood = await goodsService.createGood(serviceData);

    console.log("API /goods: New good created successfully.");
    const body = JSON.stringify(newGood, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error("API /goods: Failed to create new good:", e.message, e);
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
      { message: "An unexpected error occurred.", error: e.message },
      { status: 500 }
    );
  }
}
