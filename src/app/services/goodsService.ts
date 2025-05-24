// File: src/app/services/goodsService.ts
import prisma from "@/app/utils/prisma"; // Storeroom Manager
import { GoodsAndService, TaxCode, UnitOfMeasure } from "@prisma/client"; // Model types

// --- Types for "Order Slips" (Data Transfer Objects) for Goods & Services ---

export type CreateGoodsData = {
  label: string;
  referenceCode?: string | null;
  barcode?: string | null;
  taxCodeId?: number | null; // Foreign Key to TaxCode
  typeCode?: string | null;
  description?: string | null;
  unitCodeId?: number | null; // Foreign Key to UnitOfMeasure
  stockTrackingMethod?: string | null;
  packagingTypeCode?: string | null;
  photoUrl?: string | null;
  additionalDetails?: any; // Or a more specific Zod schema
};

// For updates, most fields are optional. We might not allow changing referenceCode easily.
export type UpdateGoodsData = Partial<
  Omit<CreateGoodsData, "referenceCode" | "barcode">
>;

// --- Chef's Recipes for Goods & Services ---

const goodsService = {
  // RECIPE 1: Add a new Good/Service to the "Catalog"
  async createGood(data: CreateGoodsData): Promise<GoodsAndService> {
    console.log("Chef (GoodsService): Adding new item to catalog:", data.label);

    // Optional: Check if taxCodeId exists (if provided)
    if (data.taxCodeId) {
      const taxCodeExists = await prisma.taxCode.findUnique({
        where: { id: data.taxCodeId },
      });
      if (!taxCodeExists) {
        throw new Error(`Tax Code with ID ${data.taxCodeId} not found.`);
      }
    }
    // Optional: Check if unitCodeId exists (if provided)
    if (data.unitCodeId) {
      const unitExists = await prisma.unitOfMeasure.findUnique({
        where: { id: data.unitCodeId },
      });
      if (!unitExists) {
        throw new Error(
          `Unit of Measure with ID ${data.unitCodeId} not found.`
        );
      }
    }
    // Optional: Check for unique referenceCode or barcode if your business rules require it
    // (Prisma schema already enforces this with @unique)

    const newGood = await prisma.goodsAndService.create({
      data: data,
    });
    console.log(
      "Chef (GoodsService): Item",
      newGood.label,
      "added with ID:",
      newGood.id
    );
    return newGood;
  },

  // RECIPE 2: Get a specific Good/Service by its ID
  async getGoodById(id: bigint): Promise<GoodsAndService | null> {
    console.log("Chef (GoodsService): Looking up item with ID:", id);
    const good = await prisma.goodsAndService.findUnique({
      where: { id },
      include: {
        taxCode: true, // Include related tax code details
        unitOfMeasure: true, // Include related unit of measure details
      },
    });
    if (good) {
      console.log("Chef (GoodsService): Found item:", good.label);
    } else {
      console.log("Chef (GoodsService): Item with ID:", id, "not found.");
    }
    return good;
  },

  // RECIPE 3: Get all Goods/Services (e.g., for a product list)
  async getAllGoods(options?: {
    typeCode?: string;
    where?: any;
    take?: number; // For pagination limit
    skip?: number; // For pagination offset
  }): Promise<{ goods: GoodsAndService[]; totalCount: number }> {
    // MODIFIED return type
    console.log(
      "Chef (GoodsService): Fetching items from catalog with options:",
      options
    );
    const whereClause: any = { ...options?.where }; // Start with a copy of provided where
    if (options?.typeCode) {
      whereClause.typeCode = options.typeCode;
    }

    // Get total count *with all filters applied* but *before pagination*
    const totalCount = await prisma.goodsAndService.count({
      where: whereClause,
    });

    const goods = await prisma.goodsAndService.findMany({
      where: whereClause,
      take: options?.take,
      skip: options?.skip,
      orderBy: { label: "asc" },
      include: {
        taxCode: true,
        unitOfMeasure: true,
      },
    });
    console.log(
      `Chef (GoodsService): Fetched ${goods.length} items. Total matching query: ${totalCount}.`
    );
    return { goods, totalCount };
  },

  // RECIPE 4: Update an existing Good/Service's details
  async updateGood(
    id: bigint,
    data: UpdateGoodsData
  ): Promise<GoodsAndService | null> {
    console.log(
      "Chef (GoodsService): Updating details for item ID:",
      id,
      "with data:",
      data
    );

    // Optional: Check if taxCodeId exists if it's being updated
    if (data.taxCodeId !== undefined) {
      // Check explicitly for undefined to allow setting to null
      if (data.taxCodeId !== null) {
        const taxCodeExists = await prisma.taxCode.findUnique({
          where: { id: data.taxCodeId },
        });
        if (!taxCodeExists) {
          throw new Error(
            `Tax Code with ID ${data.taxCodeId} not found for update.`
          );
        }
      }
    }
    // Optional: Check if unitCodeId exists if it's being updated
    if (data.unitCodeId !== undefined) {
      if (data.unitCodeId !== null) {
        const unitExists = await prisma.unitOfMeasure.findUnique({
          where: { id: data.unitCodeId },
        });
        if (!unitExists) {
          throw new Error(
            `Unit of Measure with ID ${data.unitCodeId} not found for update.`
          );
        }
      }
    }

    try {
      const updatedGood = await prisma.goodsAndService.update({
        where: { id },
        data: data,
      });
      console.log(
        "Chef (GoodsService): Item",
        updatedGood.label,
        "updated successfully."
      );
      return updatedGood;
    } catch (error) {
      // Prisma throws P2025 if record to update is not found
      console.warn(
        "Chef (GoodsService): Could not update item ID:",
        id,
        ". It might not exist.",
        error
      );
      return null;
    }
  },

  // RECIPE 5: Remove a Good/Service from the "Catalog"
  async deleteGood(id: bigint): Promise<GoodsAndService | null> {
    console.log("Chef (GoodsService): Removing item with ID:", id);
    try {
      // Check schema: journalGoodLinks and journalPartnerGoodLinks use onDelete: Cascade.
      // This means deleting a Good/Service will also delete its links.
      // If this is not desired, change to Restrict and add checks here.
      const deletedGood = await prisma.goodsAndService.delete({
        where: { id },
      });
      console.log(
        "Chef (GoodsService): Item",
        deletedGood.label,
        "removed successfully."
      );
      return deletedGood;
    } catch (error) {
      // Prisma throws P2025 if record to delete is not found
      console.warn(
        "Chef (GoodsService): Could not delete item ID:",
        id,
        ". It might not exist.",
        error
      );
      return null;
    }
  },
};

export default goodsService;
