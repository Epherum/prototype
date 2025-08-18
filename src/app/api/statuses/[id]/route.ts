// src/app/api/statuses/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { 
  getStatusById, 
  updateStatus, 
  deleteStatus 
} from "@/app/services/statusService";

// Validation schema for updating status
const updateStatusSchema = z.object({
  name: z.string().min(1, "Status name is required").max(50, "Status name must be 50 characters or less"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex code").optional(),
  displayOrder: z.number().int().min(0).optional(),
});

// GET /api/statuses/[id] - Get status by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const status = await getStatusById(id);
    
    if (!status) {
      return NextResponse.json(
        { error: "Status not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(status);
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}

// PUT /api/statuses/[id] - Update status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Validate the request body
    const validatedData = updateStatusSchema.parse(body);
    
    const status = await updateStatus(id, validatedData);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Error updating status:", error);
    
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
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}

// DELETE /api/statuses/[id] - Delete status
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteStatus(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting status:", error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to delete status" },
      { status: 500 }
    );
  }
}