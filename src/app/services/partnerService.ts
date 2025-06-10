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

// --- NEW: Define the schema as the single source of truth ---
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

// --- UPDATED: Infer the type directly from the schema ---
export type CreatePartnerData = z.infer<typeof createPartnerSchema>;

// UpdatePartnerData remains the same, as it's a partial of the create type.
export type UpdatePartnerData = Partial<Omit<CreatePartnerData, "partnerType">>;

/**
 * @description Defines the options for the getAllPartners service method.
 * This has been refactored to use a single `filterStatus` to handle
 * the UI filtering logic from the JournalHierarchySlider.
 */
export interface GetAllPartnersOptions {
  companyId: string;
  where?: Prisma.PartnerWhereInput; // For pre-existing complex filters
  take?: number;
  skip?: number;
  partnerType?: PartnerType;

  // Unified filter status for the Journal-as-Root view
  filterStatus?: "all" | "affected" | "unaffected" | "inProcess";
  contextJournalIds?: string[]; // Required for 'affected' and 'all' filters
  currentUserId?: string; // Required for 'inProcess' and 'all' filters
}

const partnerService = {
  async createPartner(
    data: CreatePartnerData,
    companyId: string,
    createdById: string,
    createdByIp?: string | null
  ): Promise<Partner> {
    // ... (This function remains unchanged)
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
   * REFACTORED FUNCTION
   * Fetches partners with simplified and powerful filtering logic.
   * This now directly implements the "all", "affected", "unaffected", and "inProcess" filters.
   */
  async getAllPartners(
    options: GetAllPartnersOptions
  ): Promise<{ partners: Partner[]; totalCount: number }> {
    console.log(
      "Chef (PartnerService): Fetching partners with new options:",
      options
    );

    const {
      companyId,
      filterStatus,
      contextJournalIds = [],
      currentUserId,
      where: externalWhere,
      ...restOfOptions
    } = options;

    // --- Base Query ---
    // All queries are scoped to the company and only retrieve ACTIVE partners.
    // It also includes any pre-existing `where` clause passed in for other features (like J-G-P).
    let prismaWhere: Prisma.PartnerWhereInput = {
      companyId: companyId,
      entityState: EntityState.ACTIVE,
      ...externalWhere,
    };

    // --- Dynamic Filter Logic ---
    // This block constructs the specific query conditions based on the filterStatus.
    switch (filterStatus) {
      case "affected":
        console.log("Chef (PartnerService): Applying 'affected' filter.");
        // If no journals are selected, the "affected" list should be empty.
        if (contextJournalIds.length === 0) {
          return { partners: [], totalCount: 0 };
        }
        prismaWhere.journalPartnerLinks = {
          some: { journalId: { in: contextJournalIds } },
        };
        break;

      case "unaffected":
        console.log("Chef (PartnerService): Applying 'unaffected' filter.");
        // Find partners NOT linked to ANY journal in the company.
        prismaWhere.journalPartnerLinks = { none: {} };
        break;

      case "inProcess":
        console.log("Chef (PartnerService): Applying 'inProcess' filter.");
        // Find partners created by the current user, pending approval, AND unlinked.
        if (!currentUserId) {
          console.warn(
            "Chef (PartnerService): 'inProcess' filter needs a currentUserId, but none was provided. Returning empty."
          );
          return { partners: [], totalCount: 0 };
        }
        prismaWhere.AND = [
          { createdById: currentUserId },
          { approvalStatus: ApprovalStatus.PENDING },
          { journalPartnerLinks: { none: {} } },
        ];
        break;

      case "all":
        console.log("Chef (PartnerService): Applying 'all' filter.");
        // Combines "Affected" (by current journal selection) and "In Process" (created by me).
        if (!currentUserId) {
          console.warn(
            "Chef (PartnerService): 'all' filter needs a currentUserId for the 'inProcess' part. Returning empty."
          );
          return { partners: [], totalCount: 0 };
        }

        const affectedCondition: Prisma.PartnerWhereInput =
          contextJournalIds.length > 0
            ? {
                journalPartnerLinks: {
                  some: { journalId: { in: contextJournalIds } },
                },
              }
            : { id: { in: [] } }; // A condition that is never met if no journals are selected

        const inProcessCondition: Prisma.PartnerWhereInput = {
          AND: [
            { createdById: currentUserId },
            { approvalStatus: ApprovalStatus.PENDING },
            { journalPartnerLinks: { none: {} } },
          ],
        };

        prismaWhere.OR = [affectedCondition, inProcessCondition];
        break;

      default:
        // No filterStatus provided, so we perform a general fetch for the company.
        console.log(
          "Chef (PartnerService): No specific filterStatus. Performing general fetch."
        );
        if (options.partnerType) {
          prismaWhere.partnerType = options.partnerType;
        }
        break;
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

  async getPartnerById(id: bigint): Promise<Partner | null> {
    // ... (This function remains unchanged)
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
    // ... (This function remains unchanged)
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
    // ... (This function remains unchanged)
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
