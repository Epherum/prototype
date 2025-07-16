// src/app/api/partners/for-goods/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, ExtendedSession } from "@/lib/auth/authOptions";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";
import partnerService from "@/app/services/partnerService";

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
  const goodIdsStr = searchParams.get("goodIds");
  const journalId = searchParams.get("journalId");

  if (!goodIdsStr || !journalId) {
    return NextResponse.json(
      { message: "Missing required 'goodIds' or 'journalId' parameters." },
      { status: 400 }
    );
  }

  const goodIds = goodIdsStr
    .split(",")
    .map((id) => parseBigIntParam(id.trim(), "goodIds"))
    .filter((id): id is bigint => id !== null);

  if (goodIds.length === 0 || goodIds.length !== goodIdsStr.split(",").length) {
    return NextResponse.json(
      { message: "Invalid or empty 'goodIds' format." },
      { status: 400 }
    );
  }

  try {
    // ✅ Call the single, unified service function
    const { partners, totalCount } = await partnerService.findPartnersForGoods(
      goodIds,
      journalId
    );
    const body = JSON.stringify(
      { data: partners, total: totalCount },
      jsonBigIntReplacer
    );
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API /partners/for-goods GET Error:", error);
    return NextResponse.json(
      { message: "Failed to retrieve partners for goods." },
      { status: 500 }
    );
  }
}
