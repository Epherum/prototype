// File: app/api/journals/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  journalService,
  CreateJournalData,
} from "@/app/services/journalService"; // Chef and Order Slip type
import { z } from "zod"; // The Waiter's notepad for checking orders
import journalPartnerLinkService from "@/app/services/journalPartnerLinkService"; // Import the new service
import journalGoodLinkService from "@/app/services/journalGoodLinkService"; // Import the new service
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService"; // Ensure it's imported
import { parseBigIntParam } from "@/app/utils/jsonBigInt";

// Waiter's checklist for "Create a New Dish" orders
const createJournalSchema = z.object({
  id: z.string().min(1, "Dish ID is required").max(100, "Dish ID too long"),
  name: z
    .string()
    .min(1, "Dish name is required")
    .max(255, "Dish name too long"),
  parentId: z.string().max(100).optional().nullable(), // Main dish ID, if this is a side
  isTerminal: z.boolean().optional().default(false),
  additionalDetails: z.any().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parentIdParam = searchParams.get("parentId");
  const fetchRootParam = searchParams.get("root");
  const linkedToPartnerIdStr = searchParams.get("linkedToPartnerId");
  const linkedToGoodIdStr = searchParams.get("linkedToGoodId");

  console.log(
    `API /journals GET: parentId="${parentIdParam}", root="${fetchRootParam}", partnerId="${linkedToPartnerIdStr}", goodId="${linkedToGoodIdStr}"`
  );

  try {
    let partnerIdForFilter: bigint | null = null;
    let goodIdForFilter: bigint | null = null;
    let errorMessages: string[] = [];

    if (linkedToPartnerIdStr) {
      partnerIdForFilter = parseBigIntParam(
        linkedToPartnerIdStr,
        "linkedToPartnerId"
      );
      if (partnerIdForFilter === null && linkedToPartnerIdStr) {
        // If param was present but invalid
        errorMessages.push(
          `Invalid format for linkedToPartnerId: "${linkedToPartnerIdStr}". Must be an integer.`
        );
      }
    }
    if (linkedToGoodIdStr) {
      goodIdForFilter = parseBigIntParam(linkedToGoodIdStr, "linkedToGoodId");
      if (goodIdForFilter === null && linkedToGoodIdStr) {
        // If param was present but invalid
        errorMessages.push(
          `Invalid format for linkedToGoodId: "${linkedToGoodIdStr}". Must be an integer.`
        );
      }
    }

    if (errorMessages.length > 0) {
      return NextResponse.json(
        { message: "Invalid query parameters.", errors: errorMessages },
        { status: 400 }
      );
    }

    // --- New Filtering Scenarios ---

    // Scenario A: Filter by Partner AND Good
    if (partnerIdForFilter !== null && goodIdForFilter !== null) {
      console.log(
        `Fetching journals for Partner ID: ${partnerIdForFilter} AND Good ID: ${goodIdForFilter}`
      );
      const journalIds = await jpgLinkService.getJournalIdsForPartnerAndGood(
        partnerIdForFilter,
        goodIdForFilter
      );
      if (journalIds.length === 0)
        return NextResponse.json([], { status: 200 });
      const journals = await journalService.getAllJournals({
        where: { id: { in: journalIds } },
      });
      return NextResponse.json(journals);
    }

    // Scenario B: Filter by Partner ID only
    if (partnerIdForFilter !== null) {
      console.log(`Fetching journals for Partner ID: ${partnerIdForFilter}`);
      const journals = await journalPartnerLinkService.getJournalsForPartner(
        partnerIdForFilter
      );
      return NextResponse.json(journals);
    }

    // Scenario C: Filter by Good ID only
    if (goodIdForFilter !== null) {
      console.log(`Fetching journals for Good ID: ${goodIdForFilter}`);
      const journals = await journalGoodLinkService.getJournalsForGood(
        goodIdForFilter
      );
      return NextResponse.json(journals);
    }

    // --- Existing Filtering Scenarios (Hierarchy-based) ---

    // Scenario 1 (Original): Fetch children of a specific parent
    if (typeof parentIdParam === "string" && parentIdParam.length > 0) {
      console.log(`Fetching children for parentId: "${parentIdParam}"`);
      const journals = await journalService.getJournalsByParentId(
        parentIdParam
      );
      return NextResponse.json(journals);
    }

    // Scenario 2 (Original): Fetch root journals
    if (fetchRootParam === "true") {
      console.log("Fetching root journals");
      const journals = await journalService.getRootJournals();
      return NextResponse.json(journals);
    }

    // Scenario 3 (Original): Default to fetching all journals
    // This is the fallback if no other specific parameters are matched.
    console.log("Default: Fetching all journals (no specific filters matched)");
    const journals = await journalService.getAllJournals(); // Ensure getAllJournals can take an empty options object or no arg
    return NextResponse.json(journals);
  } catch (error) {
    const e = error as Error;
    console.error("API /journals GET Error:", e.message, e.stack);
    return NextResponse.json(
      { message: "Failed to fetch journals", error: e.message },
      { status: 500 }
    );
  }
}

// This function runs when your frontend calls POST /api/journals (to create a new journal)
export async function POST(request: NextRequest) {
  console.log("Waiter (API): Customer wants to add a new dish to the menu!");
  try {
    const rawOrder = await request.json(); // Get the customer's order details
    console.log("Waiter (API): Customer's raw order for new dish:", rawOrder);

    // Waiter checks the order slip with Zod
    const validation = createJournalSchema.safeParse(rawOrder);
    if (!validation.success) {
      console.warn(
        "Waiter (API): Customer's order for new dish is unclear/invalid:",
        validation.error.format()
      );
      return NextResponse.json(
        {
          message: "Order for new dish is unclear.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const validOrderData = validation.data as CreateJournalData;
    console.log(
      "Waiter (API): Order for new dish is clear. Passing to Chef:",
      validOrderData
    );

    // Give the valid order to the Chef
    const newDish = await journalService.createJournal(validOrderData);
    console.log(
      "Waiter (API): Chef successfully added the new dish! Informing customer."
    );
    return NextResponse.json(newDish, { status: 201 }); // 201 means "Created"
  } catch (error) {
    const e = error as Error;
    console.error("Waiter (API): Chef couldn't add the new dish!", e.message);
    const statusCode =
      e.message.includes("already on the menu") ||
      e.message.includes("already exists")
        ? 409
        : 500; // 409 is "Conflict"
    return NextResponse.json(
      { message: "Chef couldn't add the new dish.", error: e.message },
      { status: statusCode }
    );
  }
}
