// src/lib/queryKeys.ts

import type {
  GetAllItemsOptions,
  GetAllDocumentsOptions,
} from "@/lib/types/serviceOptions";

export const journalKeys = {
  all: ["journalHierarchy"] as const,
  hierarchy: (restrictedId: string | null | undefined) =>
    [...journalKeys.all, restrictedId] as const,
  flatListByPartner: (partnerId: string | null) =>
    ["flatJournalsFilteredByPartner", partnerId] as const,
  flatListByGood: (goodId: string | null) =>
    ["flatJournalsFilteredByGood", goodId] as const,
  flatListByDocument: (documentId: string | null) =>
    ["flatJournalsFilteredByDocument", documentId] as const,
};

export const partnerKeys = {
  all: ["partners"] as const,
  lists: () => [...partnerKeys.all, "list"] as const,
  // ✅ REFACTORED: The list key now uses the powerful GetAllItemsOptions.
  // The generic type can be an empty object as we only care about the shape of the options for the key.
  list: (params: GetAllItemsOptions<{}>) =>
    [...partnerKeys.lists(), params] as const,
  listByDocument: (documentId: string | null) =>
    ["partnersFilteredByDocument", documentId] as const,
  details: () => [...partnerKeys.all, "detail"] as const,
  detail: (id: string | null | undefined) =>
    [...partnerKeys.details(), id] as const,
};

export const goodKeys = {
  all: ["mainGoods"] as const,
  lists: () => [...goodKeys.all, "list"] as const,
  // ✅ REFACTORED: The list key now uses the powerful GetAllItemsOptions.
  list: (params: GetAllItemsOptions<{}>) =>
    [...goodKeys.lists(), params] as const,
  listByDocument: (documentId: string | null) =>
    ["goodsFilteredByDocument", documentId] as const,
  details: () => [...goodKeys.all, "detail"] as const,
  detail: (id: string | null | undefined) =>
    [...goodKeys.details(), id] as const,
};

// Keys for Journal <-> Partner Links
export const journalPartnerLinkKeys = {
  all: ["journalPartnerLinks"] as const,
  lists: () => [...journalPartnerLinkKeys.all, "list"] as const,
  listForPartner: (partnerId: string | null | undefined) =>
    [...journalPartnerLinkKeys.lists(), "byPartner", partnerId] as const,
};

// Keys for Journal <-> Good Links
export const journalGoodLinkKeys = {
  all: ["journalGoodLinks"] as const,
  lists: () => [...journalGoodLinkKeys.all, "list"] as const,
  listForGood: (goodId: string | null | undefined) =>
    [...journalGoodLinkKeys.lists(), "byGood", goodId] as const,
};

// Keys for Journal <-> Partner <-> Good Links
export const jpgLinkKeys = {
  all: ["jpgLinks"] as const,
  lists: () => [...jpgLinkKeys.all, "list"] as const,
  listForDocumentContext: (
    partnerId: string | null,
    journalId: string | null
  ) =>
    [...jpgLinkKeys.lists(), "forDocument", { partnerId, journalId }] as const,
  listForContext: (goodId: string, journalId: string) =>
    [...jpgLinkKeys.lists(), "byContext", goodId, journalId] as const,
  partnersForJpgModal: (journalId: string | null) =>
    ["partnersForJpgModal", journalId] as const,
};

export const documentKeys = {
  all: ["documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  // ✅ REFACTORED: The list key now reflects the powerful new filtering options,
  // ensuring unique keys for different filter combinations.
  list: (options: GetAllDocumentsOptions) =>
    [...documentKeys.lists(), options] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string | null | undefined) =>
    [...documentKeys.details(), id] as const,
};

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
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
