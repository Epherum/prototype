// File: src/app/services/journalPartnerGoodLinkService.ts
import prisma from "@/app/utils/prisma";
import {
  JournalPartnerGoodLink,
  GoodsAndService,
  JournalPartnerLink as PrismaJPL,
} from "@prisma/client";

import { z } from "zod";

export type CreateJPGLData = {
  journalPartnerLinkId: bigint;
  goodId: bigint;
  descriptiveText?: string | null;
  contextualTaxCodeId?: number | null;
};

// --- Zod Schemas for Validation ---
// Schema for the actual JPGL creation (once JPL ID is known)
const CreateRawJPGLSchema = z.object({
  journalPartnerLinkId: z.bigint(),
  goodId: z.bigint(),
  descriptiveText: z.string().optional().nullable(),
  contextualTaxCodeId: z.number().int().positive().optional().nullable(),
});
export type CreateRawJPGLData = z.infer<typeof CreateRawJPGLSchema>;

export const OrchestratedCreateJPGLSchema = z.object({
  journalId: z.string().min(1, "Journal ID is required"),
  partnerId: z.bigint().positive("Partner ID must be a positive number"),
  goodId: z.bigint().positive("Good ID must be a positive number"),
  partnershipType: z.string().optional().default("STANDARD_TRANSACTION"), // Important: Define this default or make it required
  descriptiveText: z.string().optional().nullable(),
  contextualTaxCodeId: z.number().int().positive().optional().nullable(),
});
export type OrchestratedCreateJPGLData = z.infer<
  typeof OrchestratedCreateJPGLSchema
>;

const jpgLinkService = {
  async createFullJpgLink(
    data: OrchestratedCreateJPGLData
  ): Promise<JournalPartnerGoodLink> {
    const {
      journalId,
      partnerId,
      goodId,
      partnershipType, // This is crucial for finding/creating the correct JPL
      descriptiveText,
      contextualTaxCodeId,
    } = OrchestratedCreateJPGLSchema.parse(data);

    console.log(
      `Chef (JPGLService): Orchestrating 3-way link for J:'${journalId}', P:'${partnerId}', G:'${goodId}', JPL Type:'${partnershipType}'.`
    );

    // Step 1: Find or Create the JournalPartnerLink
    let journalPartnerLink = await prisma.journalPartnerLink.findUnique({
      where: {
        // Use the Prisma-generated compound key name
        journalId_partnerId_partnershipType: {
          journalId: journalId,
          partnerId: partnerId,
          partnershipType: partnershipType,
        },
      },
    });

    if (!journalPartnerLink) {
      console.log(` -> JournalPartnerLink not found. Creating new one...`);
      try {
        journalPartnerLink = await prisma.journalPartnerLink.create({
          data: {
            journalId: journalId,
            partnerId: partnerId,
            partnershipType: partnershipType,
            // Add other default fields for JournalPartnerLink if necessary (e.g., exoneration, periodType)
            // exoneration: false, // Example
          },
        });
        console.log(
          ` -> Created JournalPartnerLink with ID: ${journalPartnerLink.id}`
        );
      } catch (error: any) {
        if (error.code === "P2002") {
          // Check if 'error' is defined and has 'code'
          console.warn(
            " -> P2002 during JPL creation, attempting to re-fetch."
          );
          journalPartnerLink = await prisma.journalPartnerLink.findUnique({
            where: {
              // Use the Prisma-generated compound key name here as well
              journalId_partnerId_partnershipType: {
                journalId,
                partnerId,
                partnershipType,
              },
            },
          });
          if (!journalPartnerLink) {
            console.error(" -> Failed to create or find JPL even after P2002.");
            throw new Error(
              "Failed to establish intermediate Journal-Partner link after race condition."
            );
          }
        } else {
          console.error(" -> Error creating JournalPartnerLink:", error);
          throw error;
        }
      }
    } else {
      console.log(
        ` -> Found existing JournalPartnerLink with ID: ${journalPartnerLink.id}`
      );
    }

    // Step 2: Create the JournalPartnerGoodLink (using the 'raw' creation logic)
    const rawJpglData: CreateRawJPGLData = {
      journalPartnerLinkId: journalPartnerLink.id,
      goodId: goodId,
      descriptiveText: descriptiveText,
      contextualTaxCodeId: contextualTaxCodeId,
    };

    // Validation for good and tax code (optional here if you trust the inputs, but good for safety)
    const goodExists = await prisma.goodsAndService.findUnique({
      where: { id: rawJpglData.goodId },
    });
    if (!goodExists)
      throw new Error(
        `Good/Service with ID '${rawJpglData.goodId}' not found.`
      );
    if (rawJpglData.contextualTaxCodeId) {
      const taxCodeExists = await prisma.taxCode.findUnique({
        where: { id: rawJpglData.contextualTaxCodeId },
      });
      if (!taxCodeExists)
        throw new Error(
          `Contextual Tax Code with ID '${rawJpglData.contextualTaxCodeId}' not found.`
        );
    }

    const newLink = await prisma.journalPartnerGoodLink.create({
      data: rawJpglData, // Prisma's @@unique constraint will handle duplicates.
      include: {
        // Good to include relations in the returned object
        journalPartnerLink: { include: { journal: true, partner: true } },
        good: { include: { taxCode: true, unitOfMeasure: true } },
        contextualTaxCode: true,
      },
    });
    console.log(` -> JournalPartnerGoodLink created with ID '${newLink.id}'.`);
    return newLink;
  },

  async getJpglsForGoodAndJournalContext(
    goodIdParam: bigint,
    journalIdParam: string
    // Optional: If you need to filter by the type of JournalPartnerLink involved
    // partnershipTypeParam?: string
  ): Promise<JournalPartnerGoodLink[]> {
    // Prisma type directly from service
    console.log(
      `Chef (JPGLService): Getting JPGLs for GoodID:'${goodIdParam}', JournalID:'${journalIdParam}'.`
    );
    return prisma.journalPartnerGoodLink.findMany({
      where: {
        goodId: goodIdParam,
        journalPartnerLink: {
          journalId: journalIdParam,
          // ...(partnershipTypeParam && { partnershipType: partnershipTypeParam }),
        },
      },
      include: {
        // Include what's needed for display in the modal
        good: true, // Though good is already known contextually
        journalPartnerLink: {
          include: {
            partner: true, // Essential for display
            journal: true, // Context
          },
        },
        contextualTaxCode: true,
      },
      orderBy: {
        journalPartnerLink: { partner: { name: "asc" } }, // Example ordering
      },
    });
  },

  // Abbreviating for 'JournalPartnerGoodLinkService'
  // RECIPE 1: Create a new three-way link
  async createLink(data: CreateJPGLData): Promise<JournalPartnerGoodLink> {
    console.log(
      `Chef (JPGLService): Linking JPL ID '${data.journalPartnerLinkId}' with Good ID '${data.goodId}'.`
    );

    // Validation: Check if JournalPartnerLink exists
    const jplExists = await prisma.journalPartnerLink.findUnique({
      where: { id: data.journalPartnerLinkId },
    });
    if (!jplExists) {
      throw new Error(
        `JournalPartnerLink with ID '${data.journalPartnerLinkId}' not found.`
      );
    }

    // Validation: Check if Good/Service exists
    const goodExists = await prisma.goodsAndService.findUnique({
      where: { id: data.goodId },
    });
    if (!goodExists) {
      throw new Error(`Good/Service with ID '${data.goodId}' not found.`);
    }

    // Validation: Check if contextualTaxCodeId exists (if provided)
    if (data.contextualTaxCodeId) {
      const taxCodeExists = await prisma.taxCode.findUnique({
        where: { id: data.contextualTaxCodeId },
      });
      if (!taxCodeExists) {
        throw new Error(
          `Contextual Tax Code with ID '${data.contextualTaxCodeId}' not found.`
        );
      }
    }

    // Prisma's @@unique([journalPartnerLinkId, goodId]) constraint will handle duplicates.
    const newLink = await prisma.journalPartnerGoodLink.create({
      data: data,
    });
    console.log(
      `Chef (JPGLService): 3-way link created with ID '${newLink.id}'.`
    );
    return newLink;
  },

  // RECIPE 2: Get a specific 3-way link by its ID
  async getLinkById(id: bigint): Promise<JournalPartnerGoodLink | null> {
    return prisma.journalPartnerGoodLink.findUnique({
      where: { id },
      include: {
        journalPartnerLink: { include: { journal: true, partner: true } }, // Deep include
        good: { include: { taxCode: true, unitOfMeasure: true } },
        contextualTaxCode: true,
      },
    });
  },

  // RECIPE 3: Delete a 3-way link by its ID
  async deleteLinkById(id: bigint): Promise<JournalPartnerGoodLink | null> {
    console.log(`Chef (JPGLService): Deleting 3-way link with ID '${id}'.`);
    try {
      return await prisma.journalPartnerGoodLink.delete({
        where: { id },
      });
    } catch (error) {
      console.warn(
        `Chef (JPGLService): 3-way Link ID '${id}' not found for deletion.`,
        error
      );
      return null;
    }
  },

  // RECIPE 4: Get all Goods linked to a specific JournalPartnerLink
  async getGoodsForJournalPartnerLink(
    journalPartnerLinkId: bigint
  ): Promise<GoodsAndService[]> {
    const links = await prisma.journalPartnerGoodLink.findMany({
      where: { journalPartnerLinkId },
      select: { goodId: true }, // Select only goodId to then fetch distinct goods
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

  // RECIPE 5: Get all JournalPartnerLinks associated with a specific Good
  async getJournalPartnerLinksForGood(goodId: bigint): Promise<PrismaJPL[]> {
    const links = await prisma.journalPartnerGoodLink.findMany({
      where: { goodId },
      select: { journalPartnerLinkId: true },
      distinct: ["journalPartnerLinkId"],
    });

    if (links.length === 0) return [];
    const jplIds = links.map((link) => link.journalPartnerLinkId);

    return prisma.journalPartnerLink.findMany({
      where: { id: { in: jplIds } },
      include: { journal: true, partner: true }, // Include details
      // Add ordering if needed
    });
  },

  // RECIPE 6: Get all JournalPartnerGoodLink details for a specific JournalPartnerLink
  async getFullLinksForJPL(
    journalPartnerLinkId: bigint
  ): Promise<JournalPartnerGoodLink[]> {
    return prisma.journalPartnerGoodLink.findMany({
      where: { journalPartnerLinkId },
      include: {
        good: { include: { taxCode: true, unitOfMeasure: true } },
        contextualTaxCode: true,
      },
      orderBy: { good: { label: "asc" } },
    });
  },

  // RECIPE 7: The Core Filtering Logic - Get Goods based on Journal (and its children) AND a specific Partner
  async getGoodsForJournalAndPartner(
    journalId: string, // The selected Journal in UI
    partnerId: bigint, // The selected Partner in UI
    includeJournalChildren: boolean = true
  ): Promise<GoodsAndService[]> {
    console.log(
      `Chef (JPGLService): Getting goods for Journal '${journalId}' (children: ${includeJournalChildren}) AND Partner ID '${partnerId}'.`
    );
    let targetJournalIds = [journalId];

    if (includeJournalChildren) {
      const descendantJournals = await prisma.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE "JournalDescendants" AS (
          SELECT id FROM "journals" WHERE id = ${journalId}
          UNION ALL
          SELECT j.id FROM "journals" j INNER JOIN "JournalDescendants" jd ON j.parent_id = jd.id
        )
        SELECT id FROM "JournalDescendants";
      `;
      targetJournalIds = descendantJournals.map((j) => j.id);
    }
    if (targetJournalIds.length === 0) return [];

    // Find all JournalPartnerLink.id's that match the journal(s) and the specific partner
    const relevantJPLs = await prisma.journalPartnerLink.findMany({
      where: {
        journalId: { in: targetJournalIds },
        partnerId: partnerId,
      },
      select: { id: true }, // We only need the IDs of these JournalPartnerLinks
    });

    if (relevantJPLs.length === 0) {
      console.log(
        `Chef (JPGLService): No JournalPartnerLinks found for Journal(s) '${targetJournalIds.join(
          ","
        )}' and Partner ID '${partnerId}'.`
      );
      return []; // No relevant J-P links, so no goods can be associated
    }

    const relevantJPLIds = relevantJPLs.map((jpl) => jpl.id);

    // Now find all goods linked to these specific JournalPartnerLink IDs
    const goodLinks = await prisma.journalPartnerGoodLink.findMany({
      where: {
        journalPartnerLinkId: { in: relevantJPLIds },
      },
      select: { goodId: true },
      distinct: ["goodId"],
    });

    if (goodLinks.length === 0) return [];
    const goodIds = goodLinks.map((link) => link.goodId);

    return prisma.goodsAndService.findMany({
      where: { id: { in: goodIds } },
      orderBy: { label: "asc" },
      include: { taxCode: true, unitOfMeasure: true },
    });
  },

  // RECIPE 7: The Core Filtering Logic - Get Goods based on Journal(s) (and their children) AND a specific Partner
  // MODIFIED to accept an array of journal IDs
  async getGoodsForJournalsAndPartner(
    // Renamed
    journalIds: string[], // The selected Journal IDs in UI
    partnerId: bigint, // The selected Partner in UI
    includeJournalChildren: boolean = true
  ): Promise<GoodsAndService[]> {
    console.log(
      `Chef (JPGLService): Getting goods for Journals '${journalIds.join(
        ","
      )}' (children: ${includeJournalChildren}) AND Partner ID '${partnerId}'.`
    );

    if (!journalIds || journalIds.length === 0) return [];

    let targetJournalIds: string[] = [...journalIds];

    if (includeJournalChildren) {
      const allDescendantIds = new Set<string>(targetJournalIds);
      for (const initialJournalId of journalIds) {
        // Iterate over initially provided journalIds
        const descendantJournals = await prisma.$queryRaw<
          Array<{ id: string }>
        >`
          WITH RECURSIVE "JournalDescendants" AS (
            SELECT id FROM "journals" WHERE id = ${initialJournalId}
            UNION ALL
            SELECT j.id FROM "journals" j INNER JOIN "JournalDescendants" jd ON j.parent_id = jd.id
          )
          SELECT id FROM "JournalDescendants";
        `;
        descendantJournals.forEach((j) => allDescendantIds.add(j.id));
      }
      targetJournalIds = Array.from(allDescendantIds);
    }

    if (targetJournalIds.length === 0) return [];

    const relevantJPLs = await prisma.journalPartnerLink.findMany({
      where: {
        journalId: { in: targetJournalIds }, // Use the expanded list of journal IDs
        partnerId: partnerId,
      },
      select: { id: true },
    });

    if (relevantJPLs.length === 0) {
      console.log(
        `Chef (JPGLService): No JournalPartnerLinks found for Journal(s) '${targetJournalIds.join(
          ","
        )}' and Partner ID '${partnerId}'.`
      );
      return []; // No relevant J-P links, so no goods can be associated
    }

    const relevantJPLIds = relevantJPLs.map((jpl) => jpl.id);

    const goodLinks = await prisma.journalPartnerGoodLink.findMany({
      where: { journalPartnerLinkId: { in: relevantJPLIds } },
      select: { goodId: true },
      distinct: ["goodId"],
    });

    if (goodLinks.length === 0) return [];
    const goodIds = goodLinks.map((link) => link.goodId);

    return prisma.goodsAndService.findMany({
      where: { id: { in: goodIds } },
      orderBy: { label: "asc" },
      include: { taxCode: true, unitOfMeasure: true },
    });
  },

  // RECIPE 8: Get all partner IDs for a specific Good
  async getPartnerIdsForGood(goodId: bigint): Promise<bigint[]> {
    console.log(
      `Chef (JPGLService): Getting partner IDs for Good ID '${goodId}'.`
    );
    const links = await prisma.journalPartnerGoodLink.findMany({
      where: { goodId },
      select: {
        journalPartnerLink: {
          // Navigate to the JournalPartnerLink
          select: {
            partnerId: true, // Select the partnerId from it
          },
        },
      },
    });

    if (links.length === 0) return [];

    // Extract distinct partner IDs
    const partnerIds = [
      ...new Set(links.map((link) => link.journalPartnerLink.partnerId)),
    ];
    return partnerIds as bigint[];
  },

  // RECIPE 9: Get all good IDs for a specific Partner
  async getGoodIdsForPartner(partnerId: bigint): Promise<bigint[]> {
    console.log(
      `Chef (JPGLService): Getting good IDs for Partner ID '${partnerId}'.`
    );

    // Find JournalPartnerLinks for the given partner
    const jpls = await prisma.journalPartnerLink.findMany({
      where: { partnerId },
      select: { id: true }, // We only need the IDs of these JournalPartnerLinks
    });

    if (jpls.length === 0) return [];
    const jplIds = jpls.map((jpl) => jpl.id);

    // Find JournalPartnerGoodLinks that use these JournalPartnerLink IDs
    const links = await prisma.journalPartnerGoodLink.findMany({
      where: { journalPartnerLinkId: { in: jplIds } },
      select: { goodId: true },
    });

    if (links.length === 0) return [];
    const goodIds = [...new Set(links.map((link) => link.goodId))];
    return goodIds as bigint[];
  },

  // Recipe 10: Get all partner IDs for a specific Journal and Good
  // MODIFIED to accept an array of journal IDs
  async getPartnerIdsForJournalsAndGood(
    // Renamed
    journalIds: string[], // Changed from single journalId
    goodId: bigint,
    includeJournalChildren: boolean = true
  ): Promise<bigint[]> {
    console.log(
      `Chef (JPGLService): Getting partners for Journals '${journalIds.join(
        ","
      )}' (children: ${includeJournalChildren}) AND Good ID '${goodId}'.`
    );

    if (!journalIds || journalIds.length === 0) {
      console.log(
        "Chef (JPGLService): No journal IDs provided for getPartnerIdsForJournalsAndGood."
      );
      return [];
    }

    let targetJournalIds: string[] = [...journalIds];
    if (includeJournalChildren) {
      const allDescendantIds = new Set<string>(targetJournalIds);
      for (const initialJournalId of journalIds) {
        const descendantJournals = await prisma.$queryRaw<
          Array<{ id: string }>
        >`
          WITH RECURSIVE "JournalDescendants" AS (
            SELECT id FROM "journals" WHERE id = ${initialJournalId}
            UNION ALL
            SELECT j.id FROM "journals" j INNER JOIN "JournalDescendants" jd ON j.parent_id = jd.id
          )
          SELECT id FROM "JournalDescendants";
        `;
        descendantJournals.forEach((j) => allDescendantIds.add(j.id));
      }
      targetJournalIds = Array.from(allDescendantIds);
    }

    if (targetJournalIds.length === 0) {
      console.log(
        "Chef (JPGLService): No target journal IDs after processing children for getPartnerIdsForJournalsAndGood."
      );
      return [];
    }

    const links = await prisma.journalPartnerGoodLink.findMany({
      where: {
        goodId: goodId,
        journalPartnerLink: {
          journalId: { in: targetJournalIds },
        },
      },
      select: {
        journalPartnerLink: {
          select: {
            partnerId: true,
          },
        },
      },
    });

    if (links.length === 0) return [];
    const partnerIds = [
      ...new Set(links.map((link) => link.journalPartnerLink.partnerId)),
    ];
    console.log(
      `Chef (JPGLService): Found partner IDs [${partnerIds.join(
        ","
      )}] for Journals [${targetJournalIds.join(",")}] and Good ID ${goodId}`
    );
    return partnerIds as bigint[]; // Assuming partnerId is always BigInt
  },

  // Keep the old one for compatibility or refactor its usages
  async getPartnerIdsForJournalAndGood(
    journalId: string,
    goodId: bigint,
    includeJournalChildren: boolean = true
  ): Promise<bigint[]> {
    return this.getPartnerIdsForJournalsAndGood(
      [journalId],
      goodId,
      includeJournalChildren
    );
  },

  // RECIPE 11: Get all journal IDs for a specific Partner and Good
  async getJournalIdsForPartnerAndGood(
    partnerId: bigint,
    goodId: bigint
  ): Promise<string[]> {
    console.log(
      `Chef (JPGLService): Getting journals for Partner ID '${partnerId}' AND Good ID '${goodId}'.`
    );

    // Find JournalPartnerLinks for the given partner
    const jpls = await prisma.journalPartnerLink.findMany({
      where: { partnerId },
      select: { id: true },
    });
    if (jpls.length === 0) return [];
    const jplIds = jpls.map((jpl) => jpl.id);

    // Find JournalPartnerGoodLinks that use these JPL IDs AND the specified goodId
    const threeWayLinks = await prisma.journalPartnerGoodLink.findMany({
      where: {
        goodId: goodId,
        journalPartnerLinkId: { in: jplIds },
      },
      select: {
        journalPartnerLink: {
          // Go back to JPL to get the journalId
          select: {
            journalId: true,
          },
        },
      },
    });

    if (threeWayLinks.length === 0) return [];
    const journalIds = [
      ...new Set(
        threeWayLinks.map((link) => link.journalPartnerLink.journalId)
      ),
    ];
    return journalIds as string[];
  },
};

export default jpgLinkService;
