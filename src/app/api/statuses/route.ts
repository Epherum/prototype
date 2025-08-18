// src/app/api/statuses/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAllStatuses, createStatus } from "@/app/services/statusService";
import { StatusFormData } from "@/services/clientStatusService";

// Validation schema for creating status
const createStatusSchema = z.object({
  name: z.string().min(1, "Status name is required").max(50, "Status name must be 50 characters or less"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex code").optional(),
  displayOrder: z.number().int().min(0).optional(),
});

// GET /api/statuses - Get all statuses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeUsage = searchParams.get("includeUsage") === "true";
    
    const statuses = await getAllStatuses(includeUsage);
    return NextResponse.json(statuses);
  } catch (error) {
    console.error("Error fetching statuses:", error);
    return NextResponse.json(
      { error: "Failed to fetch statuses" },
      { status: 500 }
    );
  }
}

// POST /api/statuses - Create new status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the request body
    const validatedData = createStatusSchema.parse(body);
    
    const status = await createStatus(validatedData as StatusFormData);
    return NextResponse.json(status, { status: 201 });
  } catch (error) {
    console.error("Error creating status:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create status" },
      { status: 500 }
    );
  }
}