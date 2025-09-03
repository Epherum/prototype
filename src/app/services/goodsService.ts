//src/app/services/goodsService.ts
import prisma from "@/app/utils/prisma";
import { GoodsAndService, Prisma, EntityState, ApprovalStatus } from "@prisma/client";
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
    
    // Validate related entities
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

    const { createdById, journalId, ...restOfData } = data;
    
    // Get the complete ancestor path for the selected journal
    const ancestorPath = await journalService.getJournalAncestorPath(journalId);
    serviceLogger.debug("goodsService.createGood: Ancestor path", { ancestorPath });

    // Get the journal level for the creation journal
    const creationJournalLevel = await journalService.getJournalLevel(journalId);
    serviceLogger.debug("goodsService.createGood: Creation journal level", { creationJournalLevel });

    // Create the good first
    const newGood = await prisma.goodsAndService.create({
      data: {
        ...restOfData,
        status: { connect: { id: restOfData.statusId || "pending-default" } }, // Connect to status
        createdBy: { connect: { id: createdById } },
        creationJournalLevel: creationJournalLevel,
      },
    });
    
    // Create journal-good links for the entire hierarchy path
    // Note: JournalGoodLinks are automatically approved (no approval workflow needed)
    const journalGoodLinks = ancestorPath.map(journalId => ({
      journalId,
      goodId: newGood.id,
      creationLevel: creationJournalLevel,
      approvalStatus: "APPROVED", // Auto-approve journal-good links
      currentPendingLevel: creationJournalLevel, // Set to creation level (fully approved)
    }));
    
    await prisma.journalGoodLink.createMany({
      data: journalGoodLinks,
    });
    
    serviceLogger.debug("goodsService.createGood: Created journal links", { 
      goodId: newGood.id, 
      linkedJournals: ancestorPath 
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
      activeFilterModes,
      permissionRootId,
      selectedJournalIds = [],
      where: externalWhere,
    } = options;

    let prismaWhere: Prisma.GoodsAndServiceWhereInput = {
      entityState: EntityState.ACTIVE,
      ...externalWhere,
    };

    // Use activeFilterModes if provided, otherwise fall back to single filterMode
    // IMPORTANT: Filter out 'pending' - it's only for ApprovalCenter, not main sliders
    const rawFilters = activeFilterModes?.length > 0 
      ? activeFilterModes 
      : filterMode ? [filterMode] : [];
    const filtersToApply = rawFilters.filter(filter => filter !== 'pending');

    if (filtersToApply.length > 0) {
      if (selectedJournalIds.length === 0) {
        serviceLogger.warn(
          "goodsService.getAllGoods: Filter modes were provided without 'selectedJournalIds'. Returning empty."
        );
        return { data: [], totalCount: 0 };
      }

      // For multi-filter mode, we need intersection logic (AND) not union (OR)
      if (filtersToApply.length > 1) {
        // Build all filter clauses and combine them with AND logic
        const allFilterClauses = await this.buildMultiFilterClauses(
          filtersToApply,
          selectedJournalIds,
          permissionRootId
        );
        
        if (allFilterClauses.length === 0) {
          serviceLogger.warn(
            "goodsService.getAllGoods: No valid filter clauses generated for multi-filter. Returning empty."
          );
          return { data: [], totalCount: 0 };
        }
        
        // Combine all filter clauses with AND logic
        prismaWhere.AND = allFilterClauses;
      } else {
        // Single filter mode - use existing logic
        const filterClauses = await this.buildMultiFilterClauses(
          filtersToApply,
          selectedJournalIds,
          permissionRootId
        );
        
        if (filterClauses.length === 0) {
          serviceLogger.warn(
            "goodsService.getAllGoods: No valid filter clauses generated. Returning empty."
          );
          return { data: [], totalCount: 0 };
        }
        
        prismaWhere.AND = [filterClauses[0]];
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

    // Add matchedFilters information for single filter mode
    const dataWithFilters = data.map(good => ({
      ...good,
      matchedFilters: filtersToApply.length > 0 ? filtersToApply : undefined
    }));

    serviceLogger.debug("goodsService.getAllGoods: Output", {
      count: data.length,
      totalCount,
    });
    return { data: dataWithFilters, totalCount };
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
        approvalStatus: "APPROVED", // Only approved links
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
    // IMPORTANT: Only approved links should show in main sliders
    const journalPartnerGoodLinks = await prisma.journalPartnerGoodLink.findMany({
      where: {
        journalPartnerLinkId: { in: linkIds },
        approvalStatus: "APPROVED", // Only approved links
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

  /**
   * Builds filter clauses for multiple filter modes
   */
  async buildMultiFilterClauses(
    filterModes: string[],
    selectedJournalIds: string[],
    permissionRootId?: string
  ): Promise<Prisma.GoodsAndServiceWhereInput[]> {
    const clauses: Prisma.GoodsAndServiceWhereInput[] = [];
    
    // Get all descendant IDs for all selected journals (shared across filters)
    const allJournalIds = new Set<string>();
    for (const journalId of selectedJournalIds) {
      allJournalIds.add(journalId);
      const descendants = await journalService.getDescendantJournalIds(journalId);
      descendants.forEach(id => allJournalIds.add(id));
    }
    const allRelevantJournalIds = Array.from(allJournalIds);
    
    for (const mode of filterModes) {
      switch (mode) {
        case "affected":
          clauses.push({
            AND: [
              { approvalStatus: "APPROVED" },
              {
                journalGoodLinks: {
                  some: { journalId: { in: allRelevantJournalIds } },
                },
              },
            ],
          });
          break;
          
        case "unaffected":
          if (!permissionRootId) {
            serviceLogger.warn(
              "goodsService.buildMultiFilterClauses: 'unaffected' filter requires 'permissionRootId'. Skipping."
            );
            continue;
          }
          
          // Get the parent paths for each selected journal
          const goodsParentPaths: string[] = [];
          for (const journalId of selectedJournalIds) {
            const ancestorPath = await journalService.getJournalAncestorPath(journalId);
            // Remove the deepest journal (the one selected) from the path to get parent path
            const parentPath = ancestorPath.slice(1); // Remove the first element (deepest)
            goodsParentPaths.push(...parentPath);
          }
          
          // Remove duplicates from parent paths
          const uniqueGoodsParentPaths = [...new Set(goodsParentPaths)];
          
          if (uniqueGoodsParentPaths.length === 0) {
            serviceLogger.warn(
              "goodsService.buildMultiFilterClauses: No parent paths found for 'unaffected' mode. Skipping."
            );
            continue;
          }
          
          // Find goods linked directly to the selected (deepest) journals
          const affectedGoodLinks = await prisma.journalGoodLink.findMany({
            where: { journalId: { in: selectedJournalIds } },
            select: { goodId: true },
          });
          const affectedGoodIds = affectedGoodLinks.map((p) => p.goodId);
          
          clauses.push({
            AND: [
              { approvalStatus: "APPROVED" },
              {
                journalGoodLinks: {
                  some: { journalId: { in: uniqueGoodsParentPaths } },
                },
              },
              { id: { notIn: affectedGoodIds } },
            ],
          });
          break;
          
        case "inProcess":
          clauses.push({
            AND: [
              { status: { name: "Pending" } },
              {
                journalGoodLinks: {
                  some: { journalId: { in: allRelevantJournalIds } },
                },
              },
            ],
          });
          break;
          
        case "pending":
          // Skip 'pending' filter - it's only for ApprovalCenter, not main sliders
          serviceLogger.warn(
            "goodsService.buildMultiFilterClauses: 'pending' filter should not be processed by main sliders. Skipping."
          );
          continue;
      }
    }
    
    return clauses;
  },
};

export default goodsService;
