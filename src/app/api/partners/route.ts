// src/app/api/partners/route.ts
import { NextRequest, NextResponse } from "next/server";
import partnerService, {
  createPartnerSchema,
  GetAllPartnersOptions,
  CreatePartnerData as ServiceCreatePartnerData,
} from "@/app/services/partnerService";
import { Partner } from "@prisma/client";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService";
import { getServerSession } from "next-auth/next";
import {
  authOptions,
  ExtendedSession,
  ExtendedUser,
} from "@/lib/auth/authOptions";
import { PartnerGoodFilterStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as ExtendedUser;
  const currentUserId = user.id;

  const { searchParams } = new URL(request.url);

  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const take = limitParam ? parseInt(limitParam, 10) : undefined;
  const skip = offsetParam ? parseInt(offsetParam, 10) : undefined;

  const filterStatusesParam = searchParams.get("filterStatuses");
  const contextJournalIdsParam = searchParams.get("contextJournalIds");
  const restrictedJournalId = searchParams.get("restrictedJournalId");

  const linkedToJournalIdsParam = searchParams.get("linkedToJournalIds");
  const linkedToGoodIdStr = searchParams.get("linkedToGoodId");
  const includeChildrenParam = searchParams.get("includeChildren");

  try {
    let partnersResult: { partners: Partner[]; totalCount: number };

    const serviceCallOptions: GetAllPartnersOptions = {
      currentUserId,
      take,
      skip,
    };

    // Priority 1: Linking flows (J-G-P / G-J-P)
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
      const partnerIds = await jpgLinkService.getPartnerIdsForJournalsAndGood(
        journalIds,
        goodId,
        includeChildrenParam !== "false"
      );
      serviceCallOptions.where = { id: { in: partnerIds } };
      partnersResult =
        partnerIds.length === 0
          ? { partners: [], totalCount: 0 }
          : await partnerService.getAllPartners(serviceCallOptions);
    }
    // Priority 2: Standard Journal-as-Root filtering flow
    else {
      console.log(
        `API /partners: Standard flow. Filters: '${
          filterStatusesParam || "none"
        }'`
      );
      const filterStatuses = filterStatusesParam
        ? (filterStatusesParam
            .split(",")
            .filter(Boolean) as PartnerGoodFilterStatus[])
        : [];
      const contextJournalIds =
        contextJournalIdsParam
          ?.split(",")
          .map((id) => id.trim())
          .filter(Boolean) || [];

      serviceCallOptions.filterStatuses = filterStatuses;
      serviceCallOptions.contextJournalIds = contextJournalIds;
      serviceCallOptions.restrictedJournalId = restrictedJournalId || null;

      partnersResult = await partnerService.getAllPartners(serviceCallOptions);
    }

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
      { message: "Failed to retrieve partner list.", error: e.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log("API /partners: Received request to add a new partner.");
  const session = (await getServerSession(
    authOptions
  )) as ExtendedSession | null;
  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "Unauthorized: User session is missing" },
      { status: 401 }
    );
  }
  const createdById = session.user.id;
  const createdByIp =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;

  try {
    const rawOrder = await request.json();
    console.log("API /partners: Raw payload for new partner:", rawOrder);

    const validation = createPartnerSchema.safeParse(rawOrder);
    if (!validation.success) {
      console.warn(
        "API /partners: Invalid payload for new partner:",
        validation.error.format()
      );
      return NextResponse.json(
        {
          message: "Invalid partner payload.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const partnerDataForService: ServiceCreatePartnerData = validation.data;
    console.log("API /partners: Payload is valid. Passing to service.");

    // Call the service without companyId
    const newPartner = await partnerService.createPartner(
      partnerDataForService,
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
      "API /partners: Failed to add new partner!",
      e.message,
      e.stack
    );
    return NextResponse.json(
      { message: "Failed to add the new partner.", error: e.message },
      { status: 500 }
    );
  }
}
