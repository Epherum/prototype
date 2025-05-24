// src/app/api/partners/[partnerId]/goods-via-jpgl/route.ts
import { NextRequest, NextResponse } from "next/server";
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService"; // Ensure path is correct
import goodsService from "@/app/services/goodsService"; // Ensure path is correct & service exists
import prisma from "@/app/utils/prisma"; // Assuming direct Prisma client usage here
import { parseBigIntParam, jsonBigIntReplacer } from "@/app/utils/jsonBigInt"; // Ensure path is correct
import type { Good as ClientGood } from "@/lib/types"; // To map Prisma Good to ClientGood

export async function GET(
  _request: NextRequest,
  // Corrected typing for params as a Promise for dynamic route segments
  { params: paramsPromise }: { params: Promise<{ partnerId: string }> }
) {
  const resolvedParams = await paramsPromise;
  const partnerIdStr = resolvedParams.partnerId;

  console.log(
    `API GET /api/partners/${partnerIdStr}/goods-via-jpgl: Request received.`
  );

  const partnerIdBigInt = parseBigIntParam(partnerIdStr, "partner ID");

  if (partnerIdBigInt === null) {
    return NextResponse.json(
      { message: "Invalid Partner ID format." }, // More specific message
      { status: 400 }
    );
  }

  try {
    // Step 1: Get good IDs linked to this partner via any JournalPartnerGoodLink
    const goodIds = await jpgLinkService.getGoodIdsForPartner(partnerIdBigInt);

    if (!goodIds || goodIds.length === 0) {
      // Return structure consistent with PaginatedGoodsResponse (empty)
      return new NextResponse(
        JSON.stringify({ data: [], total: 0 }, jsonBigIntReplacer),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Fetch full details for these good IDs
    // Assuming goodsService.getAllGoods returns an object like { data: GoodsAndService[], total: number }
    // or directly fetches based on IDs and you construct the paginated-like response.
    // For clarity, let's assume it fetches just the goods matching the IDs.
    const goodsFromService = await prisma.goodsAndService.findMany({
      // Or use your goodsService.getGoodsByIds(goodIds)
      where: { id: { in: goodIds } },
      include: {
        // Include relations needed for the ClientGood type
        taxCode: true,
        unitOfMeasure: true,
      },
      orderBy: { label: "asc" },
    });

    // Map Prisma GoodsAndService to ClientGood type
    const clientFriendlyGoods: ClientGood[] = goodsFromService.map((g) => ({
      id: g.id.toString(),
      label: g.label,
      referenceCode: g.referenceCode,
      barcode: g.barcode,
      taxCodeId: g.taxCodeId,
      typeCode: g.typeCode,
      description: g.description,
      unitCodeId: g.unitCodeId,
      stockTrackingMethod: g.stockTrackingMethod,
      packagingTypeCode: g.packagingTypeCode,
      photoUrl: g.photoUrl,
      additionalDetails: g.additionalDetails, // Consider if this needs specific parsing/typing
      price: g.price ? parseFloat(g.price.toString()) : undefined, // Assuming price is Decimal
      taxCode: g.taxCode
        ? {
            id: g.taxCode.id,
            code: g.taxCode.code,
            rate: parseFloat(g.taxCode.rate.toString()),
            description: g.taxCode.description,
          }
        : null,
      unitOfMeasure: g.unitOfMeasure
        ? {
            id: g.unitOfMeasure.id,
            code: g.unitOfMeasure.code,
            name: g.unitOfMeasure.name,
          }
        : null,
      // For DynamicSlider compatibility if needed
      name: g.label,
      code: g.referenceCode || g.id.toString(),
      unit_code: g.unitOfMeasure?.code || undefined,
    }));

    // Construct the PaginatedGoodsResponse-like structure
    const responsePayload = {
      data: clientFriendlyGoods,
      total: clientFriendlyGoods.length, // Or totalCount if your service provides it differently
    };

    return new NextResponse(
      JSON.stringify(responsePayload, jsonBigIntReplacer),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const e = error as Error;
    console.error(
      `API Error: GET /api/partners/${partnerIdStr}/goods-via-jpgl:`,
      e
    );
    return NextResponse.json(
      {
        message: "Could not fetch goods for partner via JPGL.",
        error: e.message,
      },
      { status: 500 }
    );
  }
}
