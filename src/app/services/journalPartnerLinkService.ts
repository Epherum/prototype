// src/app/services/journalPartnerLinkService.ts
import prisma from "@/app/utils/prisma";
import { JournalPartnerLink, Partner, Journal } from "@prisma/client";

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
  // RECIPE 1: Create a new link between a Journal and a Partner
  async createLink(
    data: CreateJournalPartnerLinkData
  ): Promise<JournalPartnerLink> {
    console.log(
      `Chef (JPLService): Linking Journal '${data.journalId}' with Partner ID '${data.partnerId}'.`
    );

    // Validation: Check if Journal exists
    const journalExists = await prisma.journal.findUnique({
      where: { id: data.journalId },
    });
    if (!journalExists) {
      throw new Error(`Journal with ID '${data.journalId}' not found.`);
    }

    // Validation: Check if Partner exists
    const partnerExists = await prisma.partner.findUnique({
      where: { id: data.partnerId },
    });
    if (!partnerExists) {
      throw new Error(`Partner with ID '${data.partnerId}' not found.`);
    }

    // Prisma's @@unique constraint on [journalId, partnerId, partnershipType] will handle duplicates.
    const linkDataToCreate: any = { ...data };
    if (data.dateDebut && typeof data.dateDebut === "string") {
      linkDataToCreate.dateDebut = new Date(data.dateDebut);
    }
    if (data.dateFin && typeof data.dateFin === "string") {
      linkDataToCreate.dateFin = new Date(data.dateFin);
    }

    const newLink = await prisma.journalPartnerLink.create({
      data: linkDataToCreate,
    });
    console.log(`Chef (JPLService): Link created with ID '${newLink.id}'.`);
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
    console.log(`Chef (JPLService): Deleting link with ID '${linkId}'.`);
    try {
      // Check schema: journalPartnerGoodLinks uses onDelete: Cascade.
      // Deleting this link will also delete associated 3-way links.
      return await prisma.journalPartnerLink.delete({
        where: { id: linkId },
      });
    } catch (error) {
      // Prisma P2025: Record to delete not found
      console.warn(
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
    console.log(
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
    console.log(`Chef (JPLService): Deleted ${result.count} link(s).`);
    return result; // Returns { count: number_of_deleted_records }
  },

  // RECIPE 5: Get all Partners linked to a specific Journal (optionally including its children)
  async getPartnersForJournal(
    journalId: string,
    includeChildren: boolean = false
  ): Promise<Partner[]> {
    console.log(
      `Chef (JPLService): Getting partners for Journal '${journalId}', includeChildren: ${includeChildren}.`
    );
    let targetJournalIds = [journalId];

    if (includeChildren) {
      // Recursive CTE to find all descendant journal IDs
      const descendantJournals = await prisma.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE "JournalDescendants" AS (
          SELECT id
          FROM "journals"
          WHERE id = ${journalId}
          UNION ALL
          SELECT j.id
          FROM "journals" j
          INNER JOIN "JournalDescendants" jd ON j.parent_id = jd.id
        )
        SELECT id FROM "JournalDescendants";
      `;
      targetJournalIds = descendantJournals.map((j) => j.id);
      console.log(
        `Chef (JPLService): Target journal IDs (incl. children of '${journalId}'):`,
        targetJournalIds
      );
    }

    if (targetJournalIds.length === 0) {
      return [];
    }

    const links = await prisma.journalPartnerLink.findMany({
      where: {
        journalId: { in: targetJournalIds },
      },
      select: { partnerId: true }, // Only select partnerId to get distinct partners
      distinct: ["partnerId"], // Get distinct partner IDs
    });

    if (links.length === 0) {
      return [];
    }

    const partnerIds = links.map((link) => link.partnerId);
    return prisma.partner.findMany({
      where: {
        id: { in: partnerIds },
      },
      orderBy: { name: "asc" },
    });
  },

  //RECIPE 6: Get all Partners linked to multiple Journals (optionally including their children)
  async getPartnersForJournals(
    journalIds: string[],
    includeChildren: boolean = false
  ): Promise<Partner[]> {
    console.log(
      `Chef (JPLService): Getting partners for Journal IDs '${journalIds.join(
        ","
      )}', includeChildren: ${includeChildren}.`
    );
    if (!journalIds || journalIds.length === 0) {
      return [];
    }

    let targetJournalIds: string[] = [...journalIds];

    if (includeChildren) {
      const allDescendantIds = new Set<string>(targetJournalIds);
      for (const journalId of journalIds) {
        const descendantJournals = await prisma.$queryRaw<
          Array<{ id: string }>
        >`
          WITH RECURSIVE "JournalDescendants" AS (
            SELECT id FROM "journals" WHERE id = ${journalId}
            UNION ALL
            SELECT j.id FROM "journals" j INNER JOIN "JournalDescendants" jd ON j.parent_id = jd.id
          )
          SELECT id FROM "JournalDescendants";
        `;
        descendantJournals.forEach((j) => allDescendantIds.add(j.id));
      }
      targetJournalIds = Array.from(allDescendantIds);
      console.log(
        `Chef (JPLService): Target journal IDs (incl. children):`,
        targetJournalIds
      );
    }

    if (targetJournalIds.length === 0) return [];

    const links = await prisma.journalPartnerLink.findMany({
      where: {
        journalId: { in: targetJournalIds },
      },
      select: { partnerId: true },
      distinct: ["partnerId"],
    });

    if (links.length === 0) return [];

    const partnerIds = links.map((link) => link.partnerId);
    return prisma.partner.findMany({
      where: {
        id: { in: partnerIds },
      },
      orderBy: { name: "asc" },
    });
  },

  // RECIPE 7: Get all Journals a specific Partner is linked to
  async getJournalsForPartner(partnerId: bigint): Promise<Journal[]> {
    console.log(
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
    console.log(
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
