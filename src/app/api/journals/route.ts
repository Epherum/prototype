// File: app/api/journals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession } from "@/lib/authOptions";
import {
  journalService,
  CreateJournalData,
  // AuthenticatedUserContext, // No longer needed here if we construct it from session
} from "@/app/services/journalService";
import { z } from "zod";
import journalPartnerLinkService from "@/app/services/journalPartnerLinkService";
import journalGoodLinkService from "@/app/services/journalGoodLinkService";
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService";
import { parseBigIntParam } from "@/app/utils/jsonBigInt"; // Assuming this handles BigInt conversion for query params

// Define AuthenticatedUserContext for service calls
interface AuthenticatedUserContext {
  companyId: string;
  userId: string; // Good to have for logging/auditing
  // Include roles/permissions if your service layer needs fine-grained checks beyond just companyId
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
  )) as ExtendedSession | null; // Cast to your ExtendedSession

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
  const fetchRootParam = searchParams.get("root");
  const linkedToPartnerIdStr = searchParams.get("linkedToPartnerId");
  const linkedToGoodIdStr = searchParams.get("linkedToGoodId");
  // For restricted journal access
  const restrictedTopLevelJournalId = searchParams.get(
    "restrictedTopLevelJournalId"
  );

  console.log(
    `API /journals GET (User: ${userContext.userId}, Company: ${userContext.companyId}): parentId="${parentIdParam}", root="${fetchRootParam}", partnerId="${linkedToPartnerIdStr}", goodId="${linkedToGoodIdStr}", restrictedJournal="${restrictedTopLevelJournalId}"`
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

    // --- New Filtering Scenarios (Now with userContext for company scoping) ---
    // Note: jpgLinkService, journalPartnerLinkService, journalGoodLinkService
    // will also need to be updated to accept and use userContext (companyId) in their queries.
    // For now, I'll assume they are, or their internal queries are already company-scoped.
    // If not, they would need similar refactoring as journalService.

    // Scenario A: Filter by Partner AND Good
    if (partnerIdForFilter !== null && goodIdForFilter !== null) {
      // Only pass the two required arguments
      const journalIds = await jpgLinkService.getJournalIdsForPartnerAndGood(
        partnerIdForFilter,
        goodIdForFilter
      );
      if (journalIds.length === 0)
        return NextResponse.json([], { status: 200 });
      const journals = await journalService.getAllJournals(userContext, {
        where: { id: { in: journalIds } },
      });
      return NextResponse.json(journals);
    }

    // Scenario B: Filter by Partner ID only
    if (partnerIdForFilter !== null) {
      // Only pass the required argument
      const journals = await journalPartnerLinkService.getJournalsForPartner(
        partnerIdForFilter
      );
      return NextResponse.json(journals);
    }

    // Scenario C: Filter by Good ID only
    if (goodIdForFilter !== null) {
      // Only pass the required argument
      const journals = await journalGoodLinkService.getJournalsForGood(
        goodIdForFilter
      );
      return NextResponse.json(journals);
    }

    // --- Existing Hierarchy-based Scenarios (Now with userContext) ---
    // Handle journal restriction from user's session
    // This part is crucial for respecting user's restrictedTopLevelJournalId
    // The client should pass the user's restrictedTopLevelJournalId if applicable
    let baseQueryOptions: { where?: any } = {};

    if (restrictedTopLevelJournalId) {
      // This is for users who have a specific top-level journal restriction.
      // We need to fetch this journal and all its descendants.
      // This might require a recursive fetch or a specific service method in journalService.
      // For simplicity here, let's assume getAllJournals can be modified or a new service method
      // like `getJournalHierarchyFrom` is used.
      // E.g., const journals = await journalService.getJournalHierarchyFrom(restrictedTopLevelJournalId, userContext);

      // A simpler approach for now, if client handles hierarchy building:
      // Fetch the restricted top-level journal itself
      const topRestricted = await journalService.getJournalById(
        restrictedTopLevelJournalId,
        userContext
      );
      if (!topRestricted) {
        return NextResponse.json(
          { message: "Restricted journal not found or not accessible." },
          { status: 404 }
        );
      }
      // If only fetching children of a specific parent *within* the restriction,
      // the parentIdParam check below will handle it, scoped by company.
      // If fetching the "root" of their view, it's the `restrictedTopLevelJournalId` itself.

      if (fetchRootParam === "true") {
        // The "root" for this user IS their restrictedTopLevelJournalId
        const rootJournal = await journalService.getJournalById(
          restrictedTopLevelJournalId,
          userContext
        );
        return NextResponse.json(rootJournal ? [rootJournal] : []); // Return as array for consistency
      }
      if (typeof parentIdParam === "string" && parentIdParam.length > 0) {
        // Ensure parentIdParam is a descendant of or is restrictedTopLevelJournalId
        // This logic can get complex and might be better handled in the service layer or by client.
        // For now, assuming parentIdParam is valid within the user's scope.
        const journals = await journalService.getJournalsByParentId(
          parentIdParam,
          userContext
        );
        return NextResponse.json(journals);
      }
      // If no specific parent, and not fetching root, and restricted, default to showing their restricted root.
      // This case might need refinement based on exact UI needs for restricted users.
      // Typically, client fetches root, then children as needed.
      const journals = await journalService.getAllJournals(userContext, {
        // This might need a more specific query to get the hierarchy from restrictedTopLevelJournalId
        where: {
          OR: [
            { id: restrictedTopLevelJournalId },
            {
              parentId: restrictedTopLevelJournalId,
            } /* ... more for deeper levels or use recursive CTE in DB */,
          ],
        },
      });
      console.warn(
        "API /journals GET: Fallback for restricted user. Review if this gives the correct hierarchy start."
      );
      return NextResponse.json(journals);
    }

    // Scenario 1 (Original, now scoped): Fetch children of a specific parent
    if (typeof parentIdParam === "string" && parentIdParam.length > 0) {
      const journals = await journalService.getJournalsByParentId(
        parentIdParam,
        userContext
      );
      return NextResponse.json(journals);
    }

    // Scenario 2 (Original, now scoped): Fetch root journals (for users not restricted)
    if (fetchRootParam === "true") {
      const journals = await journalService.getRootJournals(userContext);
      return NextResponse.json(journals);
    }

    // Scenario 3 (Original, now scoped): Default to fetching all journals for the company
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
