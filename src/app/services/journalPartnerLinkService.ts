// src/app/services/journalPartnerLinkService.ts
import prisma from "@/app/utils/prisma";
import { JournalPartnerLink, Partner, Journal } from "@prisma/client";
import { getDescendantJournalIdsAsSet } from "@/app/utils/journalUtils";
import { serviceLogger } from "@/lib/logger";
export type CreateJournalPartnerLinkData = {
  journalId: string;
  partnerId: bigint;
  partnershipType?: string | null;
  exoneration?: boolean | null;
  periodType?: string | null;
  dateDebut?: Date | string | null; // Allow string for API input, convert to Date
  dateFin?: Date | string | null; // Allow string for API input, convert to Date
  documentReference?: string | null;
};

const journalPartnerLinkService = {
  // RECIPE 1: Create a new link (MODIFIED with hierarchical check)
  async createLink(
    data: CreateJournalPartnerLinkData
  ): Promise<JournalPartnerLink> {
    serviceLogger.debug(
      `Chef (JPLService): Linking Journal '${data.journalId}' with Partner ID '${data.partnerId}'.`
    );

    // Validation: Check if Journal and Partner exist
    const [journal, partnerExists] = await Promise.all([
      prisma.journal.findUnique({
        where: { id: data.journalId },
        select: { id: true, parent_id: true },
      }),
      prisma.partner.findUnique({
        where: { id: data.partnerId },
        select: { id: true },
      }),
    ]);

    if (!journal) {
      throw new Error(`Journal with ID '${data.journalId}' not found.`);
    }
    if (!partnerExists) {
      throw new Error(`Partner with ID '${data.partnerId}' not found.`);
    }

    // ✨ HIERARCHICAL INTEGRITY CHECK (as per spec) ✨
    if (journal.parent_id) {
      const parentLinkExists = await prisma.journalPartnerLink.findFirst({
        where: {
          journalId: journal.parent_id,
          partnerId: data.partnerId,
        },
      });
      if (!parentLinkExists) {
        throw new Error(
          `Business Rule Violation: Cannot link Partner '${data.partnerId}' to child Journal '${data.journalId}' because a link does not exist with its parent Journal '${journal.parent_id}'.`
        );
      }
    }

    // Proceed with creation
    const newLink = await prisma.journalPartnerLink.create({ data });
    serviceLogger.debug(`Chef (JPLService): Link created with ID '${newLink.id}'.`);
    return newLink;
  },

  // RECIPE 2: Get a specific link by its ID
  async getLinkById(linkId: bigint): Promise<JournalPartnerLink | null> {
    return prisma.journalPartnerLink.findUnique({
      where: { id: linkId },
      include: { journal: true, partner: true },
    });
  },

  // RECIPE 3: Delete a link by its ID
  async deleteLinkById(linkId: bigint): Promise<JournalPartnerLink | null> {
    serviceLogger.debug(`Chef (JPLService): Deleting link with ID '${linkId}'.`);
    try {
      // Check schema: journalPartnerGoodLinks uses onDelete: Cascade.
      // Deleting this link will also delete associated 3-way links.
      return await prisma.journalPartnerLink.delete({
        where: { id: linkId },
      });
    } catch (error) {
      // Prisma P2025: Record to delete not found
      serviceLogger.warn(
        `Chef (JPLService): Link ID '${linkId}' not found for deletion.`,
        error
      );
      return null;
    }
  },

  // RECIPE 4: Delete a link by Journal ID, Partner ID (and optionally partnershipType for more specificity)
  async deleteLinkByJournalAndPartner(
    journalId: string,
    partnerId: bigint,
    partnershipType?: string | null // If null/undefined, deletes any link between them regardless of type
  ): Promise<{ count: number }> {
    serviceLogger.debug(
      `Chef (JPLService): Deleting link(s) between Journal '${journalId}' and Partner ID '${partnerId}'.`
    );
    const whereCondition: any = { journalId, partnerId };
    if (partnershipType !== undefined) {
      // Allow specific type or null if provided
      whereCondition.partnershipType = partnershipType;
    }
    // This deletes potentially multiple records if partnershipType is not specified and multiple types exist
    const result = await prisma.journalPartnerLink.deleteMany({
      where: whereCondition,
    });
    serviceLogger.debug(`Chef (JPLService): Deleted ${result.count} link(s).`);
    return result; // Returns { count: number_of_deleted_records }
  },

  // RECIPE 5: Get all Partners linked to a specific Journal (optionally including its children)
  async getPartnersForJournals(
    journalIds: string[],
    includeChildren: boolean = false
  ): Promise<Partner[]> {
    if (!journalIds || journalIds.length === 0) {
      return [];
    }

    let targetJournalIds = new Set<string>(journalIds);
    if (includeChildren) {
      // Replaced raw query with a call to a reusable utility for DRY principle
      targetJournalIds = await getDescendantJournalIdsAsSet(journalIds);
    }

    if (targetJournalIds.size === 0) return [];

    const links = await prisma.journalPartnerLink.findMany({
      where: { journalId: { in: Array.from(targetJournalIds) } },
      select: { partnerId: true },
      distinct: ["partnerId"],
    });

    if (links.length === 0) return [];

    const partnerIds = links.map((link) => link.partnerId);
    return prisma.partner.findMany({
      where: { id: { in: partnerIds } },
      orderBy: { name: "asc" },
    });
  },

  // RECIPE 7: Get all Journals a specific Partner is linked to
  async getJournalsForPartner(partnerId: bigint): Promise<Journal[]> {
    serviceLogger.debug(
      `Chef (JPLService): Getting journals for Partner ID '${partnerId}'.`
    );
    const links = await prisma.journalPartnerLink.findMany({
      where: { partnerId: partnerId },
      include: {
        journal: true, // Include the full journal object
      },
      distinct: ["journalId"],
    });

    return links
      .map((link) => link.journal)
      .sort((a, b) => a.id.localeCompare(b.id));
  },

  // RECIPE 8: Get all links for a specific partner (with journal details)
  async getLinksForPartner(partnerId: bigint): Promise<JournalPartnerLink[]> {
    return prisma.journalPartnerLink.findMany({
      where: { partnerId },
      include: { journal: true },
      orderBy: { journal: { id: "asc" } },
    });
  },

  // RECIPE 9: Get all links for a specific journal (with partner details)
  async getLinksForJournal(journalId: string): Promise<JournalPartnerLink[]> {
    return prisma.journalPartnerLink.findMany({
      where: { journalId },
      include: { partner: true },
      orderBy: { partner: { name: "asc" } },
    });
  },

  // RECIPE 10: Find a specific link (or the first one) by Journal ID and Partner ID
  async findByJournalAndPartner(
    journalId: string,
    partnerId: bigint
  ): Promise<JournalPartnerLink | null> {
    serviceLogger.debug(
      `JPL Service: Finding first link for Journal ${journalId} and Partner ${partnerId}`
    );
    // Use findFirst because the unique constraint also includes partnershipType,
    // so there could be multiple links between the same journal and partner.
    return prisma.journalPartnerLink.findFirst({
      where: {
        journalId: journalId,
        partnerId: partnerId,
      },
    });
  },
};

export default journalPartnerLinkService;
