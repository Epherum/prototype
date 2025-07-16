// src/app/services/goodsService.ts
import prisma from "@/app/utils/prisma";
import { GoodsAndService, Prisma, EntityState } from "@prisma/client";
import { journalService } from "./journalService";
import { ROOT_JOURNAL_ID } from "@/lib/constants";
import { PartnerGoodFilterStatus } from "@/lib/types";

export interface GetAllGoodsOptions {
  where?: Prisma.GoodsAndServiceWhereInput;
  take?: number;
  skip?: number;
  typeCode?: string;
  filterStatuses?: PartnerGoodFilterStatus[];
  contextJournalIds?: string[];
  currentUserId?: string;
  restrictedJournalId?: string | null;
}

export type CreateGoodsData = {
  createdById: string;
  label: string;
  referenceCode?: string | null;
  barcode?: string | null;
  taxCodeId?: number | null;
  typeCode?: string | null;
  description?: string | null;
  unitCodeId?: number | null;
  stockTrackingMethod?: string | null;
  packagingTypeCode?: string | null;
  photoUrl?: string | null;
  additionalDetails?: any;
};

export type UpdateGoodsData = Partial<
  Omit<CreateGoodsData, "referenceCode" | "barcode">
>;

const goodsService = {
  async createGood(data: CreateGoodsData): Promise<GoodsAndService> {
    console.log("GoodsService: Creating new item:", data.label);

    if (data.taxCodeId) {
      const taxCodeExists = await prisma.taxCode.findUnique({
        where: { id: data.taxCodeId },
      });
      if (!taxCodeExists)
        throw new Error(`Tax Code with ID ${data.taxCodeId} not found.`);
    }
    if (data.unitCodeId) {
      const unitExists = await prisma.unitOfMeasure.findUnique({
        where: { id: data.unitCodeId },
      });
      if (!unitExists)
        throw new Error(
          `Unit of Measure with ID ${data.unitCodeId} not found.`
        );
    }

    const { createdById, ...restOfData } = data;

    const newGood = await prisma.goodsAndService.create({
      data: {
        ...restOfData,
        createdBy: { connect: { id: createdById } },
      },
    });

    console.log(
      "GoodsService: Item",
      newGood.label,
      "created with ID:",
      newGood.id
    );
    return newGood;
  },

  async getGoodById(id: bigint): Promise<GoodsAndService | null> {
    return prisma.goodsAndService.findUnique({
      where: { id },
      include: { taxCode: true, unitOfMeasure: true },
    });
  },

  async getAllGoods(
    options: GetAllGoodsOptions
  ): Promise<{ goods: GoodsAndService[]; totalCount: number }> {
    console.log("GoodsService: Fetching items with rules:", options);

    const {
      filterStatuses = [],
      contextJournalIds = [],
      currentUserId,
      restrictedJournalId,
      where: externalWhere,
      typeCode,
      ...restOfOptions
    } = options;

    if (filterStatuses.length > 0 && !currentUserId) {
      console.warn(
        "GoodsService: Filters require a currentUserId, but none provided."
      );
      return { goods: [], totalCount: 0 };
    }

    let prismaWhere: Prisma.GoodsAndServiceWhereInput = {
      entityState: EntityState.ACTIVE,
      ...(typeCode && { typeCode: typeCode }),
      ...externalWhere,
    };

    const isRootUser =
      !restrictedJournalId || restrictedJournalId === ROOT_JOURNAL_ID;

    if (filterStatuses.length > 0) {
      const orConditions: Prisma.GoodsAndServiceWhereInput[] = [];
      const descendantIds =
        !isRootUser && filterStatuses.includes("unaffected")
          ? await journalService.getDescendantJournalIds(restrictedJournalId!) // companyId removed
          : [];

      for (const status of filterStatuses) {
        switch (status) {
          case "affected":
            if (contextJournalIds.length > 0) {
              orConditions.push({
                journalGoodLinks: {
                  some: { journalId: { in: contextJournalIds } },
                },
              });
            }
            break;
          case "unaffected":
            if (isRootUser) {
              orConditions.push({
                AND: [
                  { journalGoodLinks: { none: {} } },
                  { createdById: { not: currentUserId } },
                ],
              });
            } else {
              orConditions.push({
                AND: [
                  {
                    journalGoodLinks: {
                      some: { journalId: restrictedJournalId! },
                    },
                  },
                  ...(descendantIds.length > 0
                    ? [
                        {
                          NOT: {
                            journalGoodLinks: {
                              some: { journalId: { in: descendantIds } },
                            },
                          },
                        },
                      ]
                    : []),
                ],
              });
            }
            break;
          case "inProcess":
            if (isRootUser) {
              orConditions.push({
                AND: [
                  { journalGoodLinks: { none: {} } },
                  { createdById: currentUserId },
                ],
              });
            } else {
              orConditions.push({
                AND: [
                  {
                    journalGoodLinks: {
                      none: { journalId: restrictedJournalId! },
                    },
                  },
                  { createdById: currentUserId },
                ],
              });
            }
            break;
        }
      }

      if (orConditions.length > 0) {
        prismaWhere.OR = orConditions;
      } else {
        return { goods: [], totalCount: 0 };
      }
    }

    const totalCount = await prisma.goodsAndService.count({
      where: prismaWhere,
    });
    const goods = await prisma.goodsAndService.findMany({
      where: prismaWhere,
      take: restOfOptions.take,
      skip: restOfOptions.skip,
      orderBy: { label: "asc" },
      include: { taxCode: true, unitOfMeasure: true },
    });

    return { goods, totalCount };
  },

  async updateGood(
    id: bigint,
    data: UpdateGoodsData
  ): Promise<GoodsAndService | null> {
    // This function's logic remains largely the same
    try {
      return await prisma.goodsAndService.update({ where: { id }, data: data });
    } catch (error) {
      return null;
    }
  },

  async deleteGood(id: bigint): Promise<GoodsAndService | null> {
    // This function's logic remains the same
    try {
      return await prisma.goodsAndService.delete({ where: { id } });
    } catch (error) {
      return null;
    }
  },

  /**
   * ✅ RENAMED & REFACTORED
   * This single function now finds goods for partners based on the number of IDs provided.
   * - If one partnerId is given, it finds all goods for that partner.
   * - If multiple partnerIds are given, it finds the INTERSECTION of goods common to ALL of them.
   *
   * @param partnerIds - An array of one or more Partner IDs.
   * @param journalId - The Journal ID context.
   * @returns A response containing the relevant goods.
   */
  async findGoodsForPartners(
    partnerIds: bigint[],
    journalId: string
  ): Promise<{ goods: GoodsAndService[]; totalCount: number }> {
    console.groupCollapsed(
      `[DATABASE-SERVICE: findGoodsForPartners (UNIFIED LOGIC)]`
    );
    console.log(
      "INPUTS -> partnerIds:",
      partnerIds,
      `| journalId: "${journalId}"`
    );

    if (partnerIds.length === 0 || !journalId) {
      console.log("EXIT: No partner IDs or journalId provided.");
      console.groupEnd();
      return { goods: [], totalCount: 0 };
    }

    const uniqueInputPartnerIds = new Set(partnerIds);

    // Step 1: Find all `journalPartnerLink` records that match our specific partners AND the journal.
    const relevantLinks = await prisma.journalPartnerLink.findMany({
      where: {
        journalId: journalId,
        partnerId: { in: Array.from(uniqueInputPartnerIds) },
      },
      select: {
        id: true,
      },
    });

    if (relevantLinks.length < uniqueInputPartnerIds.size) {
      console.log("EXIT: Not all partners have links in this journal.");
      console.groupEnd();
      return { goods: [], totalCount: 0 };
    }

    const relevantLinkIds = relevantLinks.map((link) => link.id);

    // Step 2: This is the core logic. It finds `goodId`s that are linked to a number of our
    // relevant partners that EQUALS the number of unique partners we're searching for.
    // This naturally handles the N=1 case (finds goods linked to 1 partner) and the N>1
    // case (finds goods linked to ALL N partners).
    const goodIdGroups = await prisma.journalPartnerGoodLink.groupBy({
      by: ["goodId"],
      where: {
        journalPartnerLinkId: { in: relevantLinkIds },
      },
      _count: {
        journalPartnerLinkId: true,
      },
      having: {
        journalPartnerLinkId: {
          _count: {
            equals: uniqueInputPartnerIds.size,
          },
        },
      },
    });

    const intersectingGoodIds = goodIdGroups.map((group) => group.goodId);

    if (intersectingGoodIds.length === 0) {
      console.log("EXIT: No goods found matching the criteria.");
      console.groupEnd();
      return { goods: [], totalCount: 0 };
    }

    // Step 3: Fetch the full good details for the resulting IDs.
    const goods = await prisma.goodsAndService.findMany({
      where: {
        id: { in: intersectingGoodIds },
        entityState: "ACTIVE",
      },
      orderBy: { label: "asc" },
      include: { taxCode: true, unitOfMeasure: true },
    });

    console.log(`Found ${goods.length} goods. Total matching: ${goods.length}`);
    console.groupEnd();

    return { goods, totalCount: goods.length };
  },
};

export default goodsService;
