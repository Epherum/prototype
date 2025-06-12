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

/**
 * === MODIFIED INTERFACE ===
 * @description Defines the options for the getAllPartners service method.
 */
export interface GetAllPartnersOptions {
  companyId: string;
  where?: Prisma.PartnerWhereInput;
  take?: number;
  skip?: number;
  partnerType?: PartnerType;
  filterStatuses?: PartnerGoodFilterStatus[]; // Changed from filterStatus to filterStatuses (array)

  // Unified filter status
  filterStatus?: "affected" | "unaffected" | "inProcess";
  contextJournalIds?: string[];
  currentUserId?: string;
  restrictedJournalId?: string | null; // <-- NEW: For the new unaffected logic
}

const partnerService = {
  async createPartner(
    data: CreatePartnerData,
    companyId: string,
    createdById: string,
    createdByIp?: string | null
  ): Promise<Partner> {
    console.log(
      "Chef (PartnerService): Adding new partner:",
      data.name,
      "for company:",
      companyId,
      "by user:",
      createdById
    );
    const newPartner = await prisma.partner.create({
      data: {
        ...data,
        companyId: companyId,
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

  /**
   * === REFACTORED FUNCTION WITH NEW UNAFFECTED LOGIC ===
   * Fetches partners with simplified and powerful filtering logic.
   */
  async getAllPartners(
    options: GetAllPartnersOptions
  ): Promise<{ partners: Partner[]; totalCount: number }> {
    console.log(
      "Chef (PartnerService): Fetching partners with MULTI-SELECT RULES:",
      options
    );

    const {
      companyId,
      filterStatuses = [], // Default to empty array
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
      companyId: companyId,
      entityState: "ACTIVE",
      ...externalWhere,
    };

    const isRootUser =
      !restrictedJournalId || restrictedJournalId === ROOT_JOURNAL_ID;

    // --- NEW: Multi-filter logic ---
    if (filterStatuses.length > 0) {
      const orConditions: Prisma.PartnerWhereInput[] = [];

      // Asynchronously get descendantIds if needed, once.
      const descendantIds =
        !isRootUser && filterStatuses.includes("unaffected")
          ? await journalService.getDescendantJournalIds(
              restrictedJournalId!,
              companyId
            )
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

      // If any conditions were generated, combine them with OR
      if (orConditions.length > 0) {
        prismaWhere.OR = orConditions;
      } else {
        // If filters were selected but no valid conditions could be made (e.g. 'affected' with no journal IDs)
        // return nothing.
        return { partners: [], totalCount: 0 };
      }
    }

    console.log(
      "Chef (PartnerService): Final Prisma 'where' clause:",
      JSON.stringify(prismaWhere, null, 2)
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

  // ... (getPartnerById, updatePartner, deletePartner functions remain unchanged) ...
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
      const { companyId, ...updatePayload } = data as any;
      const updatedPartner = await prisma.partner.update({
        where: { id },
        data: updatePayload,
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
};

export default partnerService;
