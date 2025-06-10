// src/app/api/partners/route.ts
import { NextRequest, NextResponse } from "next/server";
import partnerServiceImport, {
  // --- UPDATED IMPORTS ---
  createPartnerSchema, // Import the schema itself
  GetAllPartnersOptions,
  CreatePartnerData as ServiceCreatePartnerData, // Keep this for type hints if needed elsewhere
} from "@/app/services/partnerService";
// We no longer need to import z here unless used for other schemas
import { Partner, PartnerType } from "@prisma/client";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession } from "@/lib/authOptions";

const partnerService = partnerServiceImport;

/**
 * REFACTORED GET HANDLER
 * This handler is now simplified. It primarily parses parameters for the
 * Journal-as-Root filter and for other specific flows (like J-G-P),
 * then passes them to the new, more capable partnerService.getAllPartners.
 */
export async function GET(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;
  if (!session?.user?.id || !session?.user?.companyId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session.user.id;
  const companyId = session.user.companyId;

  const { searchParams } = new URL(request.url);

  // --- Parse Parameters ---

  // Main filter status for Journal-as-Root view. This is our primary mechanism now.
  const filterStatus = searchParams.get("filterStatus") as
    | "all"
    | "affected"
    | "unaffected"
    | "inProcess"
    | null;

  // Journal IDs for 'affected' and 'all' filters.
  const contextJournalIdsParam = searchParams.get("contextJournalIds");

  // Parameters for other filtering scenarios (J-G-P, G-P, etc.)
  const linkedToJournalIdsParam = searchParams.get("linkedToJournalIds");
  const linkedToGoodIdStr = searchParams.get("linkedToGoodId");
  const includeChildrenParam = searchParams.get("includeChildren"); // Still used by J-G-P

  // General parameters
  const partnerTypeParam = searchParams.get(
    "partnerType"
  ) as PartnerType | null;
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const take = limitParam ? parseInt(limitParam, 10) : undefined;
  const skip = offsetParam ? parseInt(offsetParam, 10) : undefined;

  // --- Build Service Call Options ---

  // Base options for the service call. Always include auth context.
  const serviceCallOptions: GetAllPartnersOptions = {
    companyId,
    currentUserId, // Pass the user ID for "inProcess" and "all" filters
    take,
    skip,
  };

  if (
    partnerTypeParam &&
    Object.values(PartnerType).includes(partnerTypeParam)
  ) {
    serviceCallOptions.partnerType = partnerTypeParam;
  }

  try {
    let partnersResult: { partners: Partner[]; totalCount: number };

    // --- Determine Filter Logic ---
    // The logic is now much flatter. We check for highly specific, overriding
    // scenarios first (like J-G-P), and otherwise fall back to our main filterStatus logic.

    // Priority 1: J-G-P (Journal-Good-Partner) or G-J-P (Good-Journal-Partner)
    if (linkedToJournalIdsParam && linkedToGoodIdStr) {
      console.log(
        `API /partners: J-G-P/G-J-P flow. Journals: '${linkedToJournalIdsParam}', Good: '${linkedToGoodIdStr}'.`
      );
      const journalIds = linkedToJournalIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (journalIds.length === 0) {
        return NextResponse.json(
          { message: "No valid journal IDs provided for J-G-P/G-J-P." },
          { status: 400 }
        );
      }

      const goodId = parseBigIntParam(linkedToGoodIdStr, "linkedToGoodId");
      if (goodId === null) {
        return NextResponse.json(
          { message: "Invalid linkedToGoodId provided." },
          { status: 400 }
        );
      }

      // This flow gets partner IDs from a different service, then filters partners by those IDs.
      const partnerIds = await jpgLinkService.getPartnerIdsForJournalsAndGood(
        journalIds,
        goodId,
        includeChildrenParam !== "false"
      );
      // We add this as a pre-filter `where` clause to our main service call.
      serviceCallOptions.where = { id: { in: partnerIds } };

      partnersResult =
        partnerIds.length === 0
          ? { partners: [], totalCount: 0 }
          : await partnerService.getAllPartners(serviceCallOptions);
    } else {
      // Priority 2: Standard Journal-as-Root filtering (our main feature)
      console.log(
        `API /partners: Standard flow. filterStatus: '${
          filterStatus || "none"
        }'`
      );
      if (filterStatus) {
        serviceCallOptions.filterStatus = filterStatus;
        // Only include contextJournalIds if they are relevant for the filter
        if (filterStatus === "affected" || filterStatus === "all") {
          serviceCallOptions.contextJournalIds =
            contextJournalIdsParam
              ?.split(",")
              .map((id) => id.trim())
              .filter(Boolean) || [];
        }
      }
      partnersResult = await partnerService.getAllPartners(serviceCallOptions);
    }

    // --- Send Response ---
    const responsePayload = {
      data: partnersResult.partners,
      total: partnersResult.totalCount,
    };
    const body = JSON.stringify(responsePayload, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    if (
      e.message.includes("Cannot convert") &&
      e.message.includes("to a BigInt")
    ) {
      return NextResponse.json(
        { message: "Invalid ID format provided.", error: e.message },
        { status: 400 }
      );
    }
    console.error("API /partners GET Error:", e.message, e.stack);
    return NextResponse.json(
      { message: "Chef couldn't get the partner list.", error: e.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // ... (This function remains unchanged)
  console.log("Waiter (API /partners): Customer wants to add a new partner.");
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;
  if (!session?.user?.id || !session?.user?.companyId) {
    return NextResponse.json(
      { message: "Unauthorized: Session or user details missing" },
      { status: 401 }
    );
  }
  const companyId = session.user.companyId;
  const createdById = session.user.id;
  const createdByIp =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;

  try {
    const rawOrder = await request.json();
    console.log(
      "Waiter (API /partners): Customer's raw order for new partner:",
      rawOrder
    );

    // Use the imported schema for validation
    const validation = createPartnerSchema.safeParse(rawOrder);
    if (!validation.success) {
      console.warn(
        "Waiter (API /partners): Customer's order for new partner is unclear/invalid:",
        validation.error.format()
      );
      return NextResponse.json(
        {
          message: "Order for new partner is unclear.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    // The type of validation.data is now guaranteed to match ServiceCreatePartnerData
    // because they both derive from the exact same schema object.
    const partnerDataForService: ServiceCreatePartnerData = validation.data;

    console.log(
      "Waiter (API /partners): Order for new partner is clear. Passing to Chef."
    );
    const newPartner = await partnerService.createPartner(
      partnerDataForService,
      companyId,
      createdById,
      createdByIp
    );
    const body = JSON.stringify(newPartner, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error(
      "Waiter (API /partners): Chef couldn't add new partner!",
      e.message,
      e.stack
    );
    return NextResponse.json(
      { message: "Chef couldn't add the new partner.", error: e.message },
      { status: 500 }
    );
  }
}
