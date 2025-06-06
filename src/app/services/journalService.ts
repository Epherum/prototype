// File: src/app/services/journalService.ts
// (Keep your existing prisma import and Journal type import)
import { PrismaClient, Journal } from "@prisma/client"; // Assuming PrismaClient is the actual type of your prisma instance
import prisma from "@/app/utils/prisma"; // Your existing Prisma client instance

// --- Session User Type (for context) ---
// This should align with the session data you have available in API routes
interface AuthenticatedUserContext {
  companyId: string;
  // userId?: string; // If needed for audit logs, etc.
  // roles/permissions if service functions need to do their own permission checks
}

// --- Types for our "Order Slips" (Data Transfer Objects) ---
// Order slip for creating a new journal dish (now needs company context)
export type CreateJournalData = {
  id: string; // The customer (or admin) decides the ID/number of the new dish
  name: string;
  parentId?: string | null; // Which main dish is this a side for? (optional)
  isTerminal?: boolean; // Is this the final part of a combo meal?
  additionalDetails?: any; // Any special cooking instructions?
  // companyId will be provided by the service layer from the user's session
};

// Order slip for changing an existing journal dish
export type UpdateJournalData = {
  name?: string; // New name for the dish?
  isTerminal?: boolean; // Is it now the final part of a combo?
  additionalDetails?: any; // Any updated special instructions?
  // companyId and id are used for lookup
};

// --- Chef's Recipes (Service Functions - Updated for Multi-Tenancy) ---

// RECIPE 1: Get all root-level journal dishes for a specific company
async function getRootJournals(
  context: AuthenticatedUserContext
): Promise<Journal[]> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Order received for all root-level dishes!`
  );
  const rootJournals = await prisma.journal.findMany({
    where: {
      companyId: context.companyId, // <<< COMPANY SCOPE
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

// RECIPE 2: Get all side dishes for a specific main journal dish within a company
async function getJournalsByParentId(
  parentId: string,
  context: AuthenticatedUserContext
): Promise<Journal[]> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Order received for side dishes of main dish '${parentId}'!`
  );
  const childJournals = await prisma.journal.findMany({
    where: {
      companyId: context.companyId, // <<< COMPANY SCOPE
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

// RECIPE 3: Get a specific journal dish by its ID and companyId
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
        // <<< Use composite key
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

// RECIPE 4: Get ALL journal dishes on the entire menu for a specific company
async function getAllJournals(
  context: AuthenticatedUserContext,
  options?: { where?: any } // 'where' here should be additive to companyId
): Promise<Journal[]> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Preparing a list of ALL dishes with options:`,
    options
  );
  const whereClause = {
    companyId: context.companyId, // <<< COMPANY SCOPE
    ...options?.where, // Merge with other filters
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

// RECIPE 5: Add a new journal dish to the menu for a specific company
async function createJournal(
  data: CreateJournalData,
  context: AuthenticatedUserContext
): Promise<Journal> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Order to add a new dish: ID '${data.id}', Name '${data.name}'.`
  );

  const { companyId } = context;

  const existingDish = await prisma.journal.findUnique({
    where: { id_companyId: { id: data.id, companyId } }, // <<< Use composite key
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
      where: { id_companyId: { id: data.parentId, companyId } }, // <<< Parent must also be in same company
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
      companyId: companyId, // <<< Assign companyId
    },
  });
  console.log(
    `Chef (Service - Company ${companyId}): New dish '${newDish.id} - ${newDish.name}' successfully added!`
  );
  return newDish;
}

// RECIPE 6: Update an existing journal dish on the menu for a specific company
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

  // Ensure the dish exists in the company before updating
  const dishToUpdate = await prisma.journal.findUnique({
    where: { id_companyId: { id, companyId } }, // <<< Use composite key
  });
  if (!dishToUpdate) {
    console.warn(
      `Chef (Service - Company ${companyId}): Dish '${id}' not found in this company. Cannot update.`
    );
    return null;
  }

  const updatedDish = await prisma.journal.update({
    where: { id_companyId: { id, companyId } }, // <<< Use composite key
    data: data,
  });
  console.log(
    `Chef (Service - Company ${companyId}): Dish '${updatedDish.id} - ${updatedDish.name}' successfully updated!`
  );
  return updatedDish;
}

// RECIPE 7: Remove a journal dish from the menu for a specific company
async function deleteJournal(
  id: string,
  context: AuthenticatedUserContext
): Promise<Journal> {
  console.log(
    `Chef (Service - Company ${context.companyId}): Order to remove dish '${id}'.`
  );
  const { companyId } = context;

  const dishToDelete = await prisma.journal.findUnique({
    where: { id_companyId: { id, companyId } }, // <<< Use composite key
    include: {
      children: {
        where: { companyId }, // Ensure children are also checked within the same company
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

  // Also check UserRole restrictions before deleting
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
    where: { id_companyId: { id, companyId } }, // <<< Use composite key
  });
  console.log(
    `Chef (Service - Company ${companyId}): Dish '${deletedDish.id} - ${deletedDish.name}' successfully removed.`
  );
  return deletedDish;
}

// --- NEW RECIPE for User Management ---
// RECIPE 8: Get all TOP-LEVEL journal dishes for a specific company (for admin selection)
async function getTopLevelJournalsByCompany(
  context: AuthenticatedUserContext
): Promise<Pick<Journal, "id" | "name" | "companyId">[]> {
  // Return only necessary fields
  console.log(
    `Chef (Service - Company ${context.companyId}): Order received for all TOP-LEVEL dishes for admin selection.`
  );
  const topLevelJournals = await prisma.journal.findMany({
    where: {
      companyId: context.companyId, // <<< COMPANY SCOPE
      parentId: null, // <<< TOP-LEVEL journals only
    },
    select: {
      // Select only the fields needed for the dropdown
      id: true,
      name: true,
      companyId: true, // companyId is part of the composite key, good to have for clarity if used downstream
    },
    orderBy: {
      id: "asc", // Or name: 'asc'
    },
  });
  console.log(
    `Chef (Service - Company ${context.companyId}): Top-level dishes for admin ready!`,
    topLevelJournals.length,
    "dishes prepared."
  );
  return topLevelJournals;
}

// The Chef's complete recipe book for Journals
// (Make sure to add the new function here)
export const journalService = {
  getRootJournals,
  getJournalsByParentId,
  getJournalById,
  getAllJournals,
  createJournal,
  updateJournal,
  deleteJournal,
  getTopLevelJournalsByCompany, // <<< ADDED NEW FUNCTION
};
