// src/app/api/goods/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import goodsService from "@/app/services/goodsService";
import { UpdateGoodsData } from "@/lib/types/service.types";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { updateGoodSchema } from "@/lib/schemas/good.schema";
import { apiLogger } from "@/lib/logger";

type RouteContext = { params: { id: string } };

/**
 * GET /api/goods/[id]
 * Fetches a single Good or Service by its ID.
 * @param {NextRequest} _request - The incoming Next.js request object.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.resolvedParams.id - The ID of the Good/Service to fetch (can be a string representation of BigInt).
 * @returns {NextResponse} A JSON response containing the Good/Service data if found, or an error message.
 * @status 200 - OK: Good/Service found and returned.
 * @status 400 - Bad Request: Invalid Good/Service ID format.
 * @status 404 - Not Found: Good/Service with the specified ID does not exist.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_GOODS - Requires 'READ' action on 'GOODS' resource.
 */
export const GET = withAuthorization(
  async function GET(_request: NextRequest, { params }: RouteContext) {
    try {
      const resolvedParams = await params;
      const goodId = parseBigInt(resolvedParams.id, "good ID");
      if (goodId === null) {
        return NextResponse.json(
          { message: `Invalid good ID format: '${resolvedParams.id}'.` },
          { status: 400 }
        );
      }

      const good = await goodsService.getGoodById(goodId);
      if (!good) {
        return NextResponse.json(
          { message: `Good/Service with ID '${resolvedParams.id}' not found.` },
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
      apiLogger.error(`API GET /api/goods/${resolvedParams.id} Error:`, e);
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
 * Updates an existing Good or Service by its ID.
 * @param {NextRequest} request - The incoming Next.js request object containing the update payload.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.resolvedParams.id - The ID of the Good/Service to update (can be a string representation of BigInt).
 * @body {UpdateGoodsData} - The Good/Service fields to update.
 * @returns {NextResponse} A JSON response containing the updated Good/Service data or an error message.
 * @status 200 - OK: Good/Service successfully updated.
 * @status 400 - Bad Request: Invalid Good/Service ID format or invalid request body.
 * @status 404 - Not Found: Good/Service with the specified ID does not exist for update.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission UPDATE_GOODS - Requires 'UPDATE' action on 'GOODS' resource.
 */
export const PUT = withAuthorization(
  async function PUT(request: NextRequest, { params }: RouteContext) {
    try {
      const resolvedParams = await params;
      const goodId = parseBigInt(resolvedParams.id, "good ID");
      if (goodId === null) {
        return NextResponse.json(
          { message: `Invalid good ID format: '${resolvedParams.id}'.` },
          { status: 400 }
        );
      }

      const rawBody = await request.json();
      const validation = updateGoodSchema.safeParse(rawBody);

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
      apiLogger.error(`API PUT /api/goods/${resolvedParams.id} Error:`, e);

      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Good with ID '${resolvedParams.id}' not found for update.` },
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
 * Deletes a Good or Service by its ID.
 * @param {NextRequest} _request - The incoming Next.js request object.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.resolvedParams.id - The ID of the Good/Service to delete (can be a string representation of BigInt).
 * @returns {NextResponse} A JSON response indicating success or an error message.
 * @status 200 - OK: Good/Service successfully deleted.
 * @status 400 - Bad Request: Invalid Good/Service ID format.
 * @status 404 - Not Found: Good/Service with the specified ID does not exist for deletion.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission DELETE_GOODS - Requires 'DELETE' action on 'GOODS' resource.
 */
export const DELETE = withAuthorization(
  async function DELETE(_request: NextRequest, { params }: RouteContext) {
    try {
      const resolvedParams = await params;
      const goodId = parseBigInt(resolvedParams.id, "good ID");
      if (goodId === null) {
        return NextResponse.json(
          { message: `Invalid good ID format: '${resolvedParams.id}'.` },
          { status: 400 }
        );
      }

      await goodsService.deleteGood(goodId);

      return NextResponse.json(
        {
          message: `Good/Service with ID '${resolvedParams.id}' successfully deleted.`,
        },
        { status: 200 }
      );
    } catch (error) {
      const e = error as Error & { code?: string };
      apiLogger.error(`API DELETE /api/goods/${resolvedParams.id} Error:`, e);

      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Good with ID '${resolvedParams.id}' not found for deletion.` },
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
