// src/app/services/goodsService.ts
import prisma from "@/app/utils/prisma";
import { GoodsAndService, Prisma, EntityState } from "@prisma/client";
import { journalService } from "./journalService";
import { ROOT_JOURNAL_ID } from "@/lib/constants";
import { PartnerGoodFilterStatus } from "@/lib/types"; // Use the same filter type

// --- Define the options interface for getAllGoods ---
export interface GetAllGoodsOptions {
  companyId: string;
  where?: Prisma.GoodsAndServiceWhereInput;
  take?: number;
  skip?: number;
  typeCode?: string;

  // --- NEW: Multi-select filtering ---
  filterStatuses?: PartnerGoodFilterStatus[]; // Use an array
  contextJournalIds?: string[]; // For 'affected'
  currentUserId?: string; // For 'inProcess' and 'unaffected'
  restrictedJournalId?: string | null; // For role-based logic
}

export type CreateGoodsData = {
  // ... (type remains the same)
  companyId: string;
  createdById: string;
  label: string;
  referenceCode?: string | null;
  barcode?: string | null;
  taxCodeId?: number | null;
  typeCode?: string | null;
  description?: string | null;
  unitCodeId?: number | null;
  stockTrackingMethod?: string | null;
  packagingTypeCode?: string | null;
  photoUrl?: string | null;
  additionalDetails?: any;
};

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

    const {
      companyId,
      createdById,
      ...restOfData // a an object with label, referenceCode, etc.
    } = data;

    const newGood = await prisma.goodsAndService.create({
      data: {
        ...restOfData,
        company: {
          connect: { id: companyId }, // Connect to the Company via its ID
        },
        createdBy: {
          connect: { id: createdById }, // Connect to the User who created it
        },
        // The audit fields in your schema default to PENDING and ACTIVE, so you don't need to set them explicitly here
        // unless you want to override the default.
      },
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
  async getAllGoods(
    options: GetAllGoodsOptions
  ): Promise<{ goods: GoodsAndService[]; totalCount: number }> {
    console.log(
      "Chef (GoodsService): Fetching items with MULTI-SELECT RULES:",
      options
    );

    const {
      companyId,
      filterStatuses = [], // Default to empty array
      contextJournalIds = [],
      currentUserId,
      restrictedJournalId,
      where: externalWhere,
      typeCode,
      ...restOfOptions
    } = options;

    if (filterStatuses.length > 0 && !currentUserId) {
      console.warn(
        `Chef (GoodsService): Filters require a currentUserId, but none was provided. Returning empty.`
      );
      return { goods: [], totalCount: 0 };
    }

    let prismaWhere: Prisma.GoodsAndServiceWhereInput = {
      companyId: companyId,
      entityState: EntityState.ACTIVE,
      ...(typeCode && { typeCode: typeCode }),
      ...externalWhere,
    };

    const isRootUser =
      !restrictedJournalId || restrictedJournalId === ROOT_JOURNAL_ID;

    // --- NEW: Multi-filter logic ---
    if (filterStatuses.length > 0) {
      const orConditions: Prisma.GoodsAndServiceWhereInput[] = [];
      const descendantIds =
        !isRootUser && filterStatuses.includes("unaffected")
          ? await journalService.getDescendantJournalIds(
              restrictedJournalId!,
              companyId
            )
          : [];

      for (const status of filterStatuses) {
        switch (status) {
          case "affected":
            if (contextJournalIds.length > 0) {
              orConditions.push({
                journalGoodLinks: {
                  some: { journalId: { in: contextJournalIds } },
                },
              });
            }
            break;

          case "unaffected":
            if (isRootUser) {
              orConditions.push({
                AND: [
                  { journalGoodLinks: { none: {} } },
                  { createdById: { not: currentUserId } },
                ],
              });
            } else {
              orConditions.push({
                AND: [
                  {
                    journalGoodLinks: {
                      some: { journalId: restrictedJournalId! },
                    },
                  },
                  ...(descendantIds.length > 0
                    ? [
                        {
                          NOT: {
                            journalGoodLinks: {
                              some: { journalId: { in: descendantIds } },
                            },
                          },
                        },
                      ]
                    : []),
                ],
              });
            }
            break;

          case "inProcess":
            if (isRootUser) {
              orConditions.push({
                AND: [
                  { journalGoodLinks: { none: {} } },
                  { createdById: currentUserId },
                ],
              });
            } else {
              orConditions.push({
                AND: [
                  {
                    journalGoodLinks: {
                      none: { journalId: restrictedJournalId! },
                    },
                  },
                  { createdById: currentUserId },
                ],
              });
            }
            break;
        }
      }

      if (orConditions.length > 0) {
        prismaWhere.OR = orConditions;
      } else {
        return { goods: [], totalCount: 0 };
      }
    }

    console.log(
      "Chef (GoodsService): Final prismaWhere clause:",
      JSON.stringify(prismaWhere, null, 2)
    );

    const totalCount = await prisma.goodsAndService.count({
      where: prismaWhere,
    });
    const goods = await prisma.goodsAndService.findMany({
      where: prismaWhere,
      take: restOfOptions.take,
      skip: restOfOptions.skip,
      orderBy: { label: "asc" },
      include: { taxCode: true, unitOfMeasure: true },
    });

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
