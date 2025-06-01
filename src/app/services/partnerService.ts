// File: src/app/services/partnerService.ts
import prisma from "@/app/utils/prisma"; // Storeroom Manager
import { Partner, PartnerType, Prisma } from "@prisma/client"; // Added Prisma for WhereInput type

// --- Types for "Order Slips" (Data Transfer Objects) for Partners ---
// ... (CreatePartnerData, UpdatePartnerData types remain the same) ...
export type CreatePartnerData = {
  name: string;
  partnerType: PartnerType; // From your Enum: LEGAL_ENTITY or NATURAL_PERSON
  notes?: string | null;
  logoUrl?: string | null;
  photoUrl?: string | null;
  isUs?: boolean | null;
  // Legal Entity specific
  registrationNumber?: string | null;
  taxId?: string | null;
  // Natural Person specific
  bioFatherName?: string | null;
  bioMotherName?: string | null;
  additionalDetails?: any; // Or a more specific Zod schema
};

export type UpdatePartnerData = Partial<Omit<CreatePartnerData, "partnerType">>;

// --- Chef's Recipes for Partners ---

const partnerService = {
  // ... (createPartner, getPartnerById methods remain the same) ...
  async createPartner(data: CreatePartnerData): Promise<Partner> {
    console.log(
      "Chef (PartnerService): Adding new partner to the guest list:",
      data.name
    );
    const newPartner = await prisma.partner.create({
      data: data,
    });
    console.log(
      "Chef (PartnerService): Partner",
      newPartner.name,
      "added with ID:",
      newPartner.id
    );
    return newPartner;
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

  // RECIPE 3: Get all partners (e.g., for a dropdown or a full list view)
  // MODIFIED to support pagination and return totalCount
  async getAllPartners(options?: {
    partnerType?: PartnerType;
    where?: Prisma.PartnerWhereInput; // Allows pre-existing filters (e.g., for J-G-P specific partner ID list)
    take?: number;
    skip?: number;
    // New filter mechanism based on Journal Root selection status
    // `filterByAffectedJournals`: Show partners linked to AT LEAST ONE of these journal IDs.
    // If this array is empty, it means "linked to no journals from this specific list", resulting in no partners for this condition.
    filterByAffectedJournals?: string[];
    // `filterByUnaffected`: Show partners NOT linked to ANY journal.
    // If true, this takes precedence over `filterByAffectedJournals`.
    filterByUnaffected?: boolean;
  }): Promise<{ partners: Partner[]; totalCount: number }> {
    console.log(
      "Chef (PartnerService): Fetching partners with options:",
      options
    );

    // Initialize the main where clause, incorporating any externally provided 'where' conditions
    const prismaWhere: Prisma.PartnerWhereInput = { ...options?.where };
    const additionalConditions: Prisma.PartnerWhereInput[] = [];

    if (options?.partnerType) {
      additionalConditions.push({ partnerType: options.partnerType });
      console.log(
        "Chef (PartnerService): Filtering by partner type:",
        options.partnerType
      );
    }

    // Apply new journal link status filters
    if (options?.filterByUnaffected) {
      // Show partners not linked to any journal.
      additionalConditions.push({ journalPartnerLinks: { none: {} } });
      console.log(
        "Chef (PartnerService): Filtering for unaffected partners (no journal links)."
      );
    } else if (options?.filterByAffectedJournals) {
      // Show partners linked to the specified journals.
      // If options.filterByAffectedJournals is an empty array, `journalId: { in: [] }` for `some`
      // correctly results in no partners for this condition.
      additionalConditions.push({
        journalPartnerLinks: {
          some: { journalId: { in: options.filterByAffectedJournals } },
        },
      });
      console.log(
        `Chef (PartnerService): Filtering for partners affected by journals: [${options.filterByAffectedJournals.join(
          ", "
        )}].`
      );
    }

    // Combine all conditions using AND
    if (additionalConditions.length > 0) {
      if (prismaWhere.AND) {
        if (Array.isArray(prismaWhere.AND)) {
          prismaWhere.AND = [...prismaWhere.AND, ...additionalConditions];
        } else {
          prismaWhere.AND = [prismaWhere.AND, ...additionalConditions];
        }
      } else {
        prismaWhere.AND = additionalConditions;
      }
    }

    const totalCount = await prisma.partner.count({
      where: prismaWhere,
    });

    const partners = await prisma.partner.findMany({
      where: prismaWhere,
      take: options?.take,
      skip: options?.skip,
      orderBy: { name: "asc" },
    });

    console.log(
      `Chef (PartnerService): Fetched ${partners.length} partners. Total matching query: ${totalCount}`
    );
    return { partners, totalCount };
  },

  // ... (updatePartner, deletePartner methods remain the same) ...
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
};

export default partnerService;
