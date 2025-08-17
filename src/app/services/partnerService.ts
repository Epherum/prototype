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
    
    // Create the partner first
    const newPartner = await prisma.partner.create({
      data: {
        ...partnerData,
        createdById: createdById,
        entityState: EntityState.ACTIVE,
        approvalStatus: ApprovalStatus.PENDING,
      },
    });
    
    // Create journal-partner links for the entire hierarchy path
    const journalPartnerLinks = ancestorPath.map(journalId => ({
      journalId,
      partnerId: newPartner.id,
      partnershipType: "STANDARD_TRANSACTION", // Default partnership type
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
      permissionRootId,
      selectedJournalIds = [],
      where: externalWhere,
    } = options;
    let prismaWhere: Prisma.PartnerWhereInput = {
      entityState: EntityState.ACTIVE,
      ...externalWhere,
    };
    if (filterMode) {
      if (selectedJournalIds.length === 0) {
        serviceLogger.warn(
          "partnerService.getAllPartners: 'filterMode' was provided without 'selectedJournalIds'. Returning empty."
        );
        return { data: [], totalCount: 0 };
      }
      
      serviceLogger.debug("partnerService.getAllPartners: Filter mode processing", {
        filterMode,
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
      
      switch (filterMode) {
        case "affected":
          // Partners linked to the selected journal hierarchy
          // The selectedJournalIds should contain only the terminal/deepest selected journals
          // Only show APPROVED partners in affected mode
          prismaWhere.AND = [
            { approvalStatus: "APPROVED" },
            {
              journalPartnerLinks: {
                some: { journalId: { in: journalIdsString } },
              },
            },
          ];
          break;
        case "unaffected":
          if (!permissionRootId) {
            serviceLogger.warn(
              "partnerService.getAllPartners: 'unaffected' filter requires 'permissionRootId'. Returning empty."
            );
            return { data: [], totalCount: 0 };
          }
          
          // Get the parent paths for each selected journal
          const parentPaths: string[] = [];
          for (const journalId of journalIdsString) {
            const ancestorPath = await journalService.getJournalAncestorPath(journalId);
            // Remove the deepest journal (the one selected) from the path to get parent path
            const parentPath = ancestorPath.slice(1); // Remove the first element (deepest)
            parentPaths.push(...parentPath);
          }
          
          // Remove duplicates from parent paths
          const uniqueParentPaths = [...new Set(parentPaths)];
          
          if (uniqueParentPaths.length === 0) {
            serviceLogger.warn(
              "partnerService.getAllPartners: No parent paths found for selected journals in 'unaffected' mode. Returning empty."
            );
            return { data: [], totalCount: 0 };
          }
          
          // Find partners linked directly to the selected (deepest) journals
          const affectedLinks = await prisma.journalPartnerLink.findMany({
            where: { journalId: { in: journalIdsString } },
            select: { partnerId: true },
          });
          const affectedPartnerIds = affectedLinks.map((p) => p.partnerId);
          
          // Find partners linked to parent paths but NOT to the deepest selected journals
          prismaWhere.AND = [
            { approvalStatus: "APPROVED" }, // Only show approved partners
            {
              journalPartnerLinks: {
                some: {
                  journalId: { in: uniqueParentPaths },
                },
              },
            },
            {
              id: { notIn: affectedPartnerIds },
            },
          ];
          break;
        case "inProcess":
          prismaWhere.AND = [
            { approvalStatus: "PENDING" },
            {
              journalPartnerLinks: {
                some: { journalId: { in: journalIdsString } },
              },
            },
          ];
          break;
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
    serviceLogger.debug(`partnerService.getAllPartners: Output - count: ${data.length}, totalCount: ${totalCount}, where: ${JSON.stringify(prismaWhere, jsonBigIntReplacer)}`);
    return { data, totalCount };
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
};

export default partnerService;
