// src/app/api/partners/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import partnerService from "@/app/services/partnerService";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
// ✅ CHANGED: Import the central update schema.
import { updatePartnerSchema } from "@/lib/schemas/partner.schema";

type RouteContext = { params: { id: string } };

export const GET = withAuthorization(
  async function GET(_request: NextRequest, { params }: RouteContext) {
    try {
      const partnerId = parseBigInt(params.id, "partner ID");
      if (partnerId === null) {
        return NextResponse.json(
          { message: `Invalid partner ID format: '${params.id}'.` },
          { status: 400 }
        );
      }
      const partner = await partnerService.getPartnerById(partnerId);
      if (!partner) {
        return NextResponse.json(
          { message: `Partner with ID '${params.id}' not found.` },
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
      console.error(`API GET /api/partners/${params.id} Error:`, e);
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "PARTNER" }
);

export const PUT = withAuthorization(
  async function PUT(request: NextRequest, { params }: RouteContext) {
    try {
      const partnerId = parseBigInt(params.id, "partner ID");
      if (partnerId === null) {
        return NextResponse.json(
          { message: `Invalid partner ID format: '${params.id}'.` },
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
      console.error(`API PUT /api/partners/${params.id} Error:`, e);
      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Partner with ID '${params.id}' not found for update.` },
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

export const DELETE = withAuthorization(
  async function DELETE(_request: NextRequest, { params }: RouteContext) {
    try {
      const partnerId = parseBigInt(params.id, "partner ID");
      if (partnerId === null) {
        return NextResponse.json(
          { message: `Invalid partner ID format: '${params.id}'.` },
          { status: 400 }
        );
      }
      await partnerService.deletePartner(partnerId);
      return NextResponse.json(
        { message: `Partner with ID '${params.id}' successfully deleted.` },
        { status: 200 }
      );
    } catch (error) {
      const e = error as Error & { code?: string };
      console.error(`API DELETE /api/partners/${params.id} Error:`, e);
      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Partner with ID '${params.id}' not found for deletion.` },
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
