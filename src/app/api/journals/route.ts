// src/app/api/journals/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  journalService,
  CreateJournalData,
} from "@/app/services/journalService";
import { jsonBigIntReplacer, parseBigInt } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { ExtendedSession } from "@/lib/auth/authOptions";

/**
 * Zod schema for validating query parameters for the versatile GET /api/journals endpoint.
 */
const getJournalsQuerySchema = z
  .object({
    // Use Case 1: Fetch sub-hierarchy for a restricted user
    rootJournalId: z.string().optional(),

    // Use Case 2: Find journals linked to partners (P -> J)
    findByPartnerIds: z
      .string()
      .optional()
      .transform((val) =>
        val
          ? val
              .split(",")
              .map((id) => parseBigInt(id, "partner ID"))
              .filter((id): id is bigint => id !== null)
          : undefined
      ),

    // Use Case 3: Find journals linked to goods (G -> J)
    findByGoodIds: z
      .string()
      .optional()
      .transform((val) =>
        val
          ? val
              .split(",")
              .map((id) => parseBigInt(id, "good ID"))
              .filter((id): id is bigint => id !== null)
          : undefined
      ),
  })
  // ✅ FIX: The .refine() check has been removed.
  // This schema now correctly handles the case where NO query parameters are provided,
  // which is necessary for the initial, unfiltered data load for the Journal slider.
  // .partial() is sufficient to make all fields optional.
  .partial();

/**
 * Zod schema for creating a new journal.
 */
const createJournalSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  parentId: z.string().optional().nullable(),
  isTerminal: z.boolean().optional(),
  additionalDetails: z.any().optional(),
});

/**
 * GET /api/journals
 * Fetches journals based on various contexts, acting as a router to the service layer.
 */
export const GET = withAuthorization(
  async function GET(request: NextRequest) {
    try {
      const queryParams = Object.fromEntries(request.nextUrl.searchParams);
      const validation = getJournalsQuerySchema.safeParse(queryParams);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid query parameters.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { rootJournalId, findByPartnerIds, findByGoodIds } =
        validation.data;
      let journals;

      // Logic from the spec: Use an if/else if/else block to call the correct service function.
      if (rootJournalId) {
        journals = await journalService.getJournalSubHierarchy(rootJournalId);
      } else if (findByPartnerIds && findByPartnerIds.length > 0) {
        journals = await journalService.getJournalsForPartners(
          findByPartnerIds
        );
      } else if (findByGoodIds && findByGoodIds.length > 0) {
        journals = await journalService.getJournalsForGoods(findByGoodIds);
      } else {
        // ✅ FIX: This block is now reachable and serves as the default case.
        // It handles the initial request from the client when no filters are applied,
        // typically for an admin user loading the application for the first time.
        // We assume a `getRootJournals` or similar function exists in the service.
        // If it was called `getJournalSubHierarchy` with no args, that would go here too.
        console.log("No specific query params found, fetching root journals.");
        console.log(
          "--> Calling journalService.getJournalSubHierarchy with null for Admin user."
        ); // <-- ADD THIS
        journals = await journalService.getJournalSubHierarchy(null);
        console.log("<-- Service returned:", journals); // <-- ADD THIS
        journals = await journalService.getJournalSubHierarchy(null); // Assuming `null` fetches the root
      }

      // The service functions return a simple array, not the { data, totalCount } object.
      return NextResponse.json(journals);
    } catch (error) {
      const e = error as Error;
      console.error("API GET /api/journals Error:", e);
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "READ", resource: "JOURNAL" }
);

/**
 * POST /api/journals
 * Creates a new journal.
 */
export const POST = withAuthorization(
  async function POST(request: NextRequest) {
    try {
      const rawBody = await request.json();
      const validation = createJournalSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const newJournal = await journalService.createJournal(
        validation.data as CreateJournalData
      );

      return NextResponse.json(newJournal, { status: 201 });
    } catch (error) {
      const e = error as Error;
      console.error("API POST /api/journals Error:", e);
      // Handle specific errors like a non-existent parent
      if (e.message.includes("not found")) {
        return NextResponse.json(
          { message: e.message },
          { status: 400 } // Bad Request
        );
      }
      return NextResponse.json(
        { message: "An internal error occurred.", error: e.message },
        { status: 500 }
      );
    }
  },
  { action: "CREATE", resource: "JOURNAL" }
);
