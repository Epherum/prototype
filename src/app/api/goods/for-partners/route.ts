// File: src/app/api/goods/for-partners/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, ExtendedSession } from "@/lib/auth/authOptions";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";
import goodsService from "@/app/services/goodsService";

export async function GET(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const partnerIdsStr = searchParams.get("partnerIds");
  const journalId = searchParams.get("journalId");

  console.log(`\n--- [API-ROUTE: /goods/for-partners] ---`);
  console.log(`Received partnerIds string: "${partnerIdsStr}"`);
  console.log(`Received journalId string: "${journalId}"`);

  if (!partnerIdsStr || !journalId) {
    return NextResponse.json(
      { message: "Missing required 'partnerIds' or 'journalId' parameters." },
      { status: 400 }
    );
  }

  const partnerIds = partnerIdsStr
    .split(",")
    .map((id) => parseBigIntParam(id.trim(), "partnerIds"))
    .filter((id): id is bigint => id !== null);

  console.log(`Parsed into partnerIds (bigint[]):`, partnerIds);

  if (
    partnerIds.length === 0 ||
    partnerIds.length !== partnerIdsStr.split(",").length // ensures no invalid IDs were in the string
  ) {
    return NextResponse.json(
      { message: "Invalid or empty 'partnerIds' format." },
      { status: 400 }
    );
  }

  try {
    // ✅ Call the single, unified service function
    const { goods, totalCount } = await goodsService.findGoodsForPartners(
      partnerIds,
      journalId
    );

    const body = JSON.stringify(
      { data: goods, total: totalCount },
      jsonBigIntReplacer
    );

    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API /goods/for-partners GET Error:", error);
    return NextResponse.json(
      { message: "Failed to retrieve goods for partners." },
      { status: 500 }
    );
  }
}
