// src/app/services/journalService.ts
import { PrismaClient, Journal } from "@prisma/client";
import prisma from "@/app/utils/prisma";

// --- Types (Existing) ---
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
  "id" | "name" | "parentId" | "companyId"
>;

interface AuthenticatedUserContext {
  companyId: string;
}

// --- NEW HELPER FUNCTION ---
/**
 * Finds all descendant journal IDs for a given parent journal.
 * Uses a recursive Common Table Expression (CTE) for efficiency.
 * @param parentJournalId The ID of the top-level journal to start from.
 * @param companyId The company ID.
 * @returns A promise that resolves to an array of descendant journal IDs (strings).
 */
async function getDescendantJournalIds(
  parentJournalId: string,
  companyId: string
): Promise<string[]> {
  console.log(
    `Chef (Service - Company ${companyId}): Finding all descendant dishes for main dish '${parentJournalId}'.`
  );
  // Note: We only query for children, not the parent itself.
  const result = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE "JournalDescendants" AS (
      -- Anchor member: direct children of the parent
      SELECT "id", "parent_id"
      FROM "journals"
      WHERE "parent_id" = ${parentJournalId} AND "company_id" = ${companyId}

      UNION ALL

      -- Recursive member: children of the journals found in the previous step
      SELECT j."id", j."parent_id"
      FROM "journals" j
      INNER JOIN "JournalDescendants" jd ON j."parent_id" = jd."id"
      WHERE j."company_id" = ${companyId}
    )
    SELECT "id" FROM "JournalDescendants";
  `;

  const ids = result.map((row) => row.id);
  console.log(
    `Chef (Service - Company ${companyId}): Found ${ids.length} descendant dishes for '${parentJournalId}'.`
  );
  return ids;
}

// --- Existing Service Functions ---
async function getRootJournals(
  context: AuthenticatedUserContext
): Promise<Journal[]> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Order received for all root-level dishes!`
  );
  const rootJournals = await prisma.journal.findMany({
    where: {
      companyId: context.companyId,
      parentId: null,
    },
    orderBy: {
      id: "asc",
    },
  });
  console.log(
    `Chef (Service - Company ${context.companyId}): Root-level dishes are ready!`,
    rootJournals.length,
    "dishes prepared."
  );
  return rootJournals;
}

async function getJournalsByParentId(
  parentId: string,
  context: AuthenticatedUserContext
): Promise<Journal[]> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Order received for side dishes of main dish '${parentId}'!`
  );
  const childJournals = await prisma.journal.findMany({
    where: {
      companyId: context.companyId,
      parentId: parentId,
    },
    orderBy: {
      id: "asc",
    },
  });
  console.log(
    `Chef (Service - Company ${context.companyId}): Side dishes for '${parentId}' are ready!`,
    childJournals.length,
    "dishes prepared."
  );
  return childJournals;
}

async function getJournalById(
  id: string,
  context: AuthenticatedUserContext
): Promise<Journal | null> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Looking up dish '${id}' on the menu.`
  );
  const journal = await prisma.journal.findUnique({
    where: {
      id_companyId: {
        id: id,
        companyId: context.companyId,
      },
    },
  });
  if (journal) {
    console.log(
      `Chef (Service - Company ${context.companyId}): Found dish '${id}':`,
      journal.name
    );
  } else {
    console.log(
      `Chef (Service - Company ${context.companyId}): Dish '${id}' not found on the menu.`
    );
  }
  return journal;
}

async function getAllJournals(
  context: AuthenticatedUserContext,
  options?: { where?: any }
): Promise<Journal[]> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Preparing a list of ALL dishes with options:`,
    options
  );
  const whereClause = {
    companyId: context.companyId,
    ...options?.where,
  };
  const allJournals = await prisma.journal.findMany({
    where: whereClause,
    orderBy: { id: "asc" },
  });
  console.log(
    `Chef (Service - Company ${context.companyId}): Full menu list ready!`,
    allJournals.length,
    "dishes listed."
  );
  return allJournals;
}

async function createJournal(
  data: CreateJournalData,
  context: AuthenticatedUserContext
): Promise<Journal> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Order to add a new dish: ID '${data.id}', Name '${data.name}'.`
  );

  const { companyId } = context;

  const existingDish = await prisma.journal.findUnique({
    where: { id_companyId: { id: data.id, companyId } },
  });
  if (existingDish) {
    console.error(
      `Chef (Service - Company ${companyId}): Cannot add dish '${data.id}'. It already exists in this company!`
    );
    throw new Error(
      `A dish with ID ${data.id} is already on the menu for this company.`
    );
  }

  if (data.parentId) {
    const parentDish = await prisma.journal.findUnique({
      where: { id_companyId: { id: data.parentId, companyId } },
    });
    if (!parentDish) {
      console.error(
        `Chef (Service - Company ${companyId}): Cannot add side dish. Main dish '${data.parentId}' not found in this company!`
      );
      throw new Error(
        `The main dish (parent journal) with ID ${data.parentId} was not found in this company.`
      );
    }
  }

  const newDish = await prisma.journal.create({
    data: {
      ...data,
      companyId: companyId,
    },
  });
  console.log(
    `Chef (Service - Company ${companyId}): New dish '${newDish.id} - ${newDish.name}' successfully added!`
  );
  return newDish;
}

async function updateJournal(
  id: string,
  data: UpdateJournalData,
  context: AuthenticatedUserContext
): Promise<Journal | null> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Order to update dish '${id}'. Changes:`,
    data
  );
  const { companyId } = context;

  const dishToUpdate = await prisma.journal.findUnique({
    where: { id_companyId: { id, companyId } },
  });
  if (!dishToUpdate) {
    console.warn(
      `Chef (Service - Company ${companyId}): Dish '${id}' not found in this company. Cannot update.`
    );
    return null;
  }

  const updatedDish = await prisma.journal.update({
    where: { id_companyId: { id, companyId } },
    data: data,
  });
  console.log(
    `Chef (Service - Company ${companyId}): Dish '${updatedDish.id} - ${updatedDish.name}' successfully updated!`
  );
  return updatedDish;
}

async function deleteJournal(
  id: string,
  context: AuthenticatedUserContext
): Promise<Journal> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Order to remove dish '${id}'.`
  );
  const { companyId } = context;

  const dishToDelete = await prisma.journal.findUnique({
    where: { id_companyId: { id, companyId } },
    include: {
      children: {
        where: { companyId },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!dishToDelete) {
    console.warn(
      `Chef (Service - Company ${companyId}): Dish '${id}' not found in this company. Cannot delete.`
    );
    throw new Error(
      `Dish (Journal) with ID ${id} not found in company ${companyId}.`
    );
  }

  if (dishToDelete.children && dishToDelete.children.length > 0) {
    console.error(
      `Chef (Service - Company ${companyId}): Cannot remove dish '${id}'! It has side dishes in this company.`
    );
    throw new Error(
      `Cannot delete dish (Journal) ${id} from company ${companyId} as it has child journals.`
    );
  }

  const userRoleRestrictions = await prisma.userRole.findFirst({
    where: {
      restrictedTopLevelJournalId: id,
      restrictedTopLevelJournalCompanyId: companyId,
    },
  });

  if (userRoleRestrictions) {
    console.error(
      `Chef (Service - Company ${companyId}): Cannot remove dish '${id}'! It is used in user role restrictions.`
    );
    throw new Error(
      `Cannot delete dish (Journal) ${id} from company ${companyId} as it is currently assigned as a restriction in one or more user roles.`
    );
  }

  const deletedDish = await prisma.journal.delete({
    where: { id_companyId: { id, companyId } },
  });
  console.log(
    `Chef (Service - Company ${companyId}): Dish '${deletedDish.id} - ${deletedDish.name}' successfully removed.`
  );
  return deletedDish;
}

async function getTopLevelJournalsByCompany(
  context: AuthenticatedUserContext
): Promise<Pick<Journal, "id" | "name" | "companyId">[]> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Order received for all TOP-LEVEL dishes for admin selection.`
  );
  const topLevelJournals = await prisma.journal.findMany({
    where: {
      companyId: context.companyId,
      parentId: null,
    },
    select: {
      id: true,
      name: true,
      companyId: true,
    },
    orderBy: {
      id: "asc",
    },
  });
  console.log(
    `Chef (Service - Company ${context.companyId}): Top-level dishes for admin ready!`,
    topLevelJournals.length,
    "dishes prepared."
  );
  return topLevelJournals;
}

async function getJournalSubHierarchy(
  rootJournalId: string,
  context: AuthenticatedUserContext
): Promise<Journal[]> {
  const { companyId } = context;
  console.log(
    `[journalService] Fetching sub-hierarchy for rootJournalId: ${rootJournalId}, companyId: ${companyId}`
  );

  const queryStringForLog = `
    WITH RECURSIVE "SubTree" AS (
      SELECT *, 0 AS level
      FROM "journals"
      WHERE "id" = '${rootJournalId.replace(
        /'/g,
        "''"
      )}' AND "company_id" = '${companyId.replace(/'/g, "''")}'
      UNION ALL
      SELECT j.*, st.level + 1
      FROM "journals" j
      INNER JOIN "SubTree" st ON j."parent_id" = st."id"
      WHERE j."company_id" = '${companyId.replace(/'/g, "''")}'
    )
    SELECT * FROM "SubTree" ORDER BY "level" ASC, "id" ASC;
  `;
  console.log(
    `[journalService] Attempting SQL query: ${queryStringForLog
      .replace(/\s\s+/g, " ")
      .trim()}`
  );

  try {
    const result = await prisma.$queryRaw<Journal[]>`
      WITH RECURSIVE "SubTree" AS (
        SELECT *, 0 AS "level"
        FROM "journals"
        WHERE "id" = ${rootJournalId} AND "company_id" = ${companyId}
        UNION ALL
        SELECT j.*, st."level" + 1
        FROM "journals" j
        INNER JOIN "SubTree" st ON j."parent_id" = st."id"
        WHERE j."company_id" = ${companyId}
      )
      SELECT "id", "company_id" AS "companyId", "name", "parent_id" AS "parentId", "is_terminal" AS "isTerminal", "additional_details" AS "additionalDetails", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM "SubTree" ORDER BY "level" ASC, "id" ASC;
    `;

    console.log(
      `[journalService] Raw query result for sub-hierarchy (count: ${result.length}):`,
      JSON.stringify(result, null, 2)
    );

    if (result.length === 0 && rootJournalId) {
      console.warn(
        `[journalService] No journals found for root ${rootJournalId} in company ${companyId} by sub-hierarchy query. Checking if root node exists separately...`
      );
      const rootNodeExists = await prisma.journal.findUnique({
        where: { id_companyId: { id: rootJournalId, companyId: companyId } },
      });
      console.log(
        `[journalService] Separate check: Root node ${rootJournalId} exists in company ${companyId}? :`,
        !!rootNodeExists
      );
    }

    console.log(
      `[journalService] Returning ${result.length} journals from sub-hierarchy for rootJournalId: ${rootJournalId}`
    );
    return result;
  } catch (error) {
    console.error("[journalService] ERROR in getJournalSubHierarchy:", error);
    if (error instanceof prisma.PrismaClientKnownRequestError) {
      console.error("[journalService] Prisma Error Code:", error.code);
      console.error("[journalService] Prisma Error Meta:", error.meta);
    }
    throw error;
  }
}

async function getAllJournalsForAdminSelection(
  context: AuthenticatedUserContext
): Promise<JournalForAdminSelection[]> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Order received for ALL dishes for admin journal restriction selection.`
  );
  const allJournalsInCompany = await prisma.journal.findMany({
    where: {
      companyId: context.companyId,
    },
    select: {
      id: true,
      name: true,
      parentId: true,
      companyId: true,
    },
    orderBy: [{ parentId: "asc" }, { id: "asc" }],
  });
  console.log(
    `Chef (Service - Company ${context.companyId}): All dishes for admin selection ready!`,
    allJournalsInCompany.length,
    "dishes prepared."
  );
  return allJournalsInCompany;
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
  getTopLevelJournalsByCompany,
  getJournalSubHierarchy,
  getAllJournalsForAdminSelection,
};
