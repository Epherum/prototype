// src/app/services/journalService.ts
import { Journal } from "@prisma/client";
import prisma from "@/app/utils/prisma";

// --- Types ---
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

// --- HELPER FUNCTION ---
/**
 * Finds all descendant journal IDs for a given parent journal.
 * Uses a recursive Common Table Expression (CTE) for efficiency.
 * @param parentJournalId The ID of the top-level journal to start from.
 * @returns A promise that resolves to an array of descendant journal IDs (strings).
 */
async function getDescendantJournalIds(
  parentJournalId: string
): Promise<string[]> {
  console.log(
    `Chef (Service): Finding all descendant dishes for main dish '${parentJournalId}'.`
  );
  // Note: We only query for children, not the parent itself.
  const result = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE "JournalDescendants" AS (
      -- Anchor member: direct children of the parent
      SELECT "id", "parent_id"
      FROM "journals"
      WHERE "parent_id" = ${parentJournalId}

      UNION ALL

      -- Recursive member: children of the journals found in the previous step
      SELECT j."id", j."parent_id"
      FROM "journals" j
      INNER JOIN "JournalDescendants" jd ON j."parent_id" = jd."id"
    )
    SELECT "id" FROM "JournalDescendants";
  `;

  const ids = result.map((row) => row.id);
  console.log(
    `Chef (Service): Found ${ids.length} descendant dishes for '${parentJournalId}'.`
  );
  return ids;
}

// --- Service Functions ---
async function getRootJournals(): Promise<Journal[]> {
  console.log(`Chef (Service): Order received for all root-level dishes!`);
  const rootJournals = await prisma.journal.findMany({
    where: {
      parentId: null,
    },
    orderBy: {
      id: "asc",
    },
  });
  console.log(
    `Chef (Service): Root-level dishes are ready! ${rootJournals.length} dishes prepared.`
  );
  return rootJournals;
}

async function getJournalsByParentId(parentId: string): Promise<Journal[]> {
  console.log(
    `Chef (Service): Order received for side dishes of main dish '${parentId}'!`
  );
  const childJournals = await prisma.journal.findMany({
    where: {
      parentId: parentId,
    },
    orderBy: {
      id: "asc",
    },
  });
  console.log(
    `Chef (Service): Side dishes for '${parentId}' are ready! ${childJournals.length} dishes prepared.`
  );
  return childJournals;
}

async function getJournalById(id: string): Promise<Journal | null> {
  console.log(`Chef (Service): Looking up dish '${id}' on the menu.`);
  const journal = await prisma.journal.findUnique({
    where: { id },
  });
  if (journal) {
    console.log(`Chef (Service): Found dish '${id}':`, journal.name);
  } else {
    console.log(`Chef (Service): Dish '${id}' not found on the menu.`);
  }
  return journal;
}

async function getAllJournals(options?: { where?: any }): Promise<Journal[]> {
  console.log(
    `Chef (Service): Preparing a list of ALL dishes with options:`,
    options
  );
  const allJournals = await prisma.journal.findMany({
    where: options?.where,
    orderBy: { id: "asc" },
  });
  console.log(
    `Chef (Service): Full menu list ready! ${allJournals.length} dishes listed.`
  );
  return allJournals;
}

async function createJournal(data: CreateJournalData): Promise<Journal> {
  console.log(
    `Chef (Service): Order to add a new dish: ID '${data.id}', Name '${data.name}'.`
  );

  const existingDish = await prisma.journal.findUnique({
    where: { id: data.id },
  });
  if (existingDish) {
    console.error(
      `Chef (Service): Cannot add dish '${data.id}'. It already exists!`
    );
    throw new Error(`A dish with ID ${data.id} is already on the menu.`);
  }

  if (data.parentId) {
    const parentDish = await prisma.journal.findUnique({
      where: { id: data.parentId },
    });
    if (!parentDish) {
      console.error(
        `Chef (Service): Cannot add side dish. Main dish '${data.parentId}' not found!`
      );
      throw new Error(
        `The main dish (parent journal) with ID ${data.parentId} was not found.`
      );
    }
  }

  const newDish = await prisma.journal.create({ data });
  console.log(
    `Chef (Service): New dish '${newDish.id} - ${newDish.name}' successfully added!`
  );
  return newDish;
}

async function updateJournal(
  id: string,
  data: UpdateJournalData
): Promise<Journal | null> {
  console.log(`Chef (Service): Order to update dish '${id}'. Changes:`, data);

  const dishToUpdate = await prisma.journal.findUnique({ where: { id } });
  if (!dishToUpdate) {
    console.warn(`Chef (Service): Dish '${id}' not found. Cannot update.`);
    return null;
  }

  const updatedDish = await prisma.journal.update({
    where: { id },
    data: data,
  });
  console.log(
    `Chef (Service): Dish '${updatedDish.id} - ${updatedDish.name}' successfully updated!`
  );
  return updatedDish;
}

async function deleteJournal(id: string): Promise<Journal> {
  console.log(`Chef (Service): Order to remove dish '${id}'.`);

  const dishToDelete = await prisma.journal.findUnique({
    where: { id },
    include: {
      children: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!dishToDelete) {
    console.warn(`Chef (Service): Dish '${id}' not found. Cannot delete.`);
    throw new Error(`Dish (Journal) with ID ${id} not found.`);
  }

  if (dishToDelete.children && dishToDelete.children.length > 0) {
    console.error(
      `Chef (Service): Cannot remove dish '${id}'! It has side dishes.`
    );
    throw new Error(
      `Cannot delete dish (Journal) ${id} as it has child journals.`
    );
  }

  const userRoleRestrictions = await prisma.userRole.findFirst({
    where: {
      restrictedTopLevelJournalId: id,
    },
  });

  if (userRoleRestrictions) {
    console.error(
      `Chef (Service): Cannot remove dish '${id}'! It is used in user role restrictions.`
    );
    throw new Error(
      `Cannot delete dish (Journal) ${id} as it is currently assigned as a restriction in one or more user roles.`
    );
  }

  const deletedDish = await prisma.journal.delete({
    where: { id },
  });
  console.log(
    `Chef (Service): Dish '${deletedDish.id} - ${deletedDish.name}' successfully removed.`
  );
  return deletedDish;
}

async function getTopLevelJournals(): Promise<Pick<Journal, "id" | "name">[]> {
  console.log(
    `Chef (Service): Order received for all TOP-LEVEL dishes for admin selection.`
  );
  const topLevelJournals = await prisma.journal.findMany({
    where: {
      parentId: null,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      id: "asc",
    },
  });
  console.log(
    `Chef (Service): Top-level dishes for admin ready! ${topLevelJournals.length} dishes prepared.`
  );
  return topLevelJournals;
}

async function getJournalSubHierarchy(
  rootJournalId: string
): Promise<Journal[]> {
  console.log(
    `[journalService] Fetching sub-hierarchy for rootJournalId: ${rootJournalId}`
  );
  try {
    const result = await prisma.$queryRaw<Journal[]>`
      WITH RECURSIVE "SubTree" AS (
        SELECT *, 0 AS "level"
        FROM "journals"
        WHERE "id" = ${rootJournalId}
        UNION ALL
        SELECT j.*, st."level" + 1
        FROM "journals" j
        INNER JOIN "SubTree" st ON j."parent_id" = st."id"
      )
      SELECT "id", "name", "parent_id" AS "parentId", "is_terminal" AS "isTerminal", "additional_details" AS "additionalDetails", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM "SubTree" ORDER BY "level" ASC, "id" ASC;
    `;
    console.log(
      `[journalService] Returning ${result.length} journals from sub-hierarchy for rootJournalId: ${rootJournalId}`
    );
    return result;
  } catch (error) {
    console.error("[journalService] ERROR in getJournalSubHierarchy:", error);
    throw error;
  }
}

async function getAllJournalsForAdminSelection(): Promise<
  JournalForAdminSelection[]
> {
  console.log(
    `Chef (Service): Order received for ALL dishes for admin journal restriction selection.`
  );
  const allJournals = await prisma.journal.findMany({
    select: {
      id: true,
      name: true,
      parentId: true,
    },
    orderBy: [{ parentId: "asc" }, { id: "asc" }],
  });
  console.log(
    `Chef (Service): All dishes for admin selection ready! ${allJournals.length} dishes prepared.`
  );
  return allJournals;
}

export const journalService = {
  getDescendantJournalIds,
  getRootJournals,
  getJournalsByParentId,
  getJournalById,
  getAllJournals,
  createJournal,
  updateJournal,
  deleteJournal,
  getTopLevelJournals,
  getJournalSubHierarchy,
  getAllJournalsForAdminSelection,
};
