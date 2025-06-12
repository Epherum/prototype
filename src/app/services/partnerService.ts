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
import { journalService } from "./journalService"; // <-- IMPORT JOURNAL SERVICE
import { ROOT_JOURNAL_ID } from "@/lib/constants"; // <-- IMPORT ROOT CONSTANT

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
      "Chef (PartnerService): Fetching partners with DETAILED RULES:",
      options
    );

    const {
      companyId,
      filterStatus,
      contextJournalIds = [],
      currentUserId,
      restrictedJournalId,
      where: externalWhere,
      ...restOfOptions
    } = options;

    // The currentUserId is now essential for 'unaffected' and 'inProcess'
    if (
      (filterStatus === "unaffected" || filterStatus === "inProcess") &&
      !currentUserId
    ) {
      console.warn(
        `Chef (PartnerService): '${filterStatus}' filter requires a currentUserId, but none was provided. Returning empty.`
      );
      return { partners: [], totalCount: 0 };
    }

    let prismaWhere: Prisma.PartnerWhereInput = {
      companyId: companyId,
      entityState: EntityState.ACTIVE, // We only care about active partners
      ...externalWhere,
    };

    const isRootUser =
      !restrictedJournalId || restrictedJournalId === ROOT_JOURNAL_ID;

    switch (filterStatus) {
      case "affected":
        console.log(
          "Chef (PartnerService): Applying 'affected' filter (Unchanged)."
        );
        if (contextJournalIds.length === 0) {
          return { partners: [], totalCount: 0 };
        }
        prismaWhere.journalPartnerLinks = {
          some: { journalId: { in: contextJournalIds } },
        };
        break;

      case "unaffected":
        if (isRootUser) {
          // --- ROOT USER: UNAFFECTED ---
          console.log(
            "Chef (PartnerService): Applying 'unaffected' filter for ROOT user."
          );
          prismaWhere.AND = [
            { journalPartnerLinks: { none: {} } }, // Not linked to ANY journal
            { createdById: { not: currentUserId } }, // AND not created by me
          ];
        } else {
          // --- RESTRICTED USER: UNAFFECTED ---
          console.log(
            `Chef (PartnerService): Applying 'unaffected' filter for RESTRICTED user. Root: ${restrictedJournalId}`
          );
          const descendantIds = await journalService.getDescendantJournalIds(
            restrictedJournalId!,
            companyId
          );
          prismaWhere.AND = [
            // Linked to my parent journal
            {
              journalPartnerLinks: {
                some: { journalId: restrictedJournalId!, companyId: companyId },
              },
            },
            // AND NOT linked to any of its children
            ...(descendantIds.length > 0
              ? [
                  {
                    NOT: {
                      journalPartnerLinks: {
                        some: {
                          journalId: { in: descendantIds },
                          companyId: companyId,
                        },
                      },
                    },
                  },
                ]
              : []),
          ];
        }
        break;

      case "inProcess":
        if (isRootUser) {
          // --- ROOT USER: IN PROCESS ---
          console.log(
            "Chef (PartnerService): Applying 'inProcess' filter for ROOT user."
          );
          prismaWhere.AND = [
            { journalPartnerLinks: { none: {} } }, // Not linked to ANY journal
            { createdById: currentUserId }, // AND created by me
          ];
        } else {
          // --- RESTRICTED USER: IN PROCESS ---
          console.log(
            `Chef (PartnerService): Applying 'inProcess' filter for RESTRICTED user. Root: ${restrictedJournalId}`
          );
          prismaWhere.AND = [
            // NOT linked to my parent/restricted journal
            {
              journalPartnerLinks: {
                none: { journalId: restrictedJournalId!, companyId: companyId },
              },
            },
            // AND created by me
            { createdById: currentUserId },
          ];
        }
        break;

      default:
        // NO filterStatus, e.g., Partner is S1.
        // Fetch all active partners.
        console.log(
          "Chef (PartnerService): No filterStatus. Fetching all active partners."
        );
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
