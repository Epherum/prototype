//src/app/services/goodsService.ts
import prisma from "@/app/utils/prisma";
import { GoodsAndService, Prisma, EntityState } from "@prisma/client";
import { journalService } from "./journalService";
import {
  GetAllItemsOptions,
  IntersectionFindOptions,
} from "@/lib/types/serviceOptions";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
// ✅ CORRECTED IMPORT: Import from the new shared types file
import { CreateGoodsData, UpdateGoodsData } from "@/lib/types/service.types";
import { serviceLogger } from "@/lib/logger";

const goodsService = {
  async createGood(data: CreateGoodsData): Promise<GoodsAndService> {
    serviceLogger.debug("goodsService.createGood: Input", data);
    // ... existing implementation ...
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
    serviceLogger.debug("goodsService.createGood: Output", newGood);
    return newGood;
  },

  async getGoodById(id: bigint): Promise<GoodsAndService | null> {
    serviceLogger.debug("goodsService.getGoodById: Input", { id });
    const good = await prisma.goodsAndService.findUnique({
      where: { id },
      include: { taxCode: true, unitOfMeasure: true },
    });
    serviceLogger.debug("goodsService.getGoodById: Output", good);
    return good;
  },

  /**
   * ✏️ MODIFIED: A comprehensive fetch function for Goods.
   * Handles initial population and filtering by Journal selection with 'affected', 'unaffected', and 'inProcess' modes.
   */
  async getAllGoods(
    options: GetAllItemsOptions<Prisma.GoodsAndServiceWhereInput>
  ): Promise<{ data: GoodsAndService[]; totalCount: number }> {
    serviceLogger.debug(
      "goodsService.getAllGoods: Input",
      JSON.stringify(options, jsonBigIntReplacer)
    );

    const {
      take,
      skip,
      restrictedJournalId,
      filterMode,
      permissionRootId,
      selectedJournalIds = [],
      where: externalWhere,
    } = options;

    let prismaWhere: Prisma.GoodsAndServiceWhereInput = {
      entityState: EntityState.ACTIVE,
      ...externalWhere,
    };

    if (filterMode) {
      if (selectedJournalIds.length === 0) {
        serviceLogger.warn(
          "goodsService.getAllGoods: 'filterMode' was provided without 'selectedJournalIds'. Returning empty."
        );
        return { data: [], totalCount: 0 };
      }

      // Get all descendant IDs for all selected journals
      const allJournalIds = new Set<string>();
      
      for (const journalId of selectedJournalIds) {
        allJournalIds.add(journalId);
        const descendants = await journalService.getDescendantJournalIds(journalId);
        descendants.forEach(id => allJournalIds.add(id));
      }
      
      const allRelevantJournalIds = Array.from(allJournalIds);

      switch (filterMode) {
        case "affected":
          // Find goods linked to any of the selected journals or their descendants
          prismaWhere.journalGoodLinks = {
            some: { journalId: { in: allRelevantJournalIds } },
          };
          break;

        case "unaffected":
          if (!permissionRootId) {
            serviceLogger.warn(
              "goodsService.getAllGoods: 'unaffected' filter requires 'permissionRootId'. Returning empty."
            );
            return { data: [], totalCount: 0 };
          }
          // 1. Get all good IDs linked to any of the selected journals and their descendants
          const affectedGoodLinks = await prisma.journalGoodLink.findMany({
            where: { journalId: { in: allRelevantJournalIds } },
            select: { goodId: true },
          });
          const affectedGoodIds = affectedGoodLinks.map((p) => p.goodId);

          // 2. Get all descendant journals for the overall permission scope.
          const descendantIds = await journalService.getDescendantJournalIds(
            permissionRootId
          );

          // 3. Find goods linked anywhere in the permission scope...
          // 4. ...but exclude those found in the 'affected' list.
          prismaWhere.AND = [
            {
              journalGoodLinks: {
                some: {
                  journalId: { in: [...descendantIds, permissionRootId] },
                },
              },
            },
            {
              id: { notIn: affectedGoodIds },
            },
          ];
          break;

        case "inProcess":
          // The spec `{ approvalStatus: 'PENDING' }` doesn't apply to the Goods model.
          // This mode is not applicable to Goods as they lack a status field.
          serviceLogger.warn(
            "goodsService.getAllGoods: 'inProcess' filter is not applicable to Goods. Returning empty."
          );
          return { data: [], totalCount: 0 };
      }
    } else if (restrictedJournalId) {
      // Default behavior: Fetch all goods within the user's permitted journal hierarchy.
      const descendantIds = await journalService.getDescendantJournalIds(
        restrictedJournalId
      );
      prismaWhere.journalGoodLinks = {
        some: { journalId: { in: [...descendantIds, restrictedJournalId] } },
      };
    }

    const totalCount = await prisma.goodsAndService.count({
      where: prismaWhere,
    });
    const data = await prisma.goodsAndService.findMany({
      where: prismaWhere,
      take,
      skip,
      orderBy: { label: "asc" },
      include: { 
        taxCode: true, 
        unitOfMeasure: true,
        journalGoodLinks: {
          include: {
            journal: {
              select: {
                id: true,
                name: true,
                parentId: true,
              }
            }
          }
        }
      },
    });

    serviceLogger.debug("goodsService.getAllGoods: Output", {
      count: data.length,
      totalCount,
    });
    return { data, totalCount };
  },

  /**
   * ✏️ MODIFIED: Finds goods that are common to ALL specified partners.
   * Can be optionally filtered to a specific set of journals.
   */
  async findGoodsForPartners(
    options: IntersectionFindOptions
  ): Promise<{ data: GoodsAndService[]; totalCount: number }> {
    serviceLogger.debug(
      "goodsService.findGoodsForPartners: Input",
      JSON.stringify(options, jsonBigIntReplacer)
    );
    const { partnerIds, journalIds } = options;

    if (!partnerIds || partnerIds.length === 0) {
      return { data: [], totalCount: 0 };
    }

    const uniquePartnerIds = [...new Set(partnerIds)];

    // 1. Find all `journalPartnerLink` records that match our partners, optionally filtered by journal.
    const jplWhere: Prisma.JournalPartnerLinkWhereInput = {
      partnerId: { in: uniquePartnerIds },
    };
    if (journalIds && journalIds.length > 0) {
      jplWhere.journalId = { in: journalIds };
    }

    const relevantLinks = await prisma.journalPartnerLink.findMany({
      where: jplWhere,
      select: { id: true },
    });

    // Optimization: If not all partners have links in the given context, no intersection is possible.
    if (relevantLinks.length < uniquePartnerIds.length) {
      return { data: [], totalCount: 0 };
    }

    const relevantLinkIds = relevantLinks.map((link) => link.id);

    // 2. Group by `goodId` and find those that are linked to a count of partners
    // equal to the number of partners we're searching for.
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
            equals: uniquePartnerIds.length,
          },
        },
      },
    });

    const intersectingGoodIds = goodIdGroups.map((group) => group.goodId);
    if (intersectingGoodIds.length === 0) {
      return { data: [], totalCount: 0 };
    }

    // 3. Fetch the full good details for the resulting IDs.
    const data = await prisma.goodsAndService.findMany({
      where: {
        id: { in: intersectingGoodIds },
        entityState: "ACTIVE",
      },
      orderBy: { label: "asc" },
      include: { 
        taxCode: true, 
        unitOfMeasure: true,
        journalGoodLinks: {
          include: {
            journal: {
              select: {
                id: true,
                name: true,
                parentId: true,
              }
            }
          }
        }
      },
    });

    serviceLogger.debug("goodsService.findGoodsForPartners: Output", {
      count: data.length,
    });
    return { data, totalCount: data.length };
  },

  /**
   * Finds goods that are available to a specific partner within specific journal contexts.
   * Uses the three-way JournalPartnerGoodLink relationship for standard mode filtering.
   */
  async findGoodsForPartnerAndJournals(
    partnerId: bigint,
    journalIds: string[]
  ): Promise<{ data: GoodsAndService[]; totalCount: number }> {
    serviceLogger.debug(
      "goodsService.findGoodsForPartnerAndJournals: Input",
      { partnerId: partnerId.toString(), journalIds }
    );

    if (!partnerId || !journalIds || journalIds.length === 0) {
      return { data: [], totalCount: 0 };
    }

    // Find the journal-partner links for this specific partner and journals
    const journalPartnerLinks = await prisma.journalPartnerLink.findMany({
      where: {
        partnerId: partnerId,
        journalId: { in: journalIds },
      },
      select: { id: true },
    });

    if (journalPartnerLinks.length === 0) {
      return { data: [], totalCount: 0 };
    }

    const linkIds = journalPartnerLinks.map(link => link.id);

    // Find goods that have three-way links with these journal-partner links
    const journalPartnerGoodLinks = await prisma.journalPartnerGoodLink.findMany({
      where: {
        journalPartnerLinkId: { in: linkIds },
      },
      select: { goodId: true },
      distinct: ['goodId'],
    });

    if (journalPartnerGoodLinks.length === 0) {
      return { data: [], totalCount: 0 };
    }

    const goodIds = journalPartnerGoodLinks.map(link => link.goodId);

    // Fetch the full good details with journal-partner-good links
    const data = await prisma.goodsAndService.findMany({
      where: {
        id: { in: goodIds },
        entityState: "ACTIVE",
      },
      orderBy: { label: "asc" },
      include: { 
        taxCode: true, 
        unitOfMeasure: true,
        journalGoodLinks: {
          include: {
            journal: {
              select: {
                id: true,
                name: true,
                parentId: true,
              }
            }
          }
        },
        journalPartnerGoodLinks: {
          where: {
            journalPartnerLinkId: { in: linkIds }
          },
          include: {
            journalPartnerLink: {
              select: {
                id: true,
                partnerId: true,
                journalId: true
              }
            }
          }
        }
      },
    });

    // Add jpqLinkId to each good based on the current partner and journal context
    const dataWithJpqLinkId = data.map(good => {
      // Find the appropriate journalPartnerGoodLink for this context
      const relevantLink = good.journalPartnerGoodLinks.find(jpgLink => 
        jpgLink.journalPartnerLink.partnerId === partnerId &&
        journalIds.includes(jpgLink.journalPartnerLink.journalId)
      );
      
      return {
        ...good,
        jpqLinkId: relevantLink ? String(relevantLink.id) : undefined
      };
    });

    serviceLogger.debug("goodsService.findGoodsForPartnerAndJournals: Output", {
      count: dataWithJpqLinkId.length,
    });
    return { data: dataWithJpqLinkId, totalCount: dataWithJpqLinkId.length };
  },

  /**
   * ✅ NEW: Get goods that are linked to a specific document through DocumentLine
   */
  async findGoodsForDocument(documentId: bigint): Promise<{ data: GoodsAndService[]; totalCount: number }> {
    serviceLogger.debug(
      `goodsService.findGoodsForDocument: Input - documentId: '${documentId}'`
    );

    if (!documentId) {
      serviceLogger.debug(
        "goodsService.findGoodsForDocument: Output - No documentId provided, returning empty array."
      );
      return { data: [], totalCount: 0 };
    }

    const data = await prisma.goodsAndService.findMany({
      where: {
        entityState: EntityState.ACTIVE,
        documentLines: {
          some: { documentId },
        },
      },
      distinct: ['id'],
      orderBy: { label: 'asc' },
    });

    serviceLogger.debug(
      `goodsService.findGoodsForDocument: Output - Found ${data.length} goods.`
    );
    return { data, totalCount: data.length };
  },

  async updateGood(
    id: bigint,
    data: UpdateGoodsData
  ): Promise<GoodsAndService | null> {
    serviceLogger.debug("goodsService.updateGood: Input", { id, data });
    // ... existing implementation ...
    const updatedGood = await prisma.goodsAndService.update({
      where: { id },
      data: data,
    });
    serviceLogger.debug("goodsService.updateGood: Output", updatedGood);
    return updatedGood;
  },

  async deleteGood(id: bigint): Promise<GoodsAndService | null> {
    serviceLogger.debug("goodsService.deleteGood: Input", { id });
    // ... existing implementation ...
    const deletedGood = await prisma.goodsAndService.delete({ where: { id } });
    serviceLogger.debug("goodsService.deleteGood: Output", deletedGood);
    return deletedGood;
  },
};

export default goodsService;
