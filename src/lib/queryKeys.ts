// src/lib/queryKeys.ts

import type { FetchPartnersParams, FetchGoodsParams } from "@/lib/types";

export const journalKeys = {
  all: ["journalHierarchy"] as const,
  hierarchy: (restrictedId: string | null | undefined) =>
    [...journalKeys.all, restrictedId] as const,
  flatListByPartner: (partnerId: string | null) =>
    ["flatJournalsFilteredByPartner", partnerId] as const,
  flatListByGood: (goodId: string | null) =>
    ["flatJournalsFilteredByGood", goodId] as const,
};

export const partnerKeys = {
  all: ["partners"] as const,
  lists: () => [...partnerKeys.all, "list"] as const, // For consistency, let's add this level
  list: (params: FetchPartnersParams) =>
    [...partnerKeys.lists(), params] as const,
  details: () => [...partnerKeys.all, "detail"] as const,
  detail: (id: string) => [...partnerKeys.details(), id] as const,
};

export const goodKeys = {
  all: ["mainGoods"] as const,
  lists: () => [...goodKeys.all, "list"] as const, // For consistency
  list: (params: FetchGoodsParams) => [...goodKeys.lists(), params] as const,
  details: () => [...goodKeys.all, "detail"] as const,
  detail: (id: string) => [...goodKeys.details(), id] as const,
};

// Keys for Journal <-> Partner Links
export const journalPartnerLinkKeys = {
  all: ["journalPartnerLinks"] as const,
  lists: () => [...journalPartnerLinkKeys.all, "list"] as const,
  listForPartner: (partnerId: string) =>
    [...journalPartnerLinkKeys.lists(), "byPartner", partnerId] as const,
};

// Keys for Journal <-> Good Links
export const journalGoodLinkKeys = {
  all: ["journalGoodLinks"] as const,
  lists: () => [...journalGoodLinkKeys.all, "list"] as const,
  listForGood: (goodId: string) =>
    [...journalGoodLinkKeys.lists(), "byGood", goodId] as const,
};

// Keys for Journal <-> Partner <-> Good Links
export const jpgLinkKeys = {
  all: ["jpgLinks"] as const,
  lists: () => [...jpgLinkKeys.all, "list"] as const,
  listForContext: (goodId: string, journalId: string) =>
    [...jpgLinkKeys.lists(), "byContext", goodId, journalId] as const,
  // Key for the special query in useJournalPartnerGoodLinking
  partnersForJpgModal: (journalId: string | null) =>
    ["partnersForJpgModal", journalId] as const,
};

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const, // For future-proofing list views
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

// Keys for Roles
export const roleKeys = {
  all: ["allRoles"] as const,
};

// Keys for Permissions
export const permissionKeys = {
  all: ["allPermissions"] as const,
};
