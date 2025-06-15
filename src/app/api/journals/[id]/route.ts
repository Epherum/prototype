// File: app/api/journals/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  journalService,
  UpdateJournalData,
} from "@/app/services/journalService";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession } from "@/lib/auth/authOptions";

const updateJournalSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name required")
      .max(255, "Name too long")
      .optional(),
    isTerminal: z.boolean().optional(),
    additionalDetails: z.any().optional(),
  })
  .strict();

export async function GET(
  _request: NextRequest,
  // FIX: Apply the Promise-based params pattern
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const session = (await getServerSession(authOptions)) as ExtendedSession;
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // FIX: Await the promise to resolve the params
  const params = await paramsPromise;
  const { id } = params;
  console.log(`API: Request for details for journal '${id}'.`);

  try {
    const journal = await journalService.getJournalById(id);
    if (!journal) {
      return NextResponse.json(
        { message: `Journal with ID '${id}' not found.` },
        { status: 404 }
      );
    }
    return NextResponse.json(journal);
  } catch (error) {
    const e = error as Error;
    console.error(`API: Error finding journal '${id}'.`, e.message);
    return NextResponse.json(
      { message: "Error finding journal.", error: e.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  // FIX: Apply the Promise-based params pattern
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const session = (await getServerSession(authOptions)) as ExtendedSession;
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // FIX: Await the promise to resolve the params
  const params = await paramsPromise;
  const { id } = params;
  console.log(`API: Request to update journal '${id}'.`);

  try {
    const rawOrderChanges = await request.json();
    const validation = updateJournalSchema.safeParse(rawOrderChanges);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid update payload.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }
    if (Object.keys(validation.data).length === 0) {
      return NextResponse.json(
        { message: "No changes provided for the update." },
        { status: 400 }
      );
    }

    const validChanges = validation.data as UpdateJournalData;
    console.log(
      "API: Update payload is valid. Passing to service:",
      validChanges
    );

    const updatedJournal = await journalService.updateJournal(id, validChanges);
    if (!updatedJournal) {
      return NextResponse.json(
        { message: `Journal with ID '${id}' not found, cannot update.` },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedJournal);
  } catch (error) {
    const e = error as Error;
    console.error(`API: Failed to update journal '${id}'.`, e.message);
    return NextResponse.json(
      { message: `Failed to update journal '${id}'.`, error: e.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  // FIX: Apply the Promise-based params pattern
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const session = (await getServerSession(authOptions)) as ExtendedSession;
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // FIX: Await the promise to resolve the params
  const params = await paramsPromise;
  const { id } = params;
  console.log(`API: Request to remove journal '${id}'.`);

  try {
    await journalService.deleteJournal(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const e = error as Error;
    console.error(`API: Failed to remove journal '${id}'.`, e.message);
    let statusCode = 500;
    if (e.message.includes("has child journals")) {
      statusCode = 409; // Conflict
    } else if (e.message.includes("not found")) {
      statusCode = 404; // Not Found
    } else if (e.message.includes("user role restrictions")) {
      statusCode = 409; // Conflict
    }
    return NextResponse.json({ message: e.message }, { status: statusCode });
  }
}
