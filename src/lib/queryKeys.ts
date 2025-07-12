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
  lists: () => [...partnerKeys.all, "list"] as const,
  list: (params: FetchPartnersParams) =>
    [...partnerKeys.lists(), params] as const,
  details: () => [...partnerKeys.all, "detail"] as const,
  detail: (id: string | null | undefined) =>
    [...partnerKeys.details(), id] as const, // Allow null/undefined
};

export const goodKeys = {
  all: ["mainGoods"] as const,
  lists: () => [...goodKeys.all, "list"] as const,
  list: (params: FetchGoodsParams) => [...goodKeys.lists(), params] as const,
  details: () => [...goodKeys.all, "detail"] as const,
  detail: (id: string | null | undefined) =>
    [...goodKeys.details(), id] as const, // Allow null/undefined
};

// Keys for Journal <-> Partner Links
export const journalPartnerLinkKeys = {
  all: ["journalPartnerLinks"] as const,
  lists: () => [...journalPartnerLinkKeys.all, "list"] as const,
  listForPartner: (partnerId: string | null | undefined) =>
    [...journalPartnerLinkKeys.lists(), "byPartner", partnerId] as const, // Allow null/undefined
};

// Keys for Journal <-> Good Links
export const journalGoodLinkKeys = {
  all: ["journalGoodLinks"] as const,
  lists: () => [...journalGoodLinkKeys.all, "list"] as const,
  listForGood: (goodId: string | null | undefined) =>
    [...journalGoodLinkKeys.lists(), "byGood", goodId] as const, // Allow null/undefined
};

// Keys for Journal <-> Partner <-> Good Links
export const jpgLinkKeys = {
  all: ["jpgLinks"] as const,
  lists: () => [...jpgLinkKeys.all, "list"] as const,
  // --- ADD THIS NEW KEY ---
  listForDocumentContext: (
    partnerId: string | null,
    journalId: string | null
  ) =>
    [...jpgLinkKeys.lists(), "forDocument", { partnerId, journalId }] as const,
  // ---
  listForContext: (goodId: string, journalId: string) =>
    [...jpgLinkKeys.lists(), "byContext", goodId, journalId] as const,
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

// Add this to the end of the file, before the closing brace if any.

export const documentKeys = {
  all: ["documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (partnerId: string | null) =>
    [...documentKeys.lists(), { partnerId }] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string | null) => [...documentKeys.details(), id] as const,
};
