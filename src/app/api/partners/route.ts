// File: src/app/api/partners/route.ts
import { NextRequest, NextResponse } from "next/server";
import partnerService, {
  CreatePartnerData,
} from "@/app/services/partnerService";
import { z } from "zod";
import { Partner, PartnerType, Prisma } from "@prisma/client"; // Added Prisma
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";
import journalPartnerLinkService from "@/app/services/journalPartnerLinkService"; // For specific scenarios if needed
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService";
import { getServerSession } from "next-auth/next";
import { authOptions, ExtendedSession } from "@/lib/authOptions";

const createPartnerSchema = z.object({
  name: z.string().min(1, "Partner name is required").max(255),
  partnerType: z.nativeEnum(PartnerType),
  notes: z.string().optional().nullable(),
  logoUrl: z.string().url("Invalid logo URL format").optional().nullable(),
  photoUrl: z.string().url("Invalid photo URL format").optional().nullable(),
  isUs: z.boolean().optional().nullable(),
  registrationNumber: z.string().max(100).optional().nullable(),
  taxId: z.string().max(100).optional().nullable(),
  bioFatherName: z.string().max(100).optional().nullable(),
  bioMotherName: z.string().max(100).optional().nullable(),
  additionalDetails: z.any().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Parameters for the new "affected/unaffected" logic (Journal as Root)
  const filterStatus = searchParams.get("filterStatus") as
    | "affected"
    | "unaffected"
    | "all"
    | null;
  const contextJournalIdsForFilterStatus =
    searchParams.get("contextJournalIds");

  // Existing parameters for other filtering scenarios
  const partnerTypeParam = searchParams.get(
    "partnerType"
  ) as PartnerType | null;
  const linkedToJournalIdsParam = searchParams.get("linkedToJournalIds"); // For general J-P, J-G-P
  const includeChildrenParam = searchParams.get("includeChildren"); // UI should resolve children to flat list
  const linkedToGoodIdStr = searchParams.get("linkedToGoodId");

  // Pagination
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const take = limitParam ? parseInt(limitParam, 10) : undefined;
  const skip = offsetParam ? parseInt(offsetParam, 10) : undefined;

  // Base options for partnerService.getAllPartners
  const serviceCallOptions: {
    partnerType?: PartnerType;
    take?: number;
    skip?: number;
    where?: Prisma.PartnerWhereInput;
    filterByAffectedJournals?: string[];
    filterByUnaffected?: boolean;
  } = { take, skip };

  if (
    partnerTypeParam &&
    Object.values(PartnerType).includes(partnerTypeParam)
  ) {
    serviceCallOptions.partnerType = partnerTypeParam;
  }

  try {
    let partnersResult: { partners: Partner[]; totalCount: number } | null =
      null;

    // Priority 1: Filter by Journal(s) AND Good (J-G-P flow)
    if (linkedToJournalIdsParam && linkedToGoodIdStr) {
      console.log(
        `API /partners: J-G-P flow. Journals: '${linkedToJournalIdsParam}', Good: '${linkedToGoodIdStr}'.`
      );
      const journalIds = linkedToJournalIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (journalIds.length === 0)
        return NextResponse.json(
          { message: "No valid journal IDs for J-G-P." },
          { status: 400 }
        );

      const goodId = parseBigIntParam(linkedToGoodIdStr, "linkedToGoodId");
      if (goodId === null)
        return NextResponse.json(
          { message: "Invalid linkedToGoodId for J-G-P." },
          { status: 400 }
        );

      const includeChildren = includeChildrenParam !== "false"; // UI resolves children
      const partnerIds = await jpgLinkService.getPartnerIdsForJournalsAndGood(
        journalIds,
        goodId,
        includeChildren
      );

      if (partnerIds.length === 0) {
        partnersResult = { partners: [], totalCount: 0 };
      } else {
        serviceCallOptions.where = { id: { in: partnerIds } };
        // Other filters (partnerType, pagination) will apply via getAllPartners
        partnersResult = await partnerService.getAllPartners(
          serviceCallOptions
        );
      }
    }
    // Priority 2: Filter by Good ID only (e.g., G-P flow)
    else if (linkedToGoodIdStr) {
      console.log(`API /partners: G-P flow. Good: '${linkedToGoodIdStr}'.`);
      const goodId = parseBigIntParam(linkedToGoodIdStr, "linkedToGoodId");
      if (goodId === null)
        return NextResponse.json(
          { message: "Invalid linkedToGoodId." },
          { status: 400 }
        );

      const partnerIds = await jpgLinkService.getPartnerIdsForGood(goodId);
      if (partnerIds.length === 0) {
        partnersResult = { partners: [], totalCount: 0 };
      } else {
        serviceCallOptions.where = { id: { in: partnerIds } };
        partnersResult = await partnerService.getAllPartners(
          serviceCallOptions
        );
      }
    }
    // Priority 3: New Journal Root -> Partner filtering with "filterStatus"
    else if (filterStatus) {
      console.log(
        `API /partners: Journal Root flow with filterStatus: '${filterStatus}'.`
      );
      if (filterStatus === "unaffected") {
        serviceCallOptions.filterByUnaffected = true;
      } else if (filterStatus === "affected") {
        const journalIds =
          contextJournalIdsForFilterStatus
            ?.split(",")
            .map((id) => id.trim())
            .filter(Boolean) || [];
        serviceCallOptions.filterByAffectedJournals = journalIds; // Service handles empty array correctly
      } else if (filterStatus === "all") {
        // "all" means no *additional* journal link filtering from this specific mechanism.
      } else {
        return NextResponse.json(
          { message: `Invalid filterStatus: ${filterStatus}` },
          { status: 400 }
        );
      }
      partnersResult = await partnerService.getAllPartners(serviceCallOptions);
    }
    // Priority 4: Default to "affected" if contextJournalIdsForFilterStatus provided, but no filterStatus
    // (Handles "neither button pressed" in the Journal root scenario when journals are selected)
    else if (contextJournalIdsForFilterStatus) {
      console.log(
        `API /partners: Defaulting to 'affected' from contextJournalIds: [${contextJournalIdsForFilterStatus}].`
      );
      const journalIds =
        contextJournalIdsForFilterStatus
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean) || [];
      serviceCallOptions.filterByAffectedJournals = journalIds;
      partnersResult = await partnerService.getAllPartners(serviceCallOptions);
    }
    // Priority 5: General J-P filtering (partners linked to specific journals, not necessarily root/filterStatus context)
    // This is when `linkedToJournalIdsParam` is present, but not as part of J-G-P, and no filterStatus logic is active.
    else if (linkedToJournalIdsParam) {
      console.log(
        `API /partners: General J-P filtering for journals: '${linkedToJournalIdsParam}'.`
      );
      const journalIds =
        linkedToJournalIdsParam
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean) || [];
      // This behaves like "affected" by these specific journals
      serviceCallOptions.filterByAffectedJournals = journalIds;
      // includeChildren should be handled by client sending resolved IDs in linkedToJournalIdsParam
      partnersResult = await partnerService.getAllPartners(serviceCallOptions);
    }
    // Priority 6: No specific link-based filters - general fetch (with pagination/type)
    else {
      console.log("API /partners: General partner fetch (pagination, type).");
      partnersResult = await partnerService.getAllPartners(serviceCallOptions);
    }

    // Send response
    if (partnersResult) {
      const responsePayload = {
        data: partnersResult.partners,
        total: partnersResult.totalCount,
      };
      const body = JSON.stringify(responsePayload, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      // Should not happen if logic is correct, but as a fallback
      console.error("API /partners: partnersResult was unexpectedly null.");
      return NextResponse.json(
        { message: "Failed to determine partner data." },
        { status: 500 }
      );
    }
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

// POST handler remains the same
export async function POST(request: NextRequest) {
  console.log("Waiter (API /partners): Customer wants to add a new partner.");
  try {
    // --- AUTH ---
    const session = (await getServerSession(
      authOptions
    )) as ExtendedSession | null;
    if (!session?.user?.id || !session?.user?.companyId) {
      return NextResponse.json(
        { message: "Unauthorized: Session or user details missing" },
        { status: 401 }
      );
    }
    // --- END AUTH ---

    const rawOrder = await request.json();
    console.log(
      "Waiter (API /partners): Customer's raw order for new partner:",
      rawOrder
    );

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

    // Add companyId from session and ensure required fields are present
    const {
      name,
      partnerType,
      notes,
      logoUrl,
      photoUrl,
      isUs,
      registrationNumber,
      taxId,
      bioFatherName,
      bioMotherName,
      additionalDetails,
    } = validation.data;
    const validOrderData: CreatePartnerData = {
      name,
      partnerType,
      notes: notes ?? null,
      logoUrl: logoUrl ?? null,
      photoUrl: photoUrl ?? null,
      isUs: isUs ?? null,
      registrationNumber: registrationNumber ?? null,
      taxId: taxId ?? null,
      bioFatherName: bioFatherName ?? null,
      bioMotherName: bioMotherName ?? null,
      additionalDetails: additionalDetails ?? null,
      companyId: session.user.companyId,
    };
    console.log(
      "Waiter (API /partners): Order for new partner is clear. Passing to Chef."
    );

    const newPartner = await partnerService.createPartner(validOrderData);
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
