// src/app/api/partners/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import partnerService from "@/app/services/partnerService";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";
import { createPartnerSchema, getPartnersQuerySchema } from "@/lib/schemas/partner.schema";
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/partners
 * Fetches partners based on various query parameters.
 * Supports pagination, filtering by journal IDs, and intersection with good IDs.
 * Applies user's journal restriction if present.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @param {object} _context - The context object (unused).
 * @param {ExtendedSession} session - The authenticated user's session.
 * @queryparam {number} [take] - Number of records to take (for pagination).
 * @queryparam {number} [skip] - Number of records to skip (for pagination).
 * @queryparam {("affected"|"unaffected"|"inProcess")} [filterMode] - Filtering mode for partners based on journal linkage.
 * @queryparam {string} [permissionRootId] - Root journal ID for permission-based filtering.
 * @queryparam {string} [selectedJournalIds] - Comma-separated list of journal IDs to filter by.
 * @queryparam {string} [intersectionOfGoodIds] - Comma-separated list of good IDs to find partners common to all.
 * @returns {NextResponse} A JSON response containing a paginated list of partners.
 * @status 200 - OK: Partners successfully fetched.
 * @status 400 - Bad Request: Invalid query parameters.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_PARTNER - Requires 'READ' action on 'PARTNER' resource.
 */
export const GET = withAuthorization(
  async function GET(request: NextRequest, _context, session: ExtendedSession) {
    try {
      const queryParams = Object.fromEntries(request.nextUrl.searchParams);
      const validation = getPartnersQuerySchema.safeParse(queryParams);
      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid query parameters.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }
      const { intersectionOfGoodIds, findByDocumentId, selectedJournalIds, filterMode, activeFilterModes, permissionRootId, ...restOfOptions } =
        validation.data;
      let result;
      if (findByDocumentId) {
        result = await partnerService.findPartnersForDocument(findByDocumentId);
      } else if (intersectionOfGoodIds && intersectionOfGoodIds.length > 0) {
        result = await partnerService.findPartnersForGoods({
          goodIds: intersectionOfGoodIds,
          journalIds: selectedJournalIds,
        });
      } else {
        result = await partnerService.getAllPartners({
          ...restOfOptions,
          selectedJournalIds,
          filterMode,
          activeFilterModes,
          permissionRootId,
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
      apiLogger.error("API GET /api/partners Error", { error: e.message, stack: e.stack });
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "PARTNER" }
);

/**
 * POST /api/partners
 * Creates a new Partner.
 * @param {NextRequest} request - The incoming Next.js request object containing the creation payload.
 * @param {object} _context - The context object (unused).
 * @param {ExtendedSession} session - The authenticated user's session, used to record `createdById`.
 * @body {object} body - The Partner creation data.
 * @body {string} body.name - The name of the partner (required).
 * @body {PartnerType} body.partnerType - The type of partner (e.g., LEGAL_ENTITY, NATURAL_PERSON).
 * @body {string} [body.notes] - Additional notes.
 * @body {string} [body.logoUrl] - URL to the partner's logo.
 * @body {string} [body.photoUrl] - URL to the partner's photo.
 * @body {boolean} [body.isUs] - Indicates if the partner is "us".
 * @body {string} [body.registrationNumber] - Registration number.
 * @body {string} [body.taxId] - Tax ID.
 * @body {string} [body.bioFatherName] - Father's name (for natural persons).
 * @body {string} [body.bioMotherName] - Mother's name (for natural persons).
 * @body {any} [body.additionalDetails] - Additional JSON details.
 * @returns {NextResponse} A JSON response containing the newly created Partner.
 * @status 201 - Created: Partner successfully created.
 * @status 400 - Bad Request: Invalid request body.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission CREATE_PARTNER - Requires 'CREATE' action on 'PARTNER' resource.
 */
export const POST = withAuthorization(
  async function POST(
    request: NextRequest,
    _context,
    session: ExtendedSession
  ) {
    try {
      const rawBody = await request.json();
      // ✅ This now uses the centralized schema for validation.
      const validation = createPartnerSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      // ✅ SIMPLIFIED: `validation.data` is now guaranteed to be the correct
      // `CreatePartnerPayload` type that the service expects. No more intermediate types.
      const newPartner = await partnerService.createPartner(
        validation.data,
        session.user!.id
      );

      const body = JSON.stringify(newPartner, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      apiLogger.error("API POST /api/partners Error", { error: e.message, stack: e.stack });
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "CREATE", resource: "PARTNER" }
);

