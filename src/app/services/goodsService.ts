// File: src/app/services/goodsService.ts
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

  // Add this function to your existing goodsService.ts file

  /**
   * Finds goods that are linked to ALL specified partners within a given journal context.
   * @param partnerIds - An array of Partner IDs.
   * @param journalId - The Journal ID context.
   * @returns A paginated response of goods that are common to all partners.
   */
  async findGoodsForPartnersIntersection(
    partnerIds: bigint[],
    journalId: string
  ): Promise<{ goods: GoodsAndService[]; totalCount: number }> {
    if (partnerIds.length === 0) {
      return { goods: [], totalCount: 0 };
    }

    // Find the JournalPartnerLink IDs for the given journal and partners.
    const journalPartnerLinks = await prisma.journalPartnerLink.findMany({
      where: {
        journalId: journalId,
        partnerId: { in: partnerIds },
      },
      select: { id: true, partnerId: true },
    });

    // Early exit if not all partners are even linked to the journal.
    const uniquePartnerIdsInLinks = new Set(
      journalPartnerLinks.map((l) => l.partnerId.toString())
    );
    if (uniquePartnerIdsInLinks.size < partnerIds.length) {
      return { goods: [], totalCount: 0 };
    }

    const journalPartnerLinkIds = journalPartnerLinks.map((jpl) => jpl.id);

    // Group by goodId, and only return those that are linked to a number of
    // JournalPartnerLinks equal to the number of partners we're searching for.
    const goodIdGroups = await prisma.journalPartnerGoodLink.groupBy({
      by: ["goodId"],
      where: {
        journalPartnerLinkId: { in: journalPartnerLinkIds },
      },
      _count: {
        journalPartnerLinkId: true,
      },
      having: {
        journalPartnerLinkId: {
          _count: {
            equals: partnerIds.length,
          },
        },
      },
    });

    const intersectingGoodIds = goodIdGroups.map((group) => group.goodId);

    if (intersectingGoodIds.length === 0) {
      return { goods: [], totalCount: 0 };
    }

    // Fetch the actual good data based on the resulting IDs.
    const totalCount = intersectingGoodIds.length;
    const goods = await prisma.goodsAndService.findMany({
      where: {
        id: { in: intersectingGoodIds },
      },
    });

    return { goods, totalCount };
  },
};

export default goodsService;
