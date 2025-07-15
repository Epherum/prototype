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
  // ✅ FIX: Get journalId as a string and keep it that way.
  const journalId = searchParams.get("journalId");

  if (!partnerIdsStr || !journalId) {
    return NextResponse.json(
      { message: "Missing required 'partnerIds' or 'journalId' parameters." },
      { status: 400 }
    );
  }

  // No longer need to parse journalId to BigInt here.

  const partnerIds = partnerIdsStr
    .split(",")
    .map((id) => parseBigIntParam(id.trim(), "partnerIds"))
    .filter((id): id is bigint => id !== null);

  if (
    partnerIds.length === 0 ||
    partnerIds.length !== partnerIdsStr.split(",").length
  ) {
    return NextResponse.json(
      { message: "Invalid or empty 'partnerIds' format." },
      { status: 400 }
    );
  }

  try {
    // ✅ FIX: Pass the journalId string directly to the service.
    const { goods, totalCount } =
      await goodsService.findGoodsForPartnersIntersection(
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
    console.error("API /goods/for-partners-intersection GET Error:", error);
    return NextResponse.json(
      { message: "Failed to retrieve common goods." },
      { status: 500 }
    );
  }
}
