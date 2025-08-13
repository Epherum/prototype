// src/app/api/goods/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import goodsService from "@/app/services/goodsService";
import { CreateGoodsData } from "@/app/services/service.types";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";

/**
 * Zod schema for validating query parameters for GET /api/goods.
 */
const getGoodsQuerySchema = z.object({
  take: z.coerce.number().int().positive().optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  filterMode: z.enum(["affected", "unaffected", "inProcess"]).optional(),
  permissionRootId: z.string().optional(),
  selectedJournalIds: z
    .string()
    .transform((val) => val.split(","))
    .optional(),
  intersectionOfPartnerIds: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((id) => parseBigInt(id, "partner ID"))
        .filter((id): id is bigint => id !== null)
    )
    .optional(),
});

/**
 * Zod schema for validating the request body for POST /api/goods.
 */
export const createGoodApiSchema = z
  .object({
    label: z.string().min(1, "Label is required").max(255),
    referenceCode: z.string().max(50).optional().nullable(),
    barcode: z.string().max(50).optional().nullable(),
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

/**
 * GET /api/goods
 * Fetches goods for all slider scenarios.
 */
export const GET = withAuthorization(
  async function GET(request: NextRequest, _context, session: ExtendedSession) {
    try {
      const queryParams = Object.fromEntries(request.nextUrl.searchParams);
      const validation = getGoodsQuerySchema.safeParse(queryParams);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid query parameters.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { intersectionOfPartnerIds, selectedJournalIds, ...restOfOptions } =
        validation.data;

      let result;

      // Logic from the spec: Check for intersection mode first.
      if (intersectionOfPartnerIds && intersectionOfPartnerIds.length > 0) {
        result = await goodsService.findGoodsForPartners({
          partnerIds: intersectionOfPartnerIds,
          journalIds: selectedJournalIds,
        });
      } else {
        result = await goodsService.getAllGoods({
          ...restOfOptions,
          selectedJournalIds,
          // CORRECTED FIX: Use optional chaining.
          // This safely passes the ID if it exists, or `undefined` if not,
          // which the service is already designed to handle.
          restrictedJournalId: session.user?.restrictedTopLevelJournalId,
          where: {},
        });
      }

      const body = JSON.stringify(result, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      console.error("API GET /api/goods Error:", e);
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  // CORRECTED: Provide the required permission object. Adjust as needed.
  { action: "READ", resource: "GOODS" }
);

/**
 * POST /api/goods
 * Creates a new Good or Service.
 */
export const POST = withAuthorization(
  async function POST(
    request: NextRequest,
    _context,
    session: ExtendedSession
  ) {
    try {
      const rawBody = await request.json();
      const validation = createGoodApiSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      // CORRECTED: Add createdById from the authorized session user
      const data: CreateGoodsData = {
        ...validation.data,
        createdById: session.user!.id,
      };

      const newGood = await goodsService.createGood(data);
      const body = JSON.stringify(newGood, jsonBigIntReplacer);

      return new NextResponse(body, {
        status: 201, // 201 Created
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      console.error("API POST /api/goods Error:", e);
      if (e.message.includes("not found")) {
        return NextResponse.json(
          { message: "Failed to create good.", error: e.message },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  // CORRECTED: Provide the required permission object. Adjust as needed.
  { action: "CREATE", resource: "GOODS" }
);
