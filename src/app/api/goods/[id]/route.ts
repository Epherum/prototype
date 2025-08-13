// src/app/api/goods/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import goodsService from "@/app/services/goodsService";
import { UpdateGoodsData } from "@/app/services/service.types";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";

const updateGoodsSchema = z
  .object({
    label: z.string().min(1).max(255).optional(),
    taxCodeId: z.number().int().positive().optional().nullable(),
    typeCode: z.string().max(25).optional().nullable(),
    description: z.string().optional().nullable(),
    unitCodeId: z.number().int().positive().optional().nullable(),
    stockTrackingMethod: z.string().max(50).optional().nullable(),
    packagingTypeCode: z.string().max(25).optional().nullable(),
    photoUrl: z.string().url().optional().nullable(),
    additionalDetails: z.any().optional().nullable(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Update body cannot be empty."
  );

type RouteContext = { params: { id: string } };

/**
 * GET /api/goods/[id]
 */
export const GET = withAuthorization(
  async function GET(_request: NextRequest, { params }: RouteContext) {
    try {
      const goodId = parseBigInt(params.id, "good ID");
      if (goodId === null) {
        return NextResponse.json(
          { message: `Invalid good ID format: '${params.id}'.` },
          { status: 400 }
        );
      }

      const good = await goodsService.getGoodById(goodId);
      if (!good) {
        return NextResponse.json(
          { message: `Good/Service with ID '${params.id}' not found.` },
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
      console.error(`API GET /api/goods/${params.id} Error:`, e);
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "GOODS" }
);

/**
 * PUT /api/goods/[id]
 */
export const PUT = withAuthorization(
  async function PUT(request: NextRequest, { params }: RouteContext) {
    try {
      const goodId = parseBigInt(params.id, "good ID");
      if (goodId === null) {
        return NextResponse.json(
          { message: `Invalid good ID format: '${params.id}'.` },
          { status: 400 }
        );
      }

      const rawBody = await request.json();
      const validation = updateGoodsSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body for update.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const updatedGood = await goodsService.updateGood(
        goodId,
        validation.data as UpdateGoodsData
      );

      const body = JSON.stringify(updatedGood, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error & { code?: string };
      console.error(`API PUT /api/goods/${params.id} Error:`, e);

      // REFINED: Specifically catch Prisma's "record not found" error
      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Good with ID '${params.id}' not found for update.` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "UPDATE", resource: "GOODS" }
);

/**
 * DELETE /api/goods/[id]
 */
export const DELETE = withAuthorization(
  async function DELETE(_request: NextRequest, { params }: RouteContext) {
    try {
      const goodId = parseBigInt(params.id, "good ID");
      if (goodId === null) {
        return NextResponse.json(
          { message: `Invalid good ID format: '${params.id}'.` },
          { status: 400 }
        );
      }

      await goodsService.deleteGood(goodId);

      return NextResponse.json(
        {
          message: `Good/Service with ID '${params.id}' successfully deleted.`,
        },
        { status: 200 }
      );
    } catch (error) {
      const e = error as Error & { code?: string };
      console.error(`API DELETE /api/goods/${params.id} Error:`, e);

      // REFINED: Specifically catch Prisma's "record not found" error
      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Good with ID '${params.id}' not found for deletion.` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "DELETE", resource: "GOODS" }
);
