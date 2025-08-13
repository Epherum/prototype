// src/app/api/partners/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import partnerService from "@/app/services/partnerService";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";
import { createPartnerSchema } from "@/lib/schemas/partner.schema";

const getPartnersQuerySchema = z.object({
  take: z.coerce.number().int().positive().optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  filterMode: z.enum(["affected", "unaffected", "inProcess"]).optional(),
  permissionRootId: z.string().optional(),
  selectedJournalIds: z
    .string()
    .transform((val) => val.split(","))
    .optional(),
  intersectionOfGoodIds: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((id) => parseBigInt(id, "good ID"))
        .filter((id): id is bigint => id !== null)
    )
    .optional(),
});

export const GET = withAuthorization(
  async function GET(request: NextRequest, _context, session: ExtendedSession) {
    // ... (no changes in this function)
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
      const { intersectionOfGoodIds, selectedJournalIds, ...restOfOptions } =
        validation.data;
      let result;
      if (intersectionOfGoodIds && intersectionOfGoodIds.length > 0) {
        result = await partnerService.findPartnersForGoods({
          goodIds: intersectionOfGoodIds,
          journalIds: selectedJournalIds,
        });
      } else {
        result = await partnerService.getAllPartners({
          ...restOfOptions,
          selectedJournalIds,
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
      console.error("API GET /api/partners Error:", e);
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "PARTNER" }
);

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
      console.error("API POST /api/partners Error:", e);
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "CREATE", resource: "PARTNER" }
);
