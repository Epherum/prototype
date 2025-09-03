// src/app/api/partners/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import partnerService from "@/app/services/partnerService";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
// ✅ CHANGED: Import the central update schema.
import { updatePartnerSchema } from "@/lib/schemas/partner.schema";
import { apiLogger } from "@/lib/logger";

type RouteContext = { params: { id: string } };

/**
 * GET /api/partners/[id]
 * Fetches a single Partner by its ID.
 * @param {NextRequest} _request - The incoming Next.js request object.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the Partner to fetch (can be a string representation of BigInt).
 * @returns {NextResponse} A JSON response containing the Partner data if found, or an error message.
 * @status 200 - OK: Partner found and returned.
 * @status 400 - Bad Request: Invalid Partner ID format.
 * @status 404 - Not Found: Partner with the specified ID does not exist.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission READ_PARTNER - Requires 'READ' action on 'PARTNER' resource.
 */
export const GET = withAuthorization(
  async function GET(_request: NextRequest, { params }: RouteContext) {
    const resolvedParams = await params;
    try {
      const partnerId = parseBigInt(resolvedParams.id, "partner ID");
      if (partnerId === null) {
        return NextResponse.json(
          { message: `Invalid partner ID format: '${resolvedParams.id}'.` },
          { status: 400 }
        );
      }
      const partner = await partnerService.getPartnerById(partnerId);
      if (!partner) {
        return NextResponse.json(
          { message: `Partner with ID '${resolvedParams.id}' not found.` },
          { status: 404 }
        );
      }
      const body = JSON.stringify(partner, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error;
      apiLogger.error(`API GET /api/partners/${resolvedParams.id} Error:`, e);
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "PARTNER" }
);

/**
 * PUT /api/partners/[id]
 * Updates an existing Partner by its ID.
 * @param {NextRequest} request - The incoming Next.js request object containing the update payload.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the Partner to update (can be a string representation of BigInt).
 * @body {UpdatePartnerPayload} - The Partner fields to update.
 * @returns {NextResponse} A JSON response containing the updated Partner data or an error message.
 * @status 200 - OK: Partner successfully updated.
 * @status 400 - Bad Request: Invalid Partner ID format or invalid request body.
 * @status 404 - Not Found: Partner with the specified ID does not exist for update.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission UPDATE_PARTNER - Requires 'UPDATE' action on 'PARTNER' resource.
 */
export const PUT = withAuthorization(
  async function PUT(request: NextRequest, { params }: RouteContext) {
    const resolvedParams = await params;
    try {
      const partnerId = parseBigInt(resolvedParams.id, "partner ID");
      if (partnerId === null) {
        return NextResponse.json(
          { message: `Invalid partner ID format: '${resolvedParams.id}'.` },
          { status: 400 }
        );
      }

      const rawBody = await request.json();
      // ✅ This now uses the centralized schema for validation.
      const validation = updatePartnerSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body for update.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      // ✅ SIMPLIFIED & TYPE-SAFE: `validation.data` is the correct `UpdatePartnerPayload`.
      // The unsafe cast `as UpdatePartnerData` is no longer needed.
      const updatedPartner = await partnerService.updatePartner(
        partnerId,
        validation.data
      );

      const body = JSON.stringify(updatedPartner, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error as Error & { code?: string };
      apiLogger.error(`API PUT /api/partners/${resolvedParams.id} Error:`, e);
      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Partner with ID '${resolvedParams.id}' not found for update.` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "UPDATE", resource: "PARTNER" }
);

/**
 * DELETE /api/partners/[id]
 * Deletes a Partner by its ID.
 * @param {NextRequest} _request - The incoming Next.js request object.
 * @param {object} context - The context object containing route parameters.
 * @param {object} context.params - The parameters for the route.
 * @param {string} context.params.id - The ID of the Partner to delete (can be a string representation of BigInt).
 * @returns {NextResponse} A JSON response indicating success or an error message.
 * @status 200 - OK: Partner successfully deleted.
 * @status 400 - Bad Request: Invalid Partner ID format.
 * @status 404 - Not Found: Partner with the specified ID does not exist for deletion.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission DELETE_PARTNER - Requires 'DELETE' action on 'PARTNER' resource.
 */
export const DELETE = withAuthorization(
  async function DELETE(_request: NextRequest, { params }: RouteContext) {
    const resolvedParams = await params;
    try {
      const partnerId = parseBigInt(resolvedParams.id, "partner ID");
      if (partnerId === null) {
        return NextResponse.json(
          { message: `Invalid partner ID format: '${resolvedParams.id}'.` },
          { status: 400 }
        );
      }
      await partnerService.deletePartner(partnerId);
      return NextResponse.json(
        { message: `Partner with ID '${resolvedParams.id}' successfully deleted.` },
        { status: 200 }
      );
    } catch (error) {
      const e = error as Error & { code?: string };
      apiLogger.error(`API DELETE /api/partners/${resolvedParams.id} Error:`, e);
      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Partner with ID '${resolvedParams.id}' not found for deletion.` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "DELETE", resource: "PARTNER" }
);
