//src/app/api/partners/[id]/goods-via-jpgl/route.ts
import { NextRequest, NextResponse } from "next/server";
import { parseBigIntParam, jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import prisma from "@/app/utils/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } } // Corrected to use 'id'
) {
  const partnerIdStr = params.id; // Corrected to use 'id'

  const { searchParams } = new URL(request.url);
  const journalId = searchParams.get("journalId"); // Get the string value

  console.log(
    `[API /goods-via-jpgl] Received request for PartnerID: ${partnerIdStr}, JournalID: '${journalId}'`
  );

  if (!journalId) {
    return NextResponse.json(
      { message: "Missing required 'journalId' query parameter." },
      { status: 400 }
    );
  }

  // --- REVERTING THE PREVIOUS FIX ---
  // The Prisma error clearly states it expects a String for journalId.
  // We will no longer parse it to an Int.
  // The 'journalId' variable from searchParams is already a string, which is correct.

  const partnerIdBigInt = parseBigIntParam(partnerIdStr, "partnerId");
  if (partnerIdBigInt === null) {
    return NextResponse.json(
      { message: "Invalid Partner ID format." },
      { status: 400 }
    );
  }

  try {
    const journalPartnerLink = await prisma.journalPartnerLink.findFirst({
      where: {
        partnerId: partnerIdBigInt,
        journalId: journalId, // --- USE THE ORIGINAL STRING VALUE ---
      },
      select: {
        id: true,
      },
    });

    if (!journalPartnerLink) {
      console.log(
        `[API /goods-via-jpgl] Could not find a JournalPartnerLink for partner ${partnerIdStr} and journal ${journalId}. Returning empty array.`
      );
      // This is a valid state, not an error. It means no goods are linked in this specific context.
      return new NextResponse(
        JSON.stringify({ data: [], total: 0 }, jsonBigIntReplacer),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[API /goods-via-jpgl] Found journalPartnerLink with ID: ${journalPartnerLink.id}`
    );

    const linksWithGoods = await prisma.journalPartnerGoodLink.findMany({
      where: {
        journalPartnerLinkId: journalPartnerLink.id,
      },
      include: {
        good: {
          include: {
            taxCode: true,
            unitOfMeasure: true,
          },
        },
      },
      orderBy: {
        good: {
          label: "asc",
        },
      },
    });

    const clientFriendlyGoods = linksWithGoods.map((link) => {
      const goodWithJpglId = {
        ...link.good,
        jpqLinkId: link.id.toString(),
      };

      return {
        ...goodWithJpglId,
        id: link.good.id.toString(),
        label: link.good.label,
        name: link.good.label,
        code: link.good.referenceCode || link.good.id.toString(),
      };
    });

    const responsePayload = {
      data: clientFriendlyGoods,
      total: clientFriendlyGoods.length,
    };

    return new NextResponse(
      JSON.stringify(responsePayload, jsonBigIntReplacer),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const e = error as Error;
    console.error(
      `API Error: GET /api/partners/${partnerIdStr}/goods-via-jpgl:`,
      e
    );
    return NextResponse.json(
      {
        message: "Could not fetch goods for partner in journal context.",
        error: e.message,
      },
      { status: 500 }
    );
  }
}
