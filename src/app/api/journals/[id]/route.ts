// src/app/api/journals/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  journalService,
  UpdateJournalData,
} from "@/app/services/journalService";
import { withAuthorization } from "@/lib/auth/withAuthorization";

// Zod schema for validating the request body for PUT /api/journals/[id].
const updateJournalSchema = z
  .object({
    name: z.string().min(1).optional(),
    isTerminal: z.boolean().optional(),
    additionalDetails: z.any().optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Update body cannot be empty."
  );

type RouteContext = { params: { id: string } };

/**
 * GET /api/journals/[id]
 */
export const GET = withAuthorization(
  async function GET(_request: NextRequest, { params }: RouteContext) {
    try {
      const journal = await journalService.getJournalById(params.id);
      if (!journal) {
        return NextResponse.json(
          { message: `Journal with ID '${params.id}' not found.` },
          { status: 404 }
        );
      }
      return NextResponse.json(journal);
    } catch (error) {
      const e = error as Error;
      console.error(`API GET /api/journals/${params.id} Error:`, e);
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "JOURNAL" }
);

/**
 * PUT /api/journals/[id]
 */
export const PUT = withAuthorization(
  async function PUT(request: NextRequest, { params }: RouteContext) {
    try {
      const rawBody = await request.json();
      const validation = updateJournalSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body for update.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const updatedJournal = await journalService.updateJournal(
        params.id,
        validation.data as UpdateJournalData
      );
      return NextResponse.json(updatedJournal);
    } catch (error) {
      const e = error as Error & { code?: string };
      console.error(`API PUT /api/journals/${params.id} Error:`, e);

      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Journal with ID '${params.id}' not found for update.` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "UPDATE", resource: "JOURNAL" }
);

/**
 * DELETE /api/journals/[id]
 */
export const DELETE = withAuthorization(
  async function DELETE(_request: NextRequest, { params }: RouteContext) {
    try {
      await journalService.deleteJournal(params.id);
      return NextResponse.json(
        { message: `Journal with ID '${params.id}' successfully deleted.` },
        { status: 200 }
      );
    } catch (error) {
      const e = error as Error & { code?: string };
      console.error(`API DELETE /api/journals/${params.id} Error:`, e);

      // Catch specific "cannot delete" errors from the service layer
      if (e.message.includes("Cannot delete Journal")) {
        return NextResponse.json(
          { message: e.message },
          { status: 409 } // 409 Conflict is appropriate here
        );
      }
      // Catch Prisma's "record not found" error
      if (e.code === "P2025") {
        return NextResponse.json(
          { message: `Journal with ID '${params.id}' not found for deletion.` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "DELETE", resource: "JOURNAL" }
);
