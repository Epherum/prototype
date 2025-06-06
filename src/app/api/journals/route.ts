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

interface AuthenticatedUserContext {
  companyId: string;
  userId: string;
}

const createJournalSchema = z.object({
  id: z.string().min(1, "Dish ID is required").max(100, "Dish ID too long"),
  name: z
    .string()
    .min(1, "Dish name is required")
    .max(255, "Dish name too long"),
  parentId: z.string().max(100).optional().nullable(),
  isTerminal: z.boolean().optional().default(false),
  additionalDetails: z.any().optional(),
});

export async function GET(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  if (!session?.user?.id || !session?.user?.companyId) {
    return NextResponse.json(
      { message: "Unauthorized: Session or user details missing" },
      { status: 401 }
    );
  }

  const userContext: AuthenticatedUserContext = {
    userId: session.user.id,
    companyId: session.user.companyId,
  };

  const { searchParams } = new URL(request.url);
  const parentIdParam = searchParams.get("parentId");
  const fetchRootParam = searchParams.get("root"); // For unrestricted users fetching top-level
  const linkedToPartnerIdStr = searchParams.get("linkedToPartnerId");
  const linkedToGoodIdStr = searchParams.get("linkedToGoodId");

  // Parameter for fetching a sub-hierarchy for a restricted user
  const restrictedTopLevelJournalIdQueryParam = searchParams.get(
    "restrictedTopLevelJournalId"
  );
  // This flag will clarify intent: are we fetching the sub-tree from restrictedTopLevelJournalId?
  const fetchSubtreeFlag = searchParams.get("fetchSubtree");

  console.log(
    `API /journals GET (User: ${userContext.userId}, Company: ${userContext.companyId}): parentId="${parentIdParam}", root="${fetchRootParam}", partnerId="${linkedToPartnerIdStr}", goodId="${linkedToGoodIdStr}", restrictedJournalQuery="${restrictedTopLevelJournalIdQueryParam}", fetchSubtree="${fetchSubtreeFlag}"`
  );

  try {
    // ... (partnerIdForFilter, goodIdForFilter parsing logic remains the same) ...
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

    // --- Linkage-based Filtering (Partner/Good) ---
    // These should come first as they are specific overrides.
    // (Assuming these services are also company-scoped internally or accept userContext)
    if (partnerIdForFilter !== null && goodIdForFilter !== null) {
      const journalIds = await jpgLinkService.getJournalIdsForPartnerAndGood(
        partnerIdForFilter,
        goodIdForFilter
        // Consider passing userContext if service needs it
      );
      if (journalIds.length === 0)
        return NextResponse.json([], { status: 200 });
      const journals = await journalService.getAllJournals(userContext, {
        where: { id: { in: journalIds } },
      });
      return NextResponse.json(journals);
    }
    if (partnerIdForFilter !== null) {
      const journals = await journalPartnerLinkService.getJournalsForPartner(
        partnerIdForFilter
        // Consider passing userContext
      );
      return NextResponse.json(journals);
    }
    if (goodIdForFilter !== null) {
      const journals = await journalGoodLinkService.getJournalsForGood(
        goodIdForFilter
        // Consider passing userContext
      );
      return NextResponse.json(journals);
    }

    // --- Journal Restriction Logic ---
    // If restrictedTopLevelJournalIdQueryParam is provided AND fetchSubtree is true,
    // fetch that specific journal and its descendants. This is the primary path for restricted users.
    if (restrictedTopLevelJournalIdQueryParam && fetchSubtreeFlag === "true") {
      console.log(
        `API /journals GET: Fetching sub-hierarchy for restricted journal ID: ${restrictedTopLevelJournalIdQueryParam}`
      );
      const journals = await journalService.getJournalSubHierarchy(
        restrictedTopLevelJournalIdQueryParam,
        userContext
      );
      return NextResponse.json(journals);
    }

    // --- Standard Hierarchy Fetching (for unrestricted users or specific parent lookups) ---
    // Fetch children of a specific parent (applies to both restricted/unrestricted, always company-scoped)
    if (typeof parentIdParam === "string" && parentIdParam.length > 0) {
      console.log(
        `API /journals GET: Fetching children for parentId: ${parentIdParam}`
      );
      const journals = await journalService.getJournalsByParentId(
        parentIdParam,
        userContext
      );
      return NextResponse.json(journals);
    }

    // Fetch root journals (typically for unrestricted users initializing their view)
    if (fetchRootParam === "true") {
      console.log("API /journals GET: Fetching root journals.");
      const journals = await journalService.getRootJournals(userContext);
      return NextResponse.json(journals);
    }

    // Default: Fetch all journals for the company (for unrestricted users, or if no other criteria match)
    // This could be the fallback if clientJournalService calls /api/journals without params for unrestricted full load.
    console.log("API /journals GET: Fetching all journals for company.");
    const journals = await journalService.getAllJournals(userContext);
    return NextResponse.json(journals);
  } catch (error) {
    const e = error as Error;
    console.error(
      `API /journals GET (User: ${userContext.userId}, Company: ${userContext.companyId}) Error:`,
      e.message,
      e.stack
    );
    return NextResponse.json(
      { message: "Failed to fetch journals", error: e.message },
      { status: 500 }
    );
  }
}

// ... (POST function remains the same) ...
export async function POST(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;

  if (!session?.user?.id || !session?.user?.companyId) {
    return NextResponse.json(
      { message: "Unauthorized: Session or user details missing" },
      { status: 401 }
    );
  }
  // TODO: Add permission check for "CREATE_JOURNAL"
  // Example: if (!hasPermission(session.user, "CREATE", "JOURNAL")) { return NextResponse.json({ message: "Forbidden" }, { status: 403 }); }

  const userContext: AuthenticatedUserContext = {
    userId: session.user.id,
    companyId: session.user.companyId,
  };

  console.log(
    `Waiter (API - User: ${userContext.userId}, Company: ${userContext.companyId}): Customer wants to add a new dish!`
  );
  try {
    const rawOrder = await request.json();
    console.log("Waiter (API): Customer's raw order for new dish:", rawOrder);

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

    const validOrderData = validation.data as Omit<
      CreateJournalData,
      "companyId"
    >; // Service will add companyId
    console.log(
      "Waiter (API): Order for new dish is clear. Passing to Chef:",
      validOrderData
    );

    const newDish = await journalService.createJournal(
      validOrderData,
      userContext
    ); // Pass userContext
    console.log(
      "Waiter (API): Chef successfully added the new dish! Informing customer."
    );
    return NextResponse.json(newDish, { status: 201 });
  } catch (error) {
    const e = error as Error;
    console.error(
      `Waiter (API - User: ${userContext.userId}, Company: ${userContext.companyId}) Chef couldn't add the new dish!`,
      e.message
    );
    const statusCode =
      e.message.includes("already on the menu") ||
      e.message.includes("already exists")
        ? 409
        : 500;
    return NextResponse.json(
      { message: "Chef couldn't add the new dish.", error: e.message },
      { status: statusCode }
    );
  }
}
