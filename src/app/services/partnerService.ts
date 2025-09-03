// src/app/services/partnerService.ts

import prisma from "@/app/utils/prisma";
import { Partner, Prisma, EntityState, ApprovalStatus } from "@prisma/client";
import { journalService } from "./journalService";
import {
  GetAllItemsOptions,
  IntersectionFindOptions,
} from "@/lib/types/serviceOptions";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import {
  CreatePartnerPayload,
  UpdatePartnerPayload,
} from "@/lib/schemas/partner.schema";
import { serviceLogger } from "@/lib/logger";

const partnerService = {
  // ✅ ENHANCED: Now includes automatic hierarchical journal linking
  async createPartner(
    data: CreatePartnerPayload,
    createdById: string
  ): Promise<Partner> {
    serviceLogger.debug("partnerService.createPartner: Input", { data, createdById });
    
    const { journalId, ...partnerData } = data;
    
    // Get the complete ancestor path for the selected journal
    const ancestorPath = await journalService.getJournalAncestorPath(journalId);
    serviceLogger.debug("partnerService.createPartner: Ancestor path", { ancestorPath });
    
    // Get the journal level for the creation journal
    const creationJournalLevel = await journalService.getJournalLevel(journalId);
    serviceLogger.debug("partnerService.createPartner: Creation journal level", { creationJournalLevel });
    
    // Create the partner first
    const newPartner = await prisma.partner.create({
      data: {
        ...partnerData,
        createdById: createdById,
        entityState: EntityState.ACTIVE,
        statusId: partnerData.statusId || "pending-default",
        creationJournalLevel: creationJournalLevel,
      },
    });
    
    // Create journal-partner links for the entire hierarchy path
    // Note: JournalPartnerLinks are automatically approved (no approval workflow needed)
    const journalPartnerLinks = ancestorPath.map(journalId => ({
      journalId,
      partnerId: newPartner.id,
      partnershipType: "STANDARD_TRANSACTION", // Default partnership type
      creationLevel: creationJournalLevel,
      approvalStatus: "APPROVED", // Auto-approve journal-partner links
      currentPendingLevel: creationJournalLevel, // Set to creation level (fully approved)
    }));
    
    await prisma.journalPartnerLink.createMany({
      data: journalPartnerLinks,
    });
    
    serviceLogger.debug("partnerService.createPartner: Created journal links", { 
      partnerId: newPartner.id, 
      linkedJournals: ancestorPath 
    });
    serviceLogger.debug("partnerService.createPartner: Output", newPartner);
    return newPartner;
  },

  async getPartnerById(id: bigint): Promise<Partner | null> {
    serviceLogger.debug("partnerService.getPartnerById: Input", { id });
    const partner = await prisma.partner.findUnique({ where: { id } });
    serviceLogger.debug("partnerService.getPartnerById: Output", partner);
    return partner;
  },

  async getAllPartners(
    options: GetAllItemsOptions<Prisma.PartnerWhereInput>
  ): Promise<{ data: Partner[]; totalCount: number }> {
    serviceLogger.debug(
      `partnerService.getAllPartners: Input ${JSON.stringify(options, jsonBigIntReplacer)}`
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
    let prismaWhere: Prisma.PartnerWhereInput = {
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
          "partnerService.getAllPartners: Filter modes were provided without 'selectedJournalIds'. Returning empty."
        );
        return { data: [], totalCount: 0 };
      }
      
      serviceLogger.debug("partnerService.getAllPartners: Multi-filter mode processing", {
        filtersToApply,
        selectedJournalIds,
        permissionRootId
      });
      
      // The selectedJournalIds represent the effective path IDs from the frontend
      // According to the documentation, these are already the complete paths we need to filter by
      const journalIdsString = selectedJournalIds;
      
      serviceLogger.debug("partnerService.getAllPartners: Selected journal IDs for filtering", {
        selectedJournalIds,
        journalIdsString
      });
      
      // For multi-filter mode, we need intersection logic (AND) not union (OR)
      if (filtersToApply.length > 1) {
        // Build all filter clauses and combine them with AND logic
        const allFilterClauses = await this.buildMultiFilterClauses(
          filtersToApply,
          journalIdsString,
          permissionRootId
        );
        
        if (allFilterClauses.length === 0) {
          serviceLogger.warn(
            "partnerService.getAllPartners: No valid filter clauses generated for multi-filter. Returning empty."
          );
          return { data: [], totalCount: 0 };
        }
        
        // Combine all filter clauses with AND logic
        prismaWhere.AND = allFilterClauses;
      } else {
        // Single filter mode - use existing logic
        const filterClauses = await this.buildMultiFilterClauses(
          filtersToApply,
          journalIdsString,
          permissionRootId
        );
        
        if (filterClauses.length === 0) {
          serviceLogger.warn(
            "partnerService.getAllPartners: No valid filter clauses generated. Returning empty."
          );
          return { data: [], totalCount: 0 };
        }
        
        prismaWhere.AND = [filterClauses[0]];
      }
    } else if (restrictedJournalId) {
      const descendantIds = await journalService.getDescendantJournalIds(
        restrictedJournalId
      );
      prismaWhere.journalPartnerLinks = {
        some: { journalId: { in: [...descendantIds, restrictedJournalId] } },
      };
    }
    const totalCount = await prisma.partner.count({ where: prismaWhere });
    const data = await prisma.partner.findMany({
      where: prismaWhere,
      take,
      skip,
      orderBy: { name: "asc" },
      include: {
        journalPartnerLinks: {
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
      }
    });
    
    // Add matchedFilters information for single filter mode
    const dataWithFilters = data.map(partner => ({
      ...partner,
      matchedFilters: filtersToApply.length > 0 ? filtersToApply : undefined
    }));
    
    serviceLogger.debug(`partnerService.getAllPartners: Output - count: ${data.length}, totalCount: ${totalCount}, where: ${JSON.stringify(prismaWhere, jsonBigIntReplacer)}`);
    return { data: dataWithFilters, totalCount };
  },

  async findPartnersForGoods(
    options: IntersectionFindOptions
  ): Promise<{ data: Partner[]; totalCount: number }> {
    serviceLogger.debug(
      "partnerService.findPartnersForGoods: Input",
      JSON.stringify(options, jsonBigIntReplacer)
    );
    const { goodIds, journalIds } = options;
    if (!goodIds || goodIds.length === 0) {
      return { data: [], totalCount: 0 };
    }
    const uniqueGoodIds = [...new Set(goodIds)];
    const journalFilterClause =
      journalIds && journalIds.length > 0
        ? Prisma.sql`AND jpl."journal_id" IN (${Prisma.join(journalIds)})`
        : Prisma.empty;
    const intersectingPartnerRows = await prisma.$queryRaw<
      Array<{ partner_id: bigint }>
    >`
      SELECT
        jpl."partner_id"
      FROM "journal_partner_good_links" AS jpgl
      INNER JOIN "journal_partner_links" AS jpl ON jpgl."journal_partner_link_id" = jpl."id"
      WHERE
        jpgl."good_id" IN (${Prisma.join(uniqueGoodIds)})
        AND jpgl."approval_status" = 'APPROVED'
        ${journalFilterClause}
      GROUP BY
        jpl."partner_id"
      HAVING
        COUNT(DISTINCT jpgl."good_id") = ${uniqueGoodIds.length};
    `;
    const intersectingPartnerIds = intersectingPartnerRows.map(
      (row) => row.partner_id
    );
    if (intersectingPartnerIds.length === 0) {
      return { data: [], totalCount: 0 };
    }
    const data = await prisma.partner.findMany({
      where: {
        id: { in: intersectingPartnerIds },
        entityState: "ACTIVE",
      },
      orderBy: { name: "asc" },
      include: {
        journalPartnerLinks: {
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
      }
    });
    serviceLogger.debug("partnerService.findPartnersForGoods: Output", {
      count: data.length,
    });
    return { data, totalCount: data.length };
  },

  /**
   * ✅ NEW: Get partners that are linked to a specific document through the Document relationship
   */
  async findPartnersForDocument(documentId: bigint): Promise<{ data: Partner[]; totalCount: number }> {
    serviceLogger.debug(
      `partnerService.findPartnersForDocument: Input - documentId: '${documentId}'`
    );

    if (!documentId) {
      serviceLogger.debug(
        "partnerService.findPartnersForDocument: Output - No documentId provided, returning empty array."
      );
      return { data: [], totalCount: 0 };
    }

    const data = await prisma.partner.findMany({
      where: {
        entityState: EntityState.ACTIVE,
        documents: {
          some: { id: documentId },
        },
      },
      distinct: ['id'],
      orderBy: { name: 'asc' },
    });

    serviceLogger.debug(
      `partnerService.findPartnersForDocument: Output - Found ${data.length} partners.`
    );
    return { data, totalCount: data.length };
  },

  // ✅ CHANGED: The function signature now uses the Zod-inferred type.
  async updatePartner(
    id: bigint,
    data: UpdatePartnerPayload
  ): Promise<Partner | null> {
    serviceLogger.debug("partnerService.updatePartner: Input", { id, data });
    // Note: The `updatePartnerSchema` on the client side now correctly matches the fields
    // from `createPartnerSchema`, so a simple spread is safe.
    const updatedPartner = await prisma.partner.update({ where: { id }, data });
    serviceLogger.debug("partnerService.updatePartner: Output", updatedPartner);
    return updatedPartner;
  },

  async deletePartner(id: bigint): Promise<Partner | null> {
    serviceLogger.debug("partnerService.deletePartner: Input", { id });
    const deletedPartner = await prisma.partner.delete({ where: { id } });
    serviceLogger.debug("partnerService.deletePartner: Output", deletedPartner);
    return deletedPartner;
  },

  /**
   * Builds filter clauses for multiple filter modes
   */
  async buildMultiFilterClauses(
    filterModes: string[],
    selectedJournalIds: string[],
    permissionRootId?: string
  ): Promise<Prisma.PartnerWhereInput[]> {
    const clauses: Prisma.PartnerWhereInput[] = [];
    
    for (const mode of filterModes) {
      switch (mode) {
        case "affected":
          clauses.push({
            AND: [
              { approvalStatus: "APPROVED" },
              {
                journalPartnerLinks: {
                  some: { journalId: { in: selectedJournalIds } },
                },
              },
            ],
          });
          break;
          
        case "unaffected":
          if (!permissionRootId) {
            serviceLogger.warn(
              "partnerService.buildMultiFilterClauses: 'unaffected' filter requires 'permissionRootId'. Skipping."
            );
            continue;
          }
          
          // Get the parent paths for each selected journal
          const parentPaths: string[] = [];
          for (const journalId of selectedJournalIds) {
            const ancestorPath = await journalService.getJournalAncestorPath(journalId);
            // Remove the deepest journal (the one selected) from the path to get parent path
            const parentPath = ancestorPath.slice(1); // Remove the first element (deepest)
            parentPaths.push(...parentPath);
          }
          
          // Remove duplicates from parent paths
          const uniqueParentPaths = [...new Set(parentPaths)];
          
          if (uniqueParentPaths.length === 0) {
            serviceLogger.warn(
              "partnerService.buildMultiFilterClauses: No parent paths found for 'unaffected' mode. Skipping."
            );
            continue;
          }
          
          // Find partners linked directly to the selected (deepest) journals
          const affectedLinks = await prisma.journalPartnerLink.findMany({
            where: { journalId: { in: selectedJournalIds } },
            select: { partnerId: true },
          });
          const affectedPartnerIds = affectedLinks.map((p) => p.partnerId);
          
          clauses.push({
            AND: [
              { approvalStatus: "APPROVED" },
              {
                journalPartnerLinks: {
                  some: { journalId: { in: uniqueParentPaths } },
                },
              },
              { id: { notIn: affectedPartnerIds } },
            ],
          });
          break;
          
        case "inProcess":
          clauses.push({
            AND: [
              { status: { name: "Pending" } },
              {
                journalPartnerLinks: {
                  some: { journalId: { in: selectedJournalIds } },
                },
              },
            ],
          });
          break;
          
        case "pending":
          // Skip 'pending' filter - it's only for ApprovalCenter, not main sliders
          serviceLogger.warn(
            "partnerService.buildMultiFilterClauses: 'pending' filter should not be processed by main sliders. Skipping."
          );
          continue;
      }
    }
    
    return clauses;
  },
};

export default partnerService;
