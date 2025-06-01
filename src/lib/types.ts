// src/lib/types.ts

// Make sure PartnerType matches or can be mapped from Prisma's PartnerType
// For simplicity, if you use it as string:
export type PartnerTypeClient = "LEGAL_ENTITY" | "NATURAL_PERSON";

export type Partner = {
  id: string; // Prisma BigInt becomes string via jsonBigIntReplacer
  name: string;
  partnerType: PartnerTypeClient | string; // Use specific client type or general string
  notes?: string | null;
  logoUrl?: string | null;
  photoUrl?: string | null;
  isUs?: boolean | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  bioFatherName?: string | null;
  bioMotherName?: string | null;
  additionalDetails?: any; // Or a more specific type/schema
  // DynamicSlider specific fields for partners (if any were used before, ensure they are present or handled)
  // e.g., if partners also had 'code' or 'description' used in the slider item display
};

export type PaginatedPartnersResponse = {
  data: Partner[];
  total: number;
};

// --- Other types (Journal, Good, etc.) would go here ---
export interface AccountNodeData {
  id: string;
  name: string;
  code: string; // Account code
  children?: AccountNodeData[];
  isConceptualRoot?: boolean; // For the special root node in the modal
  // any other properties your account nodes might have
}

// Type for the flat journal data from the API (matches Prisma's Journal model)
export interface Journal {
  id: string;
  name: string;
  parentId?: string | null;
  isTerminal?: boolean;
  additionalDetails?: any;
  // Prisma adds createdAt, updatedAt automatically. They might be in your API response.
  // createdAt?: Date | string;
  // updatedAt?: Date | string;
}
export interface JournalPartnerLinkWithDetails {
  id: string; // This is the ID of the JournalPartnerLink record itself
  partnerId: string;
  journalId: string; // The ID of the linked Journal
  journalName?: string; // Name of the linked journal
  journalCode?: string; // Code of the linked journal
  // partnerName?: string; // (Redundant if always in context of one partner)
  // You can include other fields from JournalPartnerLink directly here if they are part of the response
  partnershipType?: string | null;
  exoneration?: boolean | null;
  periodType?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  documentReference?: string | null;
  // linkedAt?: string; // If you had a generic 'linkedAt' from backend
}

// Type for the hierarchical structure used by UI components
export interface AccountNodeData {
  id: string;
  name: string;
  code: string; // Often same as id for journals unless you have a separate code system
  parentId?: string | null; // Keep parentId for reference if needed, though tree structure implies it
  isTerminal?: boolean;
  additionalDetails?: any;
  children?: AccountNodeData[];
  isConceptualRoot?: boolean; // For the special root node in the modal
}

// Type for Good/Service on the frontend
// Mapping from Prisma's GoodsAndService, ensuring IDs are strings
export interface Good {
  id: string; // Was BigInt, now string
  label: string;
  referenceCode?: string | null;
  barcode?: string | null;
  taxCodeId?: number | null;
  typeCode?: string | null;
  description?: string | null;
  unitCodeId?: number | null; // This might be just 'unit' in your old mock data
  unit?: string; // From old mock data, ensure consistency or map unitCodeId to this
  stockTrackingMethod?: string | null;
  packagingTypeCode?: string | null;
  photoUrl?: string | null;
  additionalDetails?: any;
  price?: number; // Add if you store price directly on good, or if it's dynamic

  // Optional: Include related data if needed directly on the Good object
  taxCode?: {
    id: number;
    code: string;
    rate: number;
    description?: string | null;
  } | null;
  unitOfMeasure?: {
    id: number;
    code: string;
    name: string;
    description?: string | null;
  } | null;

  // For DynamicSlider compatibility (if used from data.json before)
  name?: string; // Often `label` is used as `name` for display
  code?: string; // Often `referenceCode` or `id` is used as `code`
  unit_code?: string; // From old mock data, map from unitOfMeasure.code
}

export type PaginatedGoodsResponse = {
  data: Good[];
  total: number;
};

// Client-side type for creating a new partner
// Matches CreatePartnerData from backend's partnerService.ts, but IDs are strings
export type CreatePartnerClientData = {
  name: string;
  partnerType: PartnerTypeClient;
  notes?: string | null;
  logoUrl?: string | null;
  photoUrl?: string | null;
  isUs?: boolean | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  bioFatherName?: string | null;
  bioMotherName?: string | null;
  additionalDetails?: any;
};

// Client-side type for updating an existing partner
// Matches UpdatePartnerData from backend's partnerService.ts
export type UpdatePartnerClientData = Partial<
  Omit<CreatePartnerClientData, "partnerType">
>;

// Client-side type for creating a new Good/Service
// Should align with CreateGoodsData from backend's goodsService.ts
export type CreateGoodClientData = {
  label: string;
  referenceCode?: string | null;
  barcode?: string | null;
  taxCodeId?: number | null; // Assuming frontend sends number, backend might convert if needed
  typeCode?: string | null;
  description?: string | null;
  unitCodeId?: number | null; // Assuming frontend sends number
  stockTrackingMethod?: string | null;
  packagingTypeCode?: string | null;
  photoUrl?: string | null;
  additionalDetails?: any;
  price?: number; // If price is part of the Good model directly
};

// Client-side type for updating an existing Good/Service
// Should align with UpdateGoodsData from backend's goodsService.ts
export type UpdateGoodClientData = Partial<
  Omit<CreateGoodClientData, "referenceCode" | "barcode">
>;

// Client-side type for creating a Journal-Partner Link
export type CreateJournalPartnerLinkClientData = {
  journalId: string; // Journal ID (string, as it's from AccountNodeData.id)
  partnerId: string; // Partner ID (string, from selectedPartnerId)
  partnershipType?: string | null;
  exoneration?: boolean | null;
  periodType?: string | null;
  dateDebut?: string | null; // ISO string date
  dateFin?: string | null; // ISO string date
  documentReference?: string | null;
};

// Type for the link object itself if you need to display it or manage it client-side
export interface JournalPartnerLinkClient {
  id: string; // BigInt from backend, string on client
  journalId: string;
  partnerId: string; // BigInt from backend, string on client
  partnershipType?: string | null;
  exoneration?: boolean | null;
  periodType?: string | null;
  dateDebut?: string | null; // ISO string date
  dateFin?: string | null; // ISO string date
  documentReference?: string | null;
  journal?: AccountNodeData; // Optional, if fetching with details
  partner?: Partner; // Optional, if fetching with details
  createdAt?: string;
  updatedAt?: string;
}

// --- JournalGoodLink Related Types ---
export interface CreateJournalGoodLinkClientData {
  journalId: string;
  goodId: string; // Client sends string, backend converts to BigInt
  // Add any other attributes for the link if needed
}

// Represents a basic JournalGoodLink as returned from simple queries or after creation
export interface JournalGoodLinkClient {
  id: string;
  journalId: string;
  goodId: string;
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
}

// Represents a JournalGoodLink with details of the linked Journal
// This should match the structure from GET /api/goods/[goodId]/journal-links
export interface JournalGoodLinkWithDetails {
  id: string; // The ID of the JournalGoodLink record itself
  goodId: string; // The ID of the linked Good
  journalId: string; // The ID of the linked Journal
  journalName?: string; // Name of the linked journal
  journalCode?: string; // Code of the linked journal
  createdAt?: string | null;
}

// src/lib/types.ts

// ... (all your existing types: Partner, Good, Journal, JournalPartnerLink, JournalGoodLink etc.)

// --- JournalPartnerGoodLink (JPGL) Related Types ---

// For creating a new Journal-Partner-Good Link from the client
// This will be sent to the backend service that first finds/creates JPL
// and then creates JPGL.
export interface CreateJournalPartnerGoodLinkClientData {
  journalId: string; // ID of the target Journal
  partnerId: string; // ID of the target Partner (client sends string)
  goodId: string; // ID of the target Good (client sends string)
  partnershipType?: string | null; // Optional: if a specific JournalPartnerLink type is needed
  // If not provided, backend service might use a default
  descriptiveText?: string | null;
  contextualTaxCodeId?: number | null; // Client sends number
  // Add any other relevant fields like quantity, price, specific document reference
  // if they are part of this 3-way link's context at creation.
  // e.g., quantity?: number;
  // e.g., unitPrice?: number;
}

// Represents a JournalPartnerGoodLink as returned from the API,
// potentially with its related entities expanded.
// IDs from backend BigInts will be strings on the client.
export interface JournalPartnerGoodLinkClient {
  id: string; // JPGL's own ID
  journalPartnerLinkId: string; // ID of the intermediate JournalPartnerLink
  goodId: string;
  descriptiveText?: string | null;
  contextualTaxCodeId?: number | null;
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string

  // Optional expanded relations:
  journalPartnerLink?: JournalPartnerLinkClient; // Could contain Journal and Partner
  good?: Good;
  contextualTaxCode?: {
    id: number;
    code: string;
    rate: number; // Assuming rate is number (Prisma Decimal becomes number in JS)
    description?: string | null;
  } | null;
}

export interface FetchPartnersParams {
  limit?: number;
  offset?: number;
  partnerType?: string; // Or your PartnerType enum if you parse it client-side
  filterStatus?: "affected" | "unaffected" | "all" | null;
  contextJournalIds?: string[];
  linkedToJournalIds?: string[];
  linkedToGoodId?: string;
  includeChildren?: boolean;
  // any other params your fetchPartners might take
}

export interface FetchGoodsParams {
  limit?: number;
  offset?: number;
  typeCode?: string;
  filterStatus?: "affected" | "unaffected" | "all" | null;
  contextJournalIds?: string[];
  linkedToJournalIds?: string[];
  linkedToPartnerId?: string;
  forJournalIds?: string[]; // Use plural if your client service/backend expects it
  forPartnerId?: string;
  includeJournalChildren?: boolean;
  // any other params
}
