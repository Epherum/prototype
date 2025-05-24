// File: src/app/services/journalGoodLinkService.ts
import prisma from "@/app/utils/prisma";
import { JournalGoodLink, GoodsAndService, Journal } from "@prisma/client";

export type CreateJournalGoodLinkData = {
  journalId: string;
  goodId: bigint;
  // Any additional attributes for this link can be added here if needed in the future
};

const journalGoodLinkService = {
  // RECIPE 1: Create a new link between a Journal and a Good/Service
  async createLink(data: CreateJournalGoodLinkData): Promise<JournalGoodLink> {
    console.log(
      `Chef (JGLService): Linking Journal '${data.journalId}' with Good ID '${data.goodId}'.`
    );

    // Validation: Check if Journal exists
    const journalExists = await prisma.journal.findUnique({
      where: { id: data.journalId },
    });
    if (!journalExists) {
      throw new Error(`Journal with ID '${data.journalId}' not found.`);
    }

    // Validation: Check if Good/Service exists
    const goodExists = await prisma.goodsAndService.findUnique({
      where: { id: data.goodId },
    });
    if (!goodExists) {
      throw new Error(`Good/Service with ID '${data.goodId}' not found.`);
    }

    // Prisma's @@unique([journalId, goodId]) constraint will handle exact duplicates.
    const newLink = await prisma.journalGoodLink.create({
      data: data,
    });
    console.log(`Chef (JGLService): Link created with ID '${newLink.id}'.`);
    return newLink;
  },

  // RECIPE 2: Get a specific link by its ID
  async getLinkById(linkId: bigint): Promise<JournalGoodLink | null> {
    return prisma.journalGoodLink.findUnique({
      where: { id: linkId },
      include: { journal: true, good: true },
    });
  },

  // RECIPE 3: Delete a link by its ID
  async deleteLinkById(linkId: bigint): Promise<JournalGoodLink | null> {
    console.log(`Chef (JGLService): Deleting link with ID '${linkId}'.`);
    try {
      // No further cascading deletes from JournalGoodLink in your current schema.
      return await prisma.journalGoodLink.delete({
        where: { id: linkId },
      });
    } catch (error) {
      console.warn(
        `Chef (JGLService): Link ID '${linkId}' not found for deletion.`,
        error
      );
      return null;
    }
  },

  // RECIPE 4: Delete a link by Journal ID and Good ID
  async deleteLinkByJournalAndGood(
    journalId: string,
    goodId: bigint
  ): Promise<{ count: number }> {
    console.log(
      `Chef (JGLService): Deleting link(s) between Journal '${journalId}' and Good ID '${goodId}'.`
    );
    const result = await prisma.journalGoodLink.deleteMany({
      where: { journalId, goodId },
    });
    console.log(`Chef (JGLService): Deleted ${result.count} link(s).`);
    return result;
  },

  // RECIPE 5: Get all Goods/Services linked to specific Journal(s) (optionally including their children)
  async getGoodsForJournals(
    journalIds: string[],
    includeChildren: boolean = false
  ): Promise<GoodsAndService[]> {
    console.log(
      `Chef (JGLService): Getting goods for Journal IDs '${journalIds.join(
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
        `Chef (JGLService): Target journal IDs for goods (incl. children):`,
        targetJournalIds
      );
    }

    if (targetJournalIds.length === 0) return [];

    const links = await prisma.journalGoodLink.findMany({
      where: {
        journalId: { in: targetJournalIds },
      },
      select: { goodId: true },
      distinct: ["goodId"],
    });

    if (links.length === 0) return [];

    const goodIds = links.map((link) => link.goodId);
    return prisma.goodsAndService.findMany({
      where: {
        id: { in: goodIds },
      },
      orderBy: { label: "asc" },
      include: { taxCode: true, unitOfMeasure: true }, // Include details for display
    });
  },

  // RECIPE 5.1: Get all Goods/Services linked to a specific Journal (optionally including its children)
  async getGoodsForJournal(
    journalId: string,
    includeChildren: boolean = false
  ): Promise<GoodsAndService[]> {
    console.log(
      `Chef (JGLService): Getting goods for Journal '${journalId}', includeChildren: ${includeChildren}.`
    );
    let targetJournalIds = [journalId];

    if (includeChildren) {
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
        `Chef (JGLService): Target journal IDs (incl. children of '${journalId}'):`,
        targetJournalIds
      );
    }

    if (targetJournalIds.length === 0) return [];

    const links = await prisma.journalGoodLink.findMany({
      where: {
        journalId: { in: targetJournalIds },
      },
      select: { goodId: true },
      distinct: ["goodId"],
    });

    if (links.length === 0) {
      return [];
    }

    const goodIds = links.map((link) => link.goodId);
    return prisma.goodsAndService.findMany({
      where: {
        id: { in: goodIds },
      },
      orderBy: { label: "asc" },
      include: { taxCode: true, unitOfMeasure: true }, // Include details for display
    });
  },

  // RECIPE 6: Get all Journals a specific Good/Service is linked to
  async getJournalsForGood(goodId: bigint): Promise<Journal[]> {
    console.log(`Chef (JGLService): Getting journals for Good ID '${goodId}'.`);
    const links = await prisma.journalGoodLink.findMany({
      where: { goodId: goodId },
      include: {
        journal: true,
      },
      distinct: ["journalId"],
    });

    return links
      .map((link) => link.journal)
      .sort((a, b) => a.id.localeCompare(b.id));
  },

  // RECIPE 7: Get all links for a specific good (with journal details)
  async getLinksForGood(goodId: bigint): Promise<JournalGoodLink[]> {
    return prisma.journalGoodLink.findMany({
      where: { goodId },
      include: { journal: true },
      orderBy: { journal: { id: "asc" } },
    });
  },

  // RECIPE 8: Get all links for a specific journal (with good details)
  async getLinksForJournal(journalId: string): Promise<JournalGoodLink[]> {
    return prisma.journalGoodLink.findMany({
      where: { journalId },
      include: { good: { include: { taxCode: true, unitOfMeasure: true } } },
      orderBy: { good: { label: "asc" } },
    });
  },
};

export default journalGoodLinkService;
