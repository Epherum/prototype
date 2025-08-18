// src/app/services/statusService.ts

import { PrismaClient, Status, Prisma } from "@prisma/client";
import { StatusFormData, StatusUsage } from "@/services/clientStatusService";

const prisma = new PrismaClient();

export interface StatusWithUsage extends Status {
  _count?: {
    partners: number;
    goodsAndServices: number;
    documents: number;
  };
}

// Get all statuses with optional usage counts
export const getAllStatuses = async (includeUsage = false): Promise<StatusWithUsage[]> => {
  const statuses = await prisma.status.findMany({
    orderBy: [
      { displayOrder: "asc" },
      { createdAt: "asc" }
    ],
    include: includeUsage ? {
      _count: {
        select: {
          partners: true,
          goodsAndServices: true,
          documents: true,
        }
      }
    } : undefined,
  });

  return statuses;
};

// Get status by ID
export const getStatusById = async (id: string): Promise<Status | null> => {
  return await prisma.status.findUnique({
    where: { id },
  });
};

// Create new status
export const createStatus = async (data: StatusFormData): Promise<Status> => {
  // Check if this is the first status - if so, make it default
  const existingStatusCount = await prisma.status.count();
  const isDefault = existingStatusCount === 0;

  // If this is set to be default, remove default from others
  if (isDefault) {
    await prisma.status.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const status = await prisma.status.create({
    data: {
      name: data.name,
      description: data.description,
      color: data.color || "#6366f1",
      displayOrder: data.displayOrder ?? 0,
      isDefault,
    },
  });

  return status;
};

// Update status
export const updateStatus = async (id: string, data: Partial<StatusFormData>): Promise<Status> => {
  // Check if status exists
  const existingStatus = await prisma.status.findUnique({
    where: { id },
  });

  if (!existingStatus) {
    throw new Error("Status not found");
  }

  const status = await prisma.status.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      color: data.color,
      displayOrder: data.displayOrder,
    },
  });

  return status;
};

// Delete status
export const deleteStatus = async (id: string): Promise<void> => {
  // Check if status exists
  const existingStatus = await prisma.status.findUnique({
    where: { id },
  });

  if (!existingStatus) {
    throw new Error("Status not found");
  }

  // Check if status is default
  if (existingStatus.isDefault) {
    throw new Error("Cannot delete the default status");
  }

  // Check if status is being used
  const usage = await getStatusUsage(id);
  if (usage.totalUsage > 0) {
    throw new Error(
      `Cannot delete status. It is currently used by ${usage.partners} partners, ` +
      `${usage.goods} goods/services, and ${usage.documents} documents.`
    );
  }

  await prisma.status.delete({
    where: { id },
  });
};

// Get status usage statistics
export const getStatusUsage = async (id: string): Promise<StatusUsage> => {
  const [partnersCount, goodsCount, documentsCount] = await Promise.all([
    prisma.partner.count({
      where: { statusId: id },
    }),
    prisma.goodsAndService.count({
      where: { statusId: id },
    }),
    prisma.document.count({
      where: { statusId: id },
    }),
  ]);

  return {
    partners: partnersCount,
    goods: goodsCount,
    documents: documentsCount,
    totalUsage: partnersCount + goodsCount + documentsCount,
  };
};

// Set a status as default (and remove default from others)
export const setDefaultStatus = async (id: string): Promise<Status> => {
  // Remove default from all statuses
  await prisma.status.updateMany({
    where: { isDefault: true },
    data: { isDefault: false },
  });

  // Set the specified status as default
  const status = await prisma.status.update({
    where: { id },
    data: { isDefault: true },
  });

  return status;
};

// Get the default status
export const getDefaultStatus = async (): Promise<Status | null> => {
  return await prisma.status.findFirst({
    where: { isDefault: true },
  });
};