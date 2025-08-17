// src/lib/types/serviceOptions.ts

export type FilterMode = "affected" | "unaffected" | "inProcess";

// For findPartnersForGoods / findGoodsForPartners
export interface IntersectionFindOptions {
  partnerIds?: bigint[];
  goodIds?: bigint[];
  journalIds?: string[]; // This one remains correct
}

// For getAllPartners / getAllGoods
export interface GetAllItemsOptions<T> {
  take?: number;
  skip?: number;
  restrictedJournalId?: string | null;

  // This will now be specific to the service using it
  where?: T;

  // New Filtering Logic
  filterMode?: FilterMode;
  activeFilterModes?: FilterMode[]; // Multi-select filter modes
  permissionRootId?: string;
  selectedJournalIds?: string[];
}

// ✨ NEWLY ADDED ✨
// For the new powerful getAllDocuments service function
export interface GetAllDocumentsOptions {
  take?: number;
  skip?: number;
  restrictedJournalId?: string | null; // User's permission

  // Filtering by selections in other sliders
  filterByJournalIds?: string[];
  filterByPartnerIds?: string[]; // Client will send strings
  filterByGoodIds?: string[]; // Client will send strings
}
