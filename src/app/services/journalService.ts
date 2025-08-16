//src/app/services/journalService.ts
import { Journal, Prisma } from "@prisma/client";
import prisma from "@/app/utils/prisma";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { serviceLogger } from "@/lib/logger";

// --- Types (Unchanged) ---
export type CreateJournalData = {
  id: string;
  name: string;
  parentId?: string | null;
  isTerminal?: boolean;
  additionalDetails?: any;
};

export type UpdateJournalData = {
  name?: string;
  isTerminal?: boolean;
  additionalDetails?: any;
};

export type JournalForAdminSelection = Pick<
  Journal,
  "id" | "name" | "parentId"
>;

// --- Service Functions ---

/**
 * ✅ EXISTING & SPECIFIED
 * Finds all descendant journal IDs for a given parent journal.
 */
async function getDescendantJournalIds(
  parentJournalId: string
): Promise<string[]> {
  serviceLogger.debug(
    `journalService.getDescendantJournalIds: Input - parentJournalId: '${parentJournalId}'`
  );
  const result = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE "JournalDescendants" AS (
      SELECT "id", "parent_id" FROM "journals" WHERE "parent_id" = ${parentJournalId}
      UNION ALL
      SELECT j."id", j."parent_id" FROM "journals" j
      INNER JOIN "JournalDescendants" jd ON j."parent_id" = jd."id"
    )
    SELECT "id" FROM "JournalDescendants";
  `;
  const ids = result.map((row) => row.id);
 
  return ids;
}

/**
 * ✅ EXISTING & SPECIFIED
 * Fetches the complete hierarchy of journals starting from a given root.
 */
async function getJournalSubHierarchy(
  rootJournalId: string | null
): Promise<Journal[]> {
  serviceLogger.debug(
    `journalService.getJournalSubHierarchy: Input - rootJournalId: ${rootJournalId}`
  );

  // Dynamically create the correct starting condition for the recursive query.
  // This uses Prisma.sql for type-safe, parameterized query building.
  const whereClause = rootJournalId
    ? Prisma.sql`WHERE "id" = ${rootJournalId}`
    : Prisma.sql`WHERE "parent_id" IS NULL`;

  const result = await prisma.$queryRaw<Journal[]>`
    WITH RECURSIVE "SubTree" AS (
      SELECT *, 0 AS "level" FROM "journals" ${whereClause}
      UNION ALL
      SELECT j.*, st."level" + 1 FROM "journals" j
      INNER JOIN "SubTree" st ON j."parent_id" = st."id"
    )
    SELECT "id", "name", "parent_id" AS "parentId", "is_terminal" AS "isTerminal", "additional_details" AS "additionalDetails", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
    FROM "SubTree" ORDER BY "level" ASC, "id" ASC;
  `;


  return result;
}

/**
 * ✨ NEW
 * Finds all unique Journals that one or more specified Partners are linked to.
 */
async function getJournalsForPartners(
  partnerIds: bigint[]
): Promise<Journal[]> {
  serviceLogger.debug(
    "journalService.getJournalsForPartners: Input",
    JSON.stringify({ partnerIds }, jsonBigIntReplacer)
  );

  if (!partnerIds || partnerIds.length === 0) {
    serviceLogger.debug(
      "journalService.getJournalsForPartners: Output - No partnerIds provided, returning empty array."
    );
    return [];
  }

  const journalLinks = await prisma.journalPartnerLink.findMany({
    where: { partnerId: { in: partnerIds } },
    select: { journalId: true },
    distinct: ["journalId"],
  });

  const journalIds = journalLinks.map((link) => link.journalId);

  if (journalIds.length === 0) {
    serviceLogger.debug(
      "journalService.getJournalsForPartners: Output - No associated journals found, returning empty array."
    );
    return [];
  }

  const journals = await prisma.journal.findMany({
    where: { id: { in: journalIds } },
    orderBy: { id: "asc" },
  });

  serviceLogger.debug(
    `journalService.getJournalsForPartners: Output - Found ${journals.length} journals.`
  );
  return journals;
}

/**
 * ✨ NEW
 * Finds all unique Journals that one or more specified Goods are linked to.
 */
async function getJournalsForGoods(goodIds: bigint[]): Promise<Journal[]> {
  serviceLogger.debug(
    "journalService.getJournalsForGoods: Input",
    JSON.stringify({ goodIds }, jsonBigIntReplacer)
  );

  if (!goodIds || goodIds.length === 0) {
    serviceLogger.debug(
      "journalService.getJournalsForGoods: Output - No goodIds provided, returning empty array."
    );
    return [];
  }

  const journals = await prisma.journal.findMany({
    where: {
      journalPartnerLinks: {
        some: {
          journalPartnerGoodLinks: {
            some: { goodId: { in: goodIds } },
          },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  serviceLogger.debug(
    `journalService.getJournalsForGoods: Output - Found ${journals.length} journals.`
  );
  return journals;
}

/**
 * ✅ NEW: Get journals that are linked to a specific document through DocumentLine
 */
async function getJournalsForDocument(documentId: bigint): Promise<Journal[]> {
  serviceLogger.debug(
    `journalService.getJournalsForDocument: Input - documentId: '${documentId}'`
  );

  if (!documentId) {
    serviceLogger.debug(
      "journalService.getJournalsForDocument: Output - No documentId provided, returning empty array."
    );
    return [];
  }

  const journals = await prisma.journal.findMany({
    where: {
      journalPartnerLinks: {
        some: {
          journalPartnerGoodLinks: {
            some: {
              documentLines: {
                some: { documentId },
              },
            },
          },
        },
      },
    },
    distinct: ['id'],
    orderBy: { name: 'asc' },
  });

  serviceLogger.debug(
    `journalService.getJournalsForDocument: Output - Found ${journals.length} journals.`
  );
  return journals;
}

// --- RESTORED: Original CRUD and Helper Functions ---
// The following functions from your original file are preserved for use in other parts of the application.

async function getRootJournals(): Promise<Journal[]> {
  serviceLogger.debug(
    `journalService.getRootJournals: Fetching all root-level journals.`
  );
  const rootJournals = await prisma.journal.findMany({
    where: { parentId: null },
    orderBy: { id: "asc" },
  });
  serviceLogger.debug(
    `journalService.getRootJournals: Output - Found ${rootJournals.length} journals.`
  );
  return rootJournals;
}

async function getJournalsByParentId(parentId: string): Promise<Journal[]> {
  serviceLogger.debug(
    `journalService.getJournalsByParentId: Input - parentId: '${parentId}'`
  );
  const childJournals = await prisma.journal.findMany({
    where: { parentId: parentId },
    orderBy: { id: "asc" },
  });
  serviceLogger.debug(
    `journalService.getJournalsByParentId: Output - Found ${childJournals.length} journals.`
  );
  return childJournals;
}

async function getJournalById(id: string): Promise<Journal | null> {
  serviceLogger.debug(`journalService.getJournalById: Input - id: '${id}'`);
  const journal = await prisma.journal.findUnique({ where: { id } });
  serviceLogger.debug(`journalService.getJournalById: Output`, journal);
  return journal;
}

async function getAllJournals(options?: { where?: any }): Promise<Journal[]> {
  serviceLogger.debug(`journalService.getAllJournals: Input`, options);
  const allJournals = await prisma.journal.findMany({
    where: options?.where,
    orderBy: { id: "asc" },
  });
  serviceLogger.debug(
    `journalService.getAllJournals: Output - Found ${allJournals.length} journals.`
  );
  return allJournals;
}

async function createJournal(data: CreateJournalData): Promise<Journal> {
  serviceLogger.debug(`journalService.createJournal: Input`, data);
  if (data.parentId) {
    const parent = await prisma.journal.findUnique({
      where: { id: data.parentId },
    });
    if (!parent)
      throw new Error(`Parent journal with ID ${data.parentId} not found.`);
  }
  const newJournal = await prisma.journal.create({ data });
  serviceLogger.debug(`journalService.createJournal: Output`, newJournal);
  return newJournal;
}

async function updateJournal(
  id: string,
  data: UpdateJournalData
): Promise<Journal | null> {
  serviceLogger.debug(`journalService.updateJournal: Input`, { id, data });
  const updatedJournal = await prisma.journal.update({ where: { id }, data });
  serviceLogger.debug(`journalService.updateJournal: Output`, updatedJournal);
  return updatedJournal;
}

async function deleteJournal(id: string): Promise<Journal> {
  serviceLogger.debug(`journalService.deleteJournal: Input`, { id });
  // Restoring the important pre-delete checks from your original file
  const childrenCount = await prisma.journal.count({ where: { parentId: id } });
  if (childrenCount > 0) {
    throw new Error(`Cannot delete Journal ${id} as it has child journals.`);
  }
  const userRoleRestrictionCount = await prisma.userRole.count({
    where: { restrictedTopLevelJournalId: id },
  });
  if (userRoleRestrictionCount > 0) {
    throw new Error(
      `Cannot delete Journal ${id} as it is used in user role restrictions.`
    );
  }
  const deletedJournal = await prisma.journal.delete({ where: { id } });
  serviceLogger.debug(`journalService.deleteJournal: Output`, deletedJournal);
  return deletedJournal;
}

async function getTopLevelJournals(): Promise<Pick<Journal, "id" | "name">[]> {
  serviceLogger.debug(
    `journalService.getTopLevelJournals: Fetching top-level journals for admin selection.`
  );
  const topLevelJournals = await prisma.journal.findMany({
    where: { parentId: null },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  serviceLogger.debug(
    `journalService.getTopLevelJournals: Output - Found ${topLevelJournals.length} journals.`
  );
  return topLevelJournals;
}

async function getAllJournalsForAdminSelection(): Promise<
  JournalForAdminSelection[]
> {
  serviceLogger.debug(
    `journalService.getAllJournalsForAdminSelection: Fetching all journals for admin selection.`
  );
  const allJournals = await prisma.journal.findMany({
    select: { id: true, name: true, parentId: true },
    orderBy: [{ parentId: "asc" }, { id: "asc" }],
  });
  serviceLogger.debug(
    `journalService.getAllJournalsForAdminSelection: Output - Found ${allJournals.length} journals.`
  );
  return allJournals;
}

export async function isDescendantOf(
  descendantId: string,
  ancestorId: string
): Promise<boolean> {
  serviceLogger.debug(
    `journalService.isDescendantOf: Checking if '${descendantId}' is descendant of '${ancestorId}'`
  );
  if (descendantId === ancestorId) return true;
  const result = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE "JournalHierarchy" AS (
      SELECT id, "parent_id" FROM "journals" WHERE id = ${descendantId}
      UNION ALL
      SELECT j.id, j."parent_id" FROM "journals" j
      INNER JOIN "JournalHierarchy" jh ON j.id = jh."parent_id"
    )
    SELECT id FROM "JournalHierarchy" WHERE id = ${ancestorId};
  `;
  const isDescendant = result.length > 0;
  serviceLogger.debug(`journalService.isDescendantOf: Output - ${isDescendant}`);
  return isDescendant;
}

// --- The Complete Service Object ---
export const journalService = {
  // Functions specified in the new documentation
  getDescendantJournalIds,
  getJournalSubHierarchy,
  getJournalsForPartners,
  getJournalsForGoods,
  getJournalsForDocument,

  // All original functions, preserved
  getRootJournals,
  getJournalsByParentId,
  getJournalById,
  getAllJournals,
  createJournal,
  updateJournal,
  deleteJournal,
  getTopLevelJournals,
  getAllJournalsForAdminSelection,
  isDescendantOf,
};
