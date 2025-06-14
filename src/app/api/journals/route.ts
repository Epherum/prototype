// src/app/api/journals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession } from "@/lib/authOptions";
import {
  journalService,
  CreateJournalData,
} from "@/app/services/journalService";
import { z } from "zod";
import journalPartnerLinkService from "@/app/services/journalPartnerLinkService";
import journalGoodLinkService from "@/app/services/journalGoodLinkService";
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService";
import { parseBigIntParam } from "@/app/utils/jsonBigInt";

const createJournalSchema = z.object({
  id: z
    .string()
    .min(1, "Journal ID is required")
    .max(100, "Journal ID too long"),
  name: z
    .string()
    .min(1, "Journal name is required")
    .max(255, "Journal name too long"),
  parentId: z.string().max(100).optional().nullable(),
  isTerminal: z.boolean().optional().default(false),
  additionalDetails: z.any().optional(),
});

export async function GET(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "Unauthorized: User session is missing" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const parentIdParam = searchParams.get("parentId");
  const fetchRootParam = searchParams.get("root");
  const linkedToPartnerIdStr = searchParams.get("linkedToPartnerId");
  const linkedToGoodIdStr = searchParams.get("linkedToGoodId");
  const restrictedTopLevelJournalIdQueryParam = searchParams.get(
    "restrictedTopLevelJournalId"
  );
  const fetchSubtreeFlag = searchParams.get("fetchSubtree");

  console.log(
    `API /journals GET: parentId="${parentIdParam}", root="${fetchRootParam}", partnerId="${linkedToPartnerIdStr}", goodId="${linkedToGoodIdStr}", restrictedJournalQuery="${restrictedTopLevelJournalIdQueryParam}", fetchSubtree="${fetchSubtreeFlag}"`
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
        errorMessages.push(
          `Invalid format for linkedToPartnerId: "${linkedToPartnerIdStr}". Must be an integer.`
        );
      }
    }
    if (linkedToGoodIdStr) {
      goodIdForFilter = parseBigIntParam(linkedToGoodIdStr, "linkedToGoodId");
      if (goodIdForFilter === null && linkedToGoodIdStr) {
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

    // --- Linkage-based Filtering ---
    if (partnerIdForFilter !== null && goodIdForFilter !== null) {
      const journalIds = await jpgLinkService.getJournalIdsForPartnerAndGood(
        partnerIdForFilter,
        goodIdForFilter
      );
      if (journalIds.length === 0)
        return NextResponse.json([], { status: 200 });
      // REFACTOR: No userContext needed
      const journals = await journalService.getAllJournals({
        where: { id: { in: journalIds } },
      });
      return NextResponse.json(journals);
    }
    if (partnerIdForFilter !== null) {
      const journals = await journalPartnerLinkService.getJournalsForPartner(
        partnerIdForFilter
      );
      return NextResponse.json(journals);
    }
    if (goodIdForFilter !== null) {
      const journals = await journalGoodLinkService.getJournalsForGood(
        goodIdForFilter
      );
      return NextResponse.json(journals);
    }

    // --- Journal Restriction Logic ---
    if (restrictedTopLevelJournalIdQueryParam && fetchSubtreeFlag === "true") {
      console.log(
        `API /journals GET: Fetching sub-hierarchy for restricted journal ID: ${restrictedTopLevelJournalIdQueryParam}`
      );
      // REFACTOR: No userContext needed
      const journals = await journalService.getJournalSubHierarchy(
        restrictedTopLevelJournalIdQueryParam
      );
      return NextResponse.json(journals);
    }

    // --- Standard Hierarchy Fetching ---
    if (typeof parentIdParam === "string" && parentIdParam.length > 0) {
      console.log(
        `API /journals GET: Fetching children for parentId: ${parentIdParam}`
      );
      // REFACTOR: No userContext needed
      const journals = await journalService.getJournalsByParentId(
        parentIdParam
      );
      return NextResponse.json(journals);
    }

    if (fetchRootParam === "true") {
      console.log("API /journals GET: Fetching root journals.");
      // REFACTOR: No userContext needed
      const journals = await journalService.getRootJournals();
      return NextResponse.json(journals);
    }

    console.log("API /journals GET: Fetching all journals.");
    // REFACTOR: No userContext needed
    const journals = await journalService.getAllJournals();
    return NextResponse.json(journals);
  } catch (error) {
    const e = error as Error;
    console.error(`API /journals GET Error:`, e.message, e.stack);
    return NextResponse.json(
      { message: "Failed to fetch journals", error: e.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "Unauthorized: User session is missing" },
      { status: 401 }
    );
  }

  console.log(`API: Received request to add a new journal.`);
  try {
    const rawOrder = await request.json();
    const validation = createJournalSchema.safeParse(rawOrder);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid journal payload.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const validOrderData = validation.data as CreateJournalData;
    console.log("API: Payload valid. Passing to service:", validOrderData);

    // REFACTOR: No userContext needed
    const newJournal = await journalService.createJournal(validOrderData);
    console.log("API: New journal created successfully.");
    return NextResponse.json(newJournal, { status: 201 });
  } catch (error) {
    const e = error as Error;
    console.error(`API Failed to create journal!`, e.message);
    const statusCode = e.message.includes("already exists") ? 409 : 500;
    return NextResponse.json(
      { message: "Failed to create journal.", error: e.message },
      { status: statusCode }
    );
  }
}
