// src/app/api/statuses/[id]/usage/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getStatusUsage } from "@/app/services/statusService";

// GET /api/statuses/[id]/usage - Get status usage statistics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usage = await getStatusUsage(id);
    return NextResponse.json(usage);
  } catch (error) {
    console.error("Error fetching status usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch status usage" },
      { status: 500 }
    );
  }
}