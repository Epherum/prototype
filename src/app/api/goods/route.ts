// src/app/api/goods/route.ts

import { NextRequest, NextResponse } from "next/server";
import goodsService from "@/app/services/goodsService";
import { CreateGoodsData } from "@/lib/types/service.types";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";
import {
  getGoodsQuerySchema,
  createGoodSchema,
} from "@/lib/schemas/good.schema";
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/goods
 * Fetches goods based on various query parameters.
 * Supports pagination, filtering by journal IDs, and intersection with partner IDs.
 * Applies user's journal restriction if present.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @param {object} _context - The context object (unused).
 * @param {ExtendedSession} session - The authenticated user's session.
 * @queryparam {number} [take] - Number of records to take (for pagination).
 * @queryparam {number} [skip] - Number of records to skip (for pagination).
 * @queryparam {("affected"|"unaffected"|"inProcess")} [filterMode] - Filtering mode for goods based on journal linkage.
 * @queryparam {string} [permissionRootId] - Root journal ID for permission-based filtering.
 * @queryparam {string} [selectedJournalIds] - Comma-separated list of journal IDs to filter by.
 * @queryparam {string} [intersectionOfPartnerIds] - Comma-separated list of partner IDs to find goods common to all.
 * @queryparam {string} [partnerId] - Single partner ID for three-way lookup with journals.
 * @queryparam {string} [journalIds] - Comma-separated list of journal IDs for three-way lookup with partner.
 * @returns {NextResponse} A JSON response containing a paginated list of goods.
 * @status 200 - OK: Goods successfully fetched.
 * @status 400 - Bad Request: Invalid query parameters.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_GOODS - Requires 'READ' action on 'GOODS' resource.
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

      const { 
        intersectionOfPartnerIds, 
        findByDocumentId,
        selectedJournalIds, 
        filterMode,
        activeFilterModes,
        permissionRootId,
        partnerId, 
        journalIds, 
        ...restOfOptions 
      } = validation.data;

      let result;

      // Priority 1: Document filtering for standard mode document browsing
      if (findByDocumentId) {
        result = await goodsService.findGoodsForDocument(findByDocumentId);
      }
      // Priority 2: Three-way lookup (single partner + journals) for standard mode
      else if (partnerId && journalIds && journalIds.length > 0) {
        result = await goodsService.findGoodsForPartnerAndJournals(
          partnerId,
          journalIds
        );
      }
      // Priority 3: Intersection mode (multiple partners) for document creation mode
      else if (intersectionOfPartnerIds && intersectionOfPartnerIds.length > 0) {
        result = await goodsService.findGoodsForPartners({
          partnerIds: intersectionOfPartnerIds,
          journalIds: selectedJournalIds,
        });
      } 
      // Priority 4: Standard journal filtering
      else {
        result = await goodsService.getAllGoods({
          ...restOfOptions,
          selectedJournalIds,
          filterMode,
          activeFilterModes,
          permissionRootId,
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
      apiLogger.error("API GET /api/goods Error", { error: e.message, stack: e.stack });
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
 * @param {NextRequest} request - The incoming Next.js request object containing the creation payload.
 * @param {object} _context - The context object (unused).
 * @param {ExtendedSession} session - The authenticated user's session, used to record `createdById`.
 * @body {object} body - The Good/Service creation data.
 * @body {string} body.label - The label for the Good/Service (required).
 * @body {string} [body.referenceCode] - Reference code.
 * @body {string} [body.barcode] - Barcode.
 * @body {number} [body.taxCodeId] - ID of the associated tax code.
 * @body {string} [body.typeCode] - Type code.
 * @body {string} [body.description] - Description.
 * @body {number} [body.unitCodeId] - ID of the unit of measure.
 * @body {string} [body.stockTrackingMethod] - Stock tracking method.
 * @body {string} [body.packagingTypeCode] - Packaging type code.
 * @body {string} [body.photoUrl] - URL to a photo of the Good/Service.
 * @body {any} [body.additionalDetails] - Additional JSON details.
 * @returns {NextResponse} A JSON response containing the newly created Good/Service.
 * @status 201 - Created: Good/Service successfully created.
 * @status 400 - Bad Request: Invalid request body or failed to create (e.g., related entity not found).
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission CREATE_GOODS - Requires 'CREATE' action on 'GOODS' resource.
 */
export const POST = withAuthorization(
  async function POST(
    request: NextRequest,
    _context,
    session: ExtendedSession
  ) {
    try {
      const rawBody = await request.json();
      const validation = createGoodSchema.safeParse(rawBody);

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
      apiLogger.error("API POST /api/goods Error", { error: e.message, stack: e.stack });
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
