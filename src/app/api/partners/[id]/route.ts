// File: src/app/api/partners/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import partnerService, {
  UpdatePartnerData,
} from "@/app/services/partnerService";
import { z } from "zod";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt"; // Adjust path if needed

// Waiter's checklist for "Update Partner" orders
// Note: We don't allow changing partnerType via this route.
const updatePartnerSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    notes: z.string().optional().nullable(),
    logoUrl: z.string().url().optional().nullable(),
    photoUrl: z.string().url().optional().nullable(),
    isUs: z.boolean().optional().nullable(),
    registrationNumber: z.string().max(100).optional().nullable(),
    taxId: z.string().max(100).optional().nullable(),
    bioFatherName: z.string().max(100).optional().nullable(),
    bioMotherName: z.string().max(100).optional().nullable(),
    additionalDetails: z.any().optional().nullable(),
  })
  .strict(); // No other fields allowed

export async function GET(
  _request: NextRequest, // You can use _request if request object isn't used in this specific handler
  { params: paramsPromise }: { params: Promise<{ id: string }> } // Type params as a Promise
) {
  // Await the paramsPromise to get the actual params object
  const resolvedParams = await paramsPromise;
  const partnerIdStr = resolvedParams.id; // Access id from the resolved object

  const partnerId = parseBigInt(partnerIdStr, "partner ID");
  if (partnerId === null) {
    return NextResponse.json(
      { message: `Invalid partner ID format: '${partnerIdStr}'.` },
      { status: 400 }
    );
  }

  try {
    const partner = await partnerService.getPartnerById(partnerId); // This is the object from Prisma with BigInt
    if (!partner) {
      return NextResponse.json(
        { message: `Partner with ID '${partnerId}' not found.` },
        { status: 404 }
      );
    }

    // Use the replacer with JSON.stringify and construct NextResponse manually
    const body = JSON.stringify(partner, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json(
      { message: "Chef couldn't get partner details.", error: e.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  _request: NextRequest, // You can use _request if request object isn't used in this specific handler
  { params: paramsPromise }: { params: Promise<{ id: string }> } // Type params as a Promise
) {
  // Await the paramsPromise to get the actual params object
  const resolvedParams = await paramsPromise;
  const partnerIdStr = resolvedParams.id; // Access id from the resolved object

  console.log(
    `Waiter (API /partners/[id]): Customer wants to update partner ID '${partnerIdStr}'.`
  );

  const partnerId = parseBigInt(partnerIdStr, "partner ID");
  if (partnerId === null) {
    return NextResponse.json(
      { message: `Invalid partner ID format: '${partnerIdStr}'.` },
      { status: 400 }
    );
  }

  try {
    const rawOrderChanges = await _request.json();
    console.log(
      `Waiter (API /partners/[id]): Raw update order for partner '${partnerId}':`,
      rawOrderChanges
    );

    const validation = updatePartnerSchema.safeParse(rawOrderChanges);
    if (!validation.success) {
      console.warn(
        `Waiter (API /partners/[id]): Update order for partner '${partnerId}' invalid:`,
        validation.error.format()
      );
      return NextResponse.json(
        {
          message: "Update order is unclear.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }
    if (Object.keys(validation.data).length === 0) {
      return NextResponse.json(
        { message: "No changes provided for update." },
        { status: 400 }
      );
    }

    const validChanges = validation.data as UpdatePartnerData;
    console.log(
      `Waiter (API /partners/[id]): Update order clear. Passing to Chef for partner '${partnerId}'.`
    );

    const updatedPartner = await partnerService.updatePartner(
      partnerId,
      validChanges
    );
    if (!updatedPartner) {
      console.warn(
        `Waiter (API /partners/[id]): Chef says partner '${partnerId}' not found for update.`
      );
      return NextResponse.json(
        { message: `Partner with ID '${partnerId}' not found for update.` },
        { status: 404 }
      );
    }
    console.log(
      `Waiter (API /partners/[id]): Chef updated partner '${partnerId}'. Sending back updated details.`
    );
    const body = JSON.stringify(updatedPartner, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error(
      `Waiter (API /partners/[id]): Chef error updating partner '${partnerId}':`,
      e.message
    );
    return NextResponse.json(
      { message: "Chef couldn't update partner.", error: e.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest, // You can use _request if request object isn't used in this specific handler
  { params: paramsPromise }: { params: Promise<{ id: string }> } // Type params as a Promise
) {
  // Await the paramsPromise to get the actual params object
  const resolvedParams = await paramsPromise;
  const partnerIdStr = resolvedParams.id; // Access id from the resolved object

  console.log(
    `Waiter (API /partners/[id]): Customer wants to delete partner ID '${partnerIdStr}'.`
  );

  const partnerId = parseBigInt(partnerIdStr, "partner ID");
  if (partnerId === null) {
    return NextResponse.json(
      { message: `Invalid partner ID format: '${partnerIdStr}'.` },
      { status: 400 }
    );
  }

  try {
    const deletedPartner = await partnerService.deletePartner(partnerId);
    if (!deletedPartner) {
      console.warn(
        `Waiter (API /partners/[id]): Chef says partner '${partnerId}' not found for deletion.`
      );
      return NextResponse.json(
        { message: `Partner with ID '${partnerId}' not found for deletion.` },
        { status: 404 }
      );
    }
    console.log(
      `Waiter (API /partners/[id]): Chef deleted partner '${partnerId}'.`
    );
    return NextResponse.json({
      message: `Partner with ID '${partnerId}' successfully deleted.`,
    });
  } catch (error) {
    // This catch block might be less used if service returns null for "not found" on delete
    // and Prisma's P2025 is handled there.
    // If service.deletePartner throws for other reasons (e.g., DB constraint), it's caught here.
    const e = error as Error;
    console.error(
      `Waiter (API /partners/[id]): Chef error deleting partner '${partnerId}':`,
      e.message
    );
    return NextResponse.json(
      { message: "Chef couldn't delete partner.", error: e.message },
      { status: 500 }
    );
  }
}
