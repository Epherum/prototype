// src/app/services/partnerService.ts
import prisma from "@/app/utils/prisma";
import {
  Partner,
  PartnerType,
  Prisma,
  EntityState,
  ApprovalStatus,
} from "@prisma/client";
import { z } from "zod";
import { journalService } from "./journalService";
import { ROOT_JOURNAL_ID } from "@/lib/constants";
import { PartnerGoodFilterStatus } from "@/lib/types";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";

export const createPartnerSchema = z.object({
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

export type CreatePartnerData = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerData = Partial<Omit<CreatePartnerData, "partnerType">>;

export interface GetAllPartnersOptions {
  where?: Prisma.PartnerWhereInput;
  take?: number;
  skip?: number;
  partnerType?: PartnerType;
  filterStatuses?: PartnerGoodFilterStatus[];

  contextJournalIds?: string[];
  currentUserId?: string;
  restrictedJournalId?: string | null;
}

const partnerService = {
  // --- (createPartner, getAllPartners, getPartnerById, updatePartner, deletePartner functions are unchanged) ---
  async createPartner(
    data: CreatePartnerData,
    createdById: string,
    createdByIp?: string | null
  ): Promise<Partner> {
    console.log(
      "Chef (PartnerService): Adding new partner:",
      data.name,
      "by user:",
      createdById
    );
    const newPartner = await prisma.partner.create({
      data: {
        ...data,
        createdById: createdById,
        createdByIp: createdByIp,
        entityState: EntityState.ACTIVE,
        approvalStatus: ApprovalStatus.PENDING,
      },
    });
    console.log(
      "Chef (PartnerService): Partner",
      newPartner.name,
      "added with ID:",
      newPartner.id,
      "Status:",
      newPartner.approvalStatus
    );
    return newPartner;
  },

  async getAllPartners(
    options: GetAllPartnersOptions
  ): Promise<{ partners: Partner[]; totalCount: number }> {
    console.log(
      "Chef (PartnerService): Fetching partners with MULTI-SELECT RULES:",
      options
    );

    const {
      filterStatuses = [],
      contextJournalIds = [],
      currentUserId,
      restrictedJournalId,
      where: externalWhere,
      ...restOfOptions
    } = options;

    if (filterStatuses.length > 0 && !currentUserId) {
      console.warn(
        `Chef (PartnerService): Filters require a currentUserId. Returning empty.`
      );
      return { partners: [], totalCount: 0 };
    }

    let prismaWhere: Prisma.PartnerWhereInput = {
      entityState: "ACTIVE",
      ...externalWhere,
    };

    const isRootUser =
      !restrictedJournalId || restrictedJournalId === ROOT_JOURNAL_ID;

    if (filterStatuses.length > 0) {
      const orConditions: Prisma.PartnerWhereInput[] = [];
      const descendantIds =
        !isRootUser && filterStatuses.includes("unaffected")
          ? await journalService.getDescendantJournalIds(restrictedJournalId!)
          : [];

      for (const status of filterStatuses) {
        switch (status) {
          case "affected":
            if (contextJournalIds.length > 0) {
              orConditions.push({
                journalPartnerLinks: {
                  some: { journalId: { in: contextJournalIds } },
                },
              });
            }
            break;

          case "unaffected":
            if (isRootUser) {
              orConditions.push({
                AND: [
                  { journalPartnerLinks: { none: {} } },
                  { createdById: { not: currentUserId } },
                ],
              });
            } else {
              orConditions.push({
                AND: [
                  {
                    journalPartnerLinks: {
                      some: { journalId: restrictedJournalId! },
                    },
                  },
                  ...(descendantIds.length > 0
                    ? [
                        {
                          NOT: {
                            journalPartnerLinks: {
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
                  { journalPartnerLinks: { none: {} } },
                  { createdById: currentUserId },
                ],
              });
            } else {
              orConditions.push({
                AND: [
                  {
                    journalPartnerLinks: {
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
        return { partners: [], totalCount: 0 };
      }
    }

    console.log(
      "Chef (PartnerService): Final Prisma 'where' clause:",
      JSON.stringify(prismaWhere, jsonBigIntReplacer, 2)
    );

    const totalCount = await prisma.partner.count({ where: prismaWhere });
    const partners = await prisma.partner.findMany({
      where: prismaWhere,
      take: restOfOptions.take,
      skip: restOfOptions.skip,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { journalPartnerLinks: true } },
      },
    });

    console.log(
      `Chef (PartnerService): Fetched ${partners.length} partners. Total matching query: ${totalCount}`
    );
    return { partners, totalCount };
  },

  async getPartnerById(id: bigint): Promise<Partner | null> {
    console.log("Chef (PartnerService): Looking up partner with ID:", id);
    const partner = await prisma.partner.findUnique({
      where: { id },
    });
    if (partner) {
      console.log("Chef (PartnerService): Found partner:", partner.name);
    } else {
      console.log("Chef (PartnerService): Partner with ID:", id, "not found.");
    }
    return partner;
  },

  async updatePartner(
    id: bigint,
    data: UpdatePartnerData
  ): Promise<Partner | null> {
    console.log(
      "Chef (PartnerService): Updating details for partner ID:",
      id,
      "with data:",
      data
    );
    try {
      const updatedPartner = await prisma.partner.update({
        where: { id },
        data: data,
      });
      console.log(
        "Chef (PartnerService): Partner",
        updatedPartner.name,
        "updated successfully."
      );
      return updatedPartner;
    } catch (error) {
      console.warn(
        "Chef (PartnerService): Could not update partner ID:",
        id,
        ". It might not exist.",
        error
      );
      return null;
    }
  },

  async deletePartner(id: bigint): Promise<Partner | null> {
    console.log("Chef (PartnerService): Removing partner with ID:", id);
    try {
      const deletedPartner = await prisma.partner.delete({
        where: { id },
      });
      console.log(
        "Chef (PartnerService): Partner",
        deletedPartner.name,
        "removed successfully."
      );
      return deletedPartner;
    } catch (error) {
      console.warn(
        "Chef (PartnerService): Could not delete partner ID:",
        id,
        ". It might not exist.",
        error
      );
      return null;
    }
  },
  /**
   * ✅ CORRECTED LOGIC
   * Finds partners that are linked to ALL specified goods within a given journal context.
   * This logic now correctly handles the schema asymmetry and mirrors the logic of the working
   * `goodsService.findGoodsForPartners` function.
   *
   * @param goodIds - An array of Good IDs.
   * @param journalId - The Journal ID context.
   * @returns A response of partners that are common to all specified goods in that journal.
   */
  async findPartnersForGoods(
    goodIds: bigint[],
    journalId: string
  ): Promise<{ partners: Partner[]; totalCount: number }> {
    console.groupCollapsed(
      `[DATABASE-SERVICE: findPartnersForGoods (FINAL CORRECTED LOGIC)]`
    );
    console.log("INPUTS -> goodIds:", goodIds, `| journalId: "${journalId}"`);

    if (goodIds.length === 0 || !journalId) {
      console.log("EXIT: No good IDs or journalId provided.");
      console.groupEnd();
      return { partners: [], totalCount: 0 };
    }

    const uniqueInputGoodIds = new Set(goodIds);

    // Step 1: Use a nested 'where' to query through the relationship.
    // Fetch all links that match the desired goods AND are within the desired journal.
    // This is the Prisma equivalent of an INNER JOIN with a WHERE clause.
    const relevantLinks = await prisma.journalPartnerGoodLink.findMany({
      where: {
        goodId: { in: Array.from(uniqueInputGoodIds) },
        // This nested clause is the key: it filters based on the parent table.
        journalPartnerLink: {
          journalId: journalId,
          partner: {
            entityState: "ACTIVE", // Only consider links to active partners
          },
        },
      },
      select: {
        goodId: true,
        journalPartnerLink: {
          select: {
            partnerId: true, // We need the partnerId for grouping
          },
        },
      },
    });

    if (relevantLinks.length === 0) {
      console.log("EXIT: No links found for these goods in this journal.");
      console.groupEnd();
      return { partners: [], totalCount: 0 };
    }

    // Step 2: Perform the intersection logic in code.
    // Create a map of { partnerId => Set<goodId> }.
    const partnerToGoodIdsMap = new Map<bigint, Set<bigint>>();
    for (const link of relevantLinks) {
      const partnerId = link.journalPartnerLink.partnerId;
      if (!partnerToGoodIdsMap.has(partnerId)) {
        partnerToGoodIdsMap.set(partnerId, new Set());
      }
      partnerToGoodIdsMap.get(partnerId)!.add(link.goodId);
    }

    // Step 3: Filter the map to find partners who have all the required goods.
    const intersectingPartnerIds: bigint[] = [];
    for (const [partnerId, linkedGoodIds] of partnerToGoodIdsMap.entries()) {
      if (linkedGoodIds.size === uniqueInputGoodIds.size) {
        intersectingPartnerIds.push(partnerId);
      }
    }

    console.log(
      `Found ${intersectingPartnerIds.length} partners matching the intersection criteria.`
    );

    if (intersectingPartnerIds.length === 0) {
      console.log("EXIT: No partners satisfied the intersection count.");
      console.groupEnd();
      return { partners: [], totalCount: 0 };
    }

    // Step 4: Fetch the full partner details for the final list of IDs.
    const partners = await prisma.partner.findMany({
      where: {
        id: { in: intersectingPartnerIds },
      },
      orderBy: { name: "asc" },
    });

    console.log(`Returning ${partners.length} final partner records.`);
    console.groupEnd();

    return { partners, totalCount: partners.length };
  },
};

export default partnerService;
