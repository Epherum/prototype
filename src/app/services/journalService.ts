// File: src/services/journalService.ts
import prisma from "@/app/utils/prisma"; // Import the Storeroom Manager access
import { Journal } from "@prisma/client"; // Import what a "Journal" looks like

// --- Types for our "Order Slips" (Data Transfer Objects) ---
// Order slip for creating a new journal dish
export type CreateJournalData = {
  id: string; // The customer (or admin) decides the ID/number of the new dish
  name: string;
  parentId?: string | null; // Which main dish is this a side for? (optional)
  isTerminal?: boolean; // Is this the final part of a combo meal?
  additionalDetails?: any; // Any special cooking instructions?
};

// Order slip for changing an existing journal dish
export type UpdateJournalData = {
  name?: string; // New name for the dish?
  isTerminal?: boolean; // Is it now the final part of a combo?
  // We decided not to let customers change the parentId (move dishes between main courses)
  additionalDetails?: any; // Any updated special instructions?
};

// --- Chef's Recipes (Service Functions) ---

// RECIPE 1: Get all root-level journal dishes (those with no parent dish)
async function getRootJournals(): Promise<Journal[]> {
  console.log("Chef (Service): Order received for all root-level dishes!");
  const rootJournals = await prisma.journal.findMany({
    where: {
      parentId: null, // The condition: find journal dishes with no parent_id
    },
    orderBy: {
      id: "asc", // Serve them in order by their ID
    },
    // include: { children: true } // Maybe later we'll also pack up their immediate side dishes
  });
  console.log(
    "Chef (Service): Root-level dishes are ready!",
    rootJournals.length,
    "dishes prepared."
  );
  return rootJournals;
}

// RECIPE 2: Get all side dishes for a specific main journal dish
async function getJournalsByParentId(parentId: string): Promise<Journal[]> {
  console.log(
    `Chef (Service): Order received for side dishes of main dish '${parentId}'!`
  );
  const childJournals = await prisma.journal.findMany({
    where: {
      parentId: parentId, // The condition: find side dishes matching this main dish
    },
    orderBy: {
      id: "asc", // Serve them in order
    },
    // include: { children: true } // And maybe their own side dishes too? (for L3 display)
  });
  console.log(
    `Chef (Service): Side dishes for '${parentId}' are ready!`,
    childJournals.length,
    "dishes prepared."
  );
  return childJournals;
}

// RECIPE 3: Get a specific journal dish by its ID (like looking up a menu item number)
async function getJournalById(id: string): Promise<Journal | null> {
  console.log(`Chef (Service): Looking up dish '${id}' on the menu.`);
  const journal = await prisma.journal.findUnique({
    where: { id: id },
    // include: { children: true, parent: true } // Maybe also get its side dishes and the main dish it belongs to?
  });
  if (journal) {
    console.log(`Chef (Service): Found dish '${id}':`, journal.name);
  } else {
    console.log(`Chef (Service): Dish '${id}' not found on the menu.`);
  }
  return journal;
}

// RECIPE 4: Get ALL journal dishes on the entire menu (for the big menu board / tree view modal)
async function getAllJournals(options?: { where?: any }): Promise<Journal[]> {
  // Add options
  console.log(
    "Chef (Service): Preparing a list of ALL dishes on the menu with options:",
    options
  );
  const whereClause = options?.where || {}; // Use provided where or empty
  const allJournals = await prisma.journal.findMany({
    where: whereClause,
    orderBy: { id: "asc" },
  });
  console.log(
    "Chef (Service): Full menu list ready!",
    allJournals.length,
    "dishes listed."
  );
  return allJournals;
}

// RECIPE 5: Add a new journal dish to the menu
async function createJournal(data: CreateJournalData): Promise<Journal> {
  console.log(
    `Chef (Service): Order to add a new dish: ID '${data.id}', Name '${data.name}'.`
  );

  // Chef's check: Does a dish with this ID already exist?
  const existingDish = await prisma.journal.findUnique({
    where: { id: data.id },
  });
  if (existingDish) {
    console.error(
      `Chef (Service): Cannot add dish '${data.id}'. It already exists!`
    );
    throw new Error(`A dish with ID ${data.id} is already on the menu.`);
  }

  // Chef's check: If it's a side dish, does its main dish exist?
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
    console.log(
      `Chef (Service): Adding '${data.id}' as a side dish to '${data.parentId}'.`
    );
  } else {
    console.log(`Chef (Service): Adding '${data.id}' as a new main dish.`);
  }

  const newDish = await prisma.journal.create({ data: data });
  console.log(
    `Chef (Service): New dish '${newDish.id} - ${newDish.name}' successfully added to the menu!`
  );
  return newDish;
}

// RECIPE 6: Update an existing journal dish on the menu
async function updateJournal(
  id: string,
  data: UpdateJournalData
): Promise<Journal | null> {
  console.log(`Chef (Service): Order to update dish '${id}'. Changes:`, data);

  // Chef's check: Does this dish even exist?
  const dishToUpdate = await prisma.journal.findUnique({ where: { id } });
  if (!dishToUpdate) {
    console.warn(`Chef (Service): Dish '${id}' not found. Cannot update.`);
    return null; // Or throw new Error(`Dish with ID ${id} not found.`);
  }

  const updatedDish = await prisma.journal.update({
    where: { id: id },
    data: data,
  });
  console.log(
    `Chef (Service): Dish '${updatedDish.id} - ${updatedDish.name}' successfully updated!`
  );
  return updatedDish;
}

// RECIPE 7: Remove a journal dish from the menu
async function deleteJournal(id: string): Promise<Journal> {
  // Changed return type, no longer null
  console.log(`Chef (Service): Order to remove dish '${id}' from the menu.`);

  const dishToDelete = await prisma.journal.findUnique({
    where: { id: id },
    include: { children: { select: { id: true }, take: 1 } },
  });

  if (!dishToDelete) {
    console.warn(`Chef (Service): Dish '${id}' not found. Cannot delete.`);
    throw new Error(`Dish (Journal) with ID ${id} not found.`); // THROW ERROR
  }

  if (dishToDelete.children && dishToDelete.children.length > 0) {
    console.error(
      `Chef (Service): Cannot remove dish '${id}'! It still has side dishes. Remove those first.`
    );
    throw new Error(
      `Cannot delete dish (Journal) ${id} as it has side dishes (child journals). Please remove side dishes first.`
    );
  }

  const deletedDish = await prisma.journal.delete({ where: { id: id } });
  console.log(
    `Chef (Service): Dish '${deletedDish.id} - ${deletedDish.name}' successfully removed from the menu.`
  );
  return deletedDish; // RETURN THE DELETED DISH
}

// The Chef's complete recipe book for Journals
export const journalService = {
  getRootJournals,
  getJournalsByParentId,
  getJournalById,
  getAllJournals,
  createJournal,
  updateJournal,
  deleteJournal,
};
