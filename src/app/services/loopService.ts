// src/app/services/loopService.ts

import { JournalLoop, JournalLoopConnection, LoopStatus, Prisma } from "@prisma/client";
import prisma from "@/app/utils/prisma";
import { serviceLogger } from "@/lib/logger";

// --- Types ---

export type CreateLoopData = {
  name: string;
  description?: string;
  journalIds: string[];
};

export type UpdateLoopData = {
  name?: string;
  description?: string;
  status?: LoopStatus;
  journalIds?: string[];
};

export type GetLoopsOptions = {
  status?: LoopStatus;
  search?: string;
};

export type LoopWithConnections = JournalLoop & {
  journalConnections: (JournalLoopConnection & {
    fromJournal: { id: string; name: string };
    toJournal: { id: string; name: string };
  })[];
};

// --- Service Functions ---

/**
 * Validates that the provided journal IDs form a valid closed loop.
 * A valid loop must:
 * - Have at least 3 journals
 * - Form a closed circuit (last journal connects back to first)
 * - All journals must exist in the database
 */
async function validateLoop(journalIds: string[]): Promise<void> {
  serviceLogger.debug(`loopService.validateLoop: Input - journalIds: [${journalIds.join(', ')}]`);

  // Check minimum length
  if (journalIds.length < 3) {
    throw new Error("Invalid loop: Loop must contain at least 3 journals");
  }

  // Check that all journals exist
  const existingJournals = await prisma.journal.findMany({
    where: { id: { in: journalIds } },
    select: { id: true },
  });

  const existingIds = existingJournals.map(j => j.id);
  const missingIds = journalIds.filter(id => !existingIds.includes(id));

  if (missingIds.length > 0) {
    throw new Error(`Invalid loop: Journals not found: ${missingIds.join(', ')}`);
  }

  // Check for duplicates (same journal appearing multiple times)
  const uniqueIds = new Set(journalIds);
  if (uniqueIds.size !== journalIds.length) {
    throw new Error("Invalid loop: Duplicate journals are not allowed in a loop");
  }

  serviceLogger.debug("loopService.validateLoop: Loop validation passed");
}

/**
 * Creates connections for a loop based on the journal IDs array.
 * Each journal connects to the next one in the array, with the last connecting back to the first.
 */
function createLoopConnections(loopId: string, journalIds: string[]): Prisma.JournalLoopConnectionCreateManyInput[] {
  const connections: Prisma.JournalLoopConnectionCreateManyInput[] = [];

  for (let i = 0; i < journalIds.length; i++) {
    const fromJournalId = journalIds[i];
    const toJournalId = journalIds[(i + 1) % journalIds.length]; // Wrap around to create closed loop

    connections.push({
      loopId,
      fromJournalId,
      toJournalId,
      sequence: i,
    });
  }

  return connections;
}

/**
 * Gets all journal loops with optional filtering.
 */
async function getLoops(options: GetLoopsOptions = {}): Promise<LoopWithConnections[]> {
  serviceLogger.debug(`loopService.getLoops: Input - options:`, options);

  const where: Prisma.JournalLoopWhereInput = {
    entityState: 'ACTIVE',
  };

  if (options.status) {
    where.status = options.status;
  }

  if (options.search) {
    where.name = {
      contains: options.search,
      mode: 'insensitive',
    };
  }

  const loops = await prisma.journalLoop.findMany({
    where,
    include: {
      journalConnections: {
        include: {
          fromJournal: {
            select: { id: true, name: true },
          },
          toJournal: {
            select: { id: true, name: true },
          },
        },
        orderBy: { sequence: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  serviceLogger.debug(`loopService.getLoops: Output - loops count: ${loops.length}`);
  return loops;
}

/**
 * Gets a specific journal loop by ID.
 */
async function getLoopById(id: string): Promise<LoopWithConnections | null> {
  serviceLogger.debug(`loopService.getLoopById: Input - id: ${id}`);

  const loop = await prisma.journalLoop.findFirst({
    where: {
      id,
      entityState: 'ACTIVE',
    },
    include: {
      journalConnections: {
        include: {
          fromJournal: {
            select: { id: true, name: true },
          },
          toJournal: {
            select: { id: true, name: true },
          },
        },
        orderBy: { sequence: 'asc' },
      },
    },
  });

  serviceLogger.debug(`loopService.getLoopById: Output - loop found: ${!!loop}`);
  return loop;
}

/**
 * Creates a new journal loop.
 */
async function createLoop(data: CreateLoopData, userId: string): Promise<LoopWithConnections> {
  serviceLogger.debug(`loopService.createLoop: Input - data:`, data);

  // Validate the loop
  await validateLoop(data.journalIds);

  // Create the loop and its connections in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the loop
    const loop = await tx.journalLoop.create({
      data: {
        name: data.name,
        description: data.description,
        status: 'DRAFT',
        createdById: userId,
      },
    });

    // Create the connections
    const connections = createLoopConnections(loop.id, data.journalIds);
    await tx.journalLoopConnection.createMany({
      data: connections,
    });

    // Return the complete loop with connections
    return await tx.journalLoop.findUniqueOrThrow({
      where: { id: loop.id },
      include: {
        journalConnections: {
          include: {
            fromJournal: {
              select: { id: true, name: true },
            },
            toJournal: {
              select: { id: true, name: true },
            },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });
  });

  serviceLogger.debug(`loopService.createLoop: Output - loop created with id: ${result.id}`);
  return result;
}

/**
 * Updates an existing journal loop.
 */
async function updateLoop(id: string, data: UpdateLoopData, _userId: string): Promise<LoopWithConnections | null> {
  serviceLogger.debug(`loopService.updateLoop: Input - id: ${id}, data:`, data);

  // Check if loop exists
  const existingLoop = await prisma.journalLoop.findFirst({
    where: { id, entityState: 'ACTIVE' },
  });

  if (!existingLoop) {
    return null;
  }

  // If journalIds are being updated, validate the new loop
  if (data.journalIds) {
    await validateLoop(data.journalIds);
  }

  // Update the loop and optionally its connections in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update the loop basic info
    const updateData: Prisma.JournalLoopUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;

    await tx.journalLoop.update({
      where: { id },
      data: updateData,
    });

    // If journalIds are provided, recreate connections
    if (data.journalIds) {
      // Delete existing connections
      await tx.journalLoopConnection.deleteMany({
        where: { loopId: id },
      });

      // Create new connections
      const connections = createLoopConnections(id, data.journalIds);
      await tx.journalLoopConnection.createMany({
        data: connections,
      });
    }

    // Return the updated loop with connections
    return await tx.journalLoop.findUniqueOrThrow({
      where: { id },
      include: {
        journalConnections: {
          include: {
            fromJournal: {
              select: { id: true, name: true },
            },
            toJournal: {
              select: { id: true, name: true },
            },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });
  });

  serviceLogger.debug(`loopService.updateLoop: Output - loop updated with id: ${result.id}`);
  return result;
}

/**
 * Deletes a journal loop (soft delete).
 */
async function deleteLoop(id: string, userId: string): Promise<boolean> {
  serviceLogger.debug(`loopService.deleteLoop: Input - id: ${id}`);

  const updated = await prisma.journalLoop.updateMany({
    where: {
      id,
      entityState: 'ACTIVE',
    },
    data: {
      entityState: 'DELETED',
      deletedById: userId,
      deletedAt: new Date(),
    },
  });

  const success = updated.count > 0;
  serviceLogger.debug(`loopService.deleteLoop: Output - success: ${success}`);
  return success;
}

/**
 * Gets all loops that contain a specific journal ID.
 */
async function getLoopsForJournal(journalId: string): Promise<LoopWithConnections[]> {
  serviceLogger.debug(`loopService.getLoopsForJournal: Input - journalId: ${journalId}`);

  const loops = await prisma.journalLoop.findMany({
    where: {
      entityState: 'ACTIVE',
      journalConnections: {
        some: {
          OR: [
            { fromJournalId: journalId },
            { toJournalId: journalId },
          ],
        },
      },
    },
    include: {
      journalConnections: {
        include: {
          fromJournal: {
            select: { id: true, name: true },
          },
          toJournal: {
            select: { id: true, name: true },
          },
        },
        orderBy: { sequence: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  serviceLogger.debug(`loopService.getLoopsForJournal: Output - loops count: ${loops.length}`);
  return loops;
}

// Export the service
export const loopService = {
  getLoops,
  getLoopById,
  createLoop,
  updateLoop,
  deleteLoop,
  getLoopsForJournal,
  validateLoop,
};