// File: src/app/api/goods/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import goodsService, { UpdateGoodsData } from "@/app/services/goodsService";
import { z } from "zod";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt";

// Waiter's checklist for "Update Good/Service"
const updateGoodsSchema = z
  .object({
    label: z.string().min(1).max(255).optional(),
    // referenceCode: z.string().max(50).optional(), // Typically not updated or handled carefully
    // barcode: z.string().max(50).optional(),       // Same as referenceCode
    taxCodeId: z.number().int().positive().optional().nullable(),
    typeCode: z.string().max(25).optional().nullable(),
    description: z.string().optional().nullable(),
    unitCodeId: z.number().int().positive().optional().nullable(),
    stockTrackingMethod: z.string().max(50).optional().nullable(),
    packagingTypeCode: z.string().max(25).optional().nullable(),
    photoUrl: z.string().url().optional().nullable(),
    additionalDetails: z.any().optional().nullable(),
  })
  .strict();

export async function GET(
  _request: NextRequest, // You can use _request if request object isn't used in this specific handler
  { params: paramsPromise }: { params: Promise<{ id: string }> } // Type params as a Promise
) {
  // Await the paramsPromise to get the actual params object
  const resolvedParams = await paramsPromise;
  const goodIdStr = resolvedParams.id; // Access id from the resolved object

  console.log(
    `Waiter (API /goods/[id]): Customer wants details for good ID '${goodIdStr}'.`
  );
  const goodId = parseBigInt(goodIdStr, "good ID");
  if (goodId === null) {
    return NextResponse.json(
      { message: `Invalid good ID format: '${goodIdStr}'.` },
      { status: 400 }
    );
  }

  try {
    const good = await goodsService.getGoodById(goodId);
    if (!good) {
      return NextResponse.json(
        { message: `Good/Service with ID '${goodId}' not found.` },
        { status: 404 }
      );
    }
    const body = JSON.stringify(good, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json(
      { message: "Chef couldn't get good details.", error: e.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest, // Keep NextRequest if you need its specific methods (like request.json())
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await paramsPromise;
  const goodIdStr = resolvedParams.id;

  const goodId = parseBigInt(goodIdStr, "good ID");

  if (goodId === null) {
    return NextResponse.json(
      { message: `Invalid good ID format: '${goodIdStr}'.` },
      { status: 400 }
    );
  }

  try {
    const rawOrderChanges = await request.json();
    const validation = updateGoodsSchema.safeParse(rawOrderChanges);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Update order is unclear.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }
    if (Object.keys(validation.data).length === 0) {
      return NextResponse.json(
        { message: "No changes provided for update." },
        { status: 400 }
      );
    }

    const validChanges = validation.data as UpdateGoodsData;
    const updatedGood = await goodsService.updateGood(goodId, validChanges);
    if (!updatedGood) {
      return NextResponse.json(
        { message: `Good/Service with ID '${goodId}' not found for update.` },
        { status: 404 }
      );
    }
    const body = JSON.stringify(updatedGood, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    if (e.message.includes("not found")) {
      // For FK violations like TaxCode not found during update
      return NextResponse.json(
        { message: "Failed to update good.", error: e.message },
        { status: 400 }
      ); // Bad request
    }
    return NextResponse.json(
      { message: "Chef couldn't update good.", error: e.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await paramsPromise;
  const goodIdStr = resolvedParams.id;

  const goodId = parseBigInt(goodIdStr, "good ID");

  if (goodId === null) {
    return NextResponse.json(
      { message: `Invalid good ID format: '${goodIdStr}'.` },
      { status: 400 }
    );
  }

  try {
    const deletedGood = await goodsService.deleteGood(goodId);
    if (!deletedGood) {
      return NextResponse.json(
        { message: `Good/Service with ID '${goodId}' not found for deletion.` },
        { status: 404 }
      );
    }
    return NextResponse.json({
      message: `Good/Service with ID '${goodId}' successfully deleted.`,
    });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json(
      { message: "Chef couldn't delete good.", error: e.message },
      { status: 500 }
    );
  }
}
