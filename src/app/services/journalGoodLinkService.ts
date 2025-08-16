// File: src/app/services/journalGoodLinkService.ts
import prisma from "@/app/utils/prisma";
import { JournalGoodLink, GoodsAndService, Journal } from "@prisma/client";
import { getDescendantJournalIdsAsSet } from "@/app/utils/journalUtils";
import { serviceLogger } from "@/lib/logger";

export type CreateJournalGoodLinkData = {
  journalId: string;
  goodId: bigint;
  // Any additional attributes for this link can be added here if needed in the future
};

const journalGoodLinkService = {
  // RECIPE 1: Create a new link (MODIFIED with hierarchical check)
  async createLink(data: CreateJournalGoodLinkData): Promise<JournalGoodLink> {
    serviceLogger.debug(
      `Chef (JGLService): Linking Journal '${data.journalId}' with Good ID '${data.goodId}'.`
    );

    const [journal, goodExists] = await Promise.all([
      prisma.journal.findUnique({
        where: { id: data.journalId },
        select: { id: true, parent_id: true },
      }),
      prisma.goodsAndService.findUnique({
        where: { id: data.goodId },
        select: { id: true },
      }),
    ]);

    if (!journal) {
      throw new Error(`Journal with ID '${data.journalId}' not found.`);
    }
    if (!goodExists) {
      throw new Error(`Good/Service with ID '${data.goodId}' not found.`);
    }

    // ✨ HIERARCHICAL INTEGRITY CHECK (as per spec) ✨
    if (journal.parent_id) {
      const parentLinkExists = await prisma.journalGoodLink.findFirst({
        where: {
          journalId: journal.parent_id,
          goodId: data.goodId,
        },
      });
      if (!parentLinkExists) {
        throw new Error(
          `Business Rule Violation: Cannot link Good '${data.goodId}' to child Journal '${data.journalId}' because a link does not exist with its parent Journal '${journal.parent_id}'.`
        );
      }
    }

    const newLink = await prisma.journalGoodLink.create({ data });
    serviceLogger.debug(`Chef (JGLService): Link created with ID '${newLink.id}'.`);
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
    serviceLogger.debug(`Chef (JGLService): Deleting link with ID '${linkId}'.`);
    try {
      // No further cascading deletes from JournalGoodLink in your current schema.
      return await prisma.journalGoodLink.delete({
        where: { id: linkId },
      });
    } catch (error) {
      serviceLogger.warn(
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
    serviceLogger.debug(
      `Chef (JGLService): Deleting link(s) between Journal '${journalId}' and Good ID '${goodId}'.`
    );
    const result = await prisma.journalGoodLink.deleteMany({
      where: { journalId, goodId },
    });
    serviceLogger.debug(`Chef (JGLService): Deleted ${result.count} link(s).`);
    return result;
  },

  // RECIPE 5: Get all Goods/Services linked to specific Journal(s) (optionally including their children)
  async getGoodsForJournals(
    journalIds: string[],
    includeChildren: boolean = false
  ): Promise<GoodsAndService[]> {
    if (!journalIds || journalIds.length === 0) {
      return [];
    }

    let targetJournalIds = new Set<string>(journalIds);
    if (includeChildren) {
      targetJournalIds = await getDescendantJournalIdsAsSet(journalIds);
    }

    if (targetJournalIds.size === 0) return [];

    const links = await prisma.journalGoodLink.findMany({
      where: { journalId: { in: Array.from(targetJournalIds) } },
      select: { goodId: true },
      distinct: ["goodId"],
    });

    if (links.length === 0) return [];

    const goodIds = links.map((link) => link.goodId);
    return prisma.goodsAndService.findMany({
      where: { id: { in: goodIds } },
      orderBy: { label: "asc" },
      include: { taxCode: true, unitOfMeasure: true },
    });
  },

  // RECIPE 6: Get all Journals a specific Good/Service is linked to
  async getJournalsForGood(goodId: bigint): Promise<Journal[]> {
    serviceLogger.debug(`Chef (JGLService): Getting journals for Good ID '${goodId}'.`);
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
