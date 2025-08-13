// src/app/services/partnerService.ts

import prisma from "@/app/utils/prisma";
import { Partner, Prisma, EntityState, ApprovalStatus } from "@prisma/client";
import { journalService } from "./journalService";
import {
  GetAllItemsOptions,
  IntersectionFindOptions,
} from "@/lib/types/serviceOptions";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import {
  CreatePartnerPayload,
  UpdatePartnerPayload,
} from "@/lib/schemas/partner.schema";

const partnerService = {
  // ✅ CHANGED: The function signature now uses the Zod-inferred type.
  async createPartner(
    data: CreatePartnerPayload,
    createdById: string
  ): Promise<Partner> {
    console.log("partnerService.createPartner: Input", { data, createdById });
    const newPartner = await prisma.partner.create({
      data: {
        ...data,
        createdById: createdById,
        entityState: EntityState.ACTIVE,
        approvalStatus: ApprovalStatus.PENDING,
      },
    });
    console.log("partnerService.createPartner: Output", newPartner);
    return newPartner;
  },

  async getPartnerById(id: bigint): Promise<Partner | null> {
    console.log("partnerService.getPartnerById: Input", { id });
    const partner = await prisma.partner.findUnique({ where: { id } });
    console.log("partnerService.getPartnerById: Output", partner);
    return partner;
  },

  async getAllPartners(
    options: GetAllItemsOptions<Prisma.PartnerWhereInput>
  ): Promise<{ data: Partner[]; totalCount: number }> {
    console.log(
      "partnerService.getAllPartners: Input",
      JSON.stringify(options, jsonBigIntReplacer)
    );
    const {
      take,
      skip,
      restrictedJournalId,
      filterMode,
      permissionRootId,
      selectedJournalIds = [],
      where: externalWhere,
    } = options;
    let prismaWhere: Prisma.PartnerWhereInput = {
      entityState: EntityState.ACTIVE,
      ...externalWhere,
    };
    if (filterMode) {
      if (selectedJournalIds.length === 0) {
        console.warn(
          "partnerService.getAllPartners: 'filterMode' was provided without 'selectedJournalIds'. Returning empty."
        );
        return { data: [], totalCount: 0 };
      }
      const lastJournalId = selectedJournalIds[selectedJournalIds.length - 1];
      switch (filterMode) {
        case "affected":
          prismaWhere.journalPartnerLinks = {
            some: { journalId: lastJournalId },
          };
          break;
        case "unaffected":
          if (!permissionRootId) {
            console.warn(
              "partnerService.getAllPartners: 'unaffected' filter requires 'permissionRootId'. Returning empty."
            );
            return { data: [], totalCount: 0 };
          }
          const affectedLinks = await prisma.journalPartnerLink.findMany({
            where: { journalId: lastJournalId },
            select: { partnerId: true },
          });
          const affectedPartnerIds = affectedLinks.map((p) => p.partnerId);
          const descendantIds = await journalService.getDescendantJournalIds(
            permissionRootId
          );
          prismaWhere.AND = [
            {
              journalPartnerLinks: {
                some: {
                  journalId: { in: [...descendantIds, permissionRootId] },
                },
              },
            },
            {
              id: { notIn: affectedPartnerIds },
            },
          ];
          break;
        case "inProcess":
          prismaWhere.AND = [
            { approvalStatus: "PENDING" },
            {
              journalPartnerLinks: {
                some: { journalId: { in: selectedJournalIds } },
              },
            },
          ];
          break;
      }
    } else if (restrictedJournalId) {
      const descendantIds = await journalService.getDescendantJournalIds(
        restrictedJournalId
      );
      prismaWhere.journalPartnerLinks = {
        some: { journalId: { in: [...descendantIds, restrictedJournalId] } },
      };
    }
    const totalCount = await prisma.partner.count({ where: prismaWhere });
    const data = await prisma.partner.findMany({
      where: prismaWhere,
      take,
      skip,
      orderBy: { name: "asc" },
    });
    console.log("partnerService.getAllPartners: Output", {
      count: data.length,
      totalCount,
    });
    return { data, totalCount };
  },

  async findPartnersForGoods(
    options: IntersectionFindOptions
  ): Promise<{ data: Partner[]; totalCount: number }> {
    console.log(
      "partnerService.findPartnersForGoods: Input",
      JSON.stringify(options, jsonBigIntReplacer)
    );
    const { goodIds, journalIds } = options;
    if (!goodIds || goodIds.length === 0) {
      return { data: [], totalCount: 0 };
    }
    const uniqueGoodIds = [...new Set(goodIds)];
    const journalFilterClause =
      journalIds && journalIds.length > 0
        ? Prisma.sql`AND jpl."journal_id" IN (${Prisma.join(journalIds)})`
        : Prisma.empty;
    const intersectingPartnerRows = await prisma.$queryRaw<
      Array<{ partner_id: bigint }>
    >`
      SELECT
        jpl."partner_id"
      FROM "journal_partner_good_links" AS jpgl
      INNER JOIN "journal_partner_links" AS jpl ON jpgl."journal_partner_link_id" = jpl."id"
      WHERE
        jpgl."good_id" IN (${Prisma.join(uniqueGoodIds)})
        ${journalFilterClause}
      GROUP BY
        jpl."partner_id"
      HAVING
        COUNT(DISTINCT jpgl."good_id") = ${uniqueGoodIds.length};
    `;
    const intersectingPartnerIds = intersectingPartnerRows.map(
      (row) => row.partner_id
    );
    if (intersectingPartnerIds.length === 0) {
      return { data: [], totalCount: 0 };
    }
    const data = await prisma.partner.findMany({
      where: {
        id: { in: intersectingPartnerIds },
        entityState: "ACTIVE",
      },
      orderBy: { name: "asc" },
    });
    console.log("partnerService.findPartnersForGoods: Output", {
      count: data.length,
    });
    return { data, totalCount: data.length };
  },

  // ✅ CHANGED: The function signature now uses the Zod-inferred type.
  async updatePartner(
    id: bigint,
    data: UpdatePartnerPayload
  ): Promise<Partner | null> {
    console.log("partnerService.updatePartner: Input", { id, data });
    // Note: The `updatePartnerSchema` on the client side now correctly matches the fields
    // from `createPartnerSchema`, so a simple spread is safe.
    const updatedPartner = await prisma.partner.update({ where: { id }, data });
    console.log("partnerService.updatePartner: Output", updatedPartner);
    return updatedPartner;
  },

  async deletePartner(id: bigint): Promise<Partner | null> {
    console.log("partnerService.deletePartner: Input", { id });
    const deletedPartner = await prisma.partner.delete({ where: { id } });
    console.log("partnerService.deletePartner: Output", deletedPartner);
    return deletedPartner;
  },
};

export default partnerService;
