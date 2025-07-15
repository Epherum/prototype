// src/lib/types.ts

import {
  ApprovalStatus,
  EntityState,
  Permission,
  Role,
  RolePermission,
} from "@prisma/client";

export type PartnerTypeClient = "LEGAL_ENTITY" | "NATURAL_PERSON";

export type PartnerGoodFilterStatus = "affected" | "unaffected" | "inProcess";

export type RoleWithPermissions = Role & {
  permissions: (RolePermission & {
    permission: Permission;
  })[];
};

export type Partner = {
  id: string;
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
  entityState: EntityState;
  approvalStatus: ApprovalStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    journalPartnerLinks?: number;
  } | null;
};

// The state will now be an array of these statuses
export type ActivePartnerFilters = PartnerGoodFilterStatus[];

export interface FetchPartnersParams {
  limit?: number;
  offset?: number;
  partnerType?: PartnerTypeClient;
  filterStatus?: ActivePartnerFilters;
  filterStatuses?: string[];
  contextJournalIds?: string[];
  journalId?: string | null; // Used for 'affected' filter
  restrictedJournalId?: string | null;
  linkedToJournalIds?: string[];
  linkedToGoodId?: string;
  includeChildren?: boolean;
  // NEW: For J -> D -> G -> P or J -> G -> D -> P flows
  forGoodsIntersection?: string[];
}

export type PaginatedPartnersResponse = { data: Partner[]; total: number };

export interface AccountNodeData {
  id: string;
  name: string;
  code: string;
  children?: AccountNodeData[];
  isConceptualRoot?: boolean;
  isTerminal?: boolean;
}

export interface Journal {
  id: string;
  name: string;
  parentId?: string | null;
  isTerminal?: boolean;
  additionalDetails?: any;
}

export interface JournalPartnerLinkWithDetails {
  id: string;
  partnerId: string;
  journalId: string;
  journalName?: string;
  journalCode?: string;
  partnershipType?: string | null;
  exoneration?: boolean | null;
  periodType?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  documentReference?: string | null;
}

export interface Good {
  id: string;
  label: string;
  referenceCode?: string | null;
  barcode?: string | null;
  taxCodeId?: number | null;
  typeCode?: string | null;
  description?: string | null;
  unitCodeId?: number | null;
  unit?: string;
  stockTrackingMethod?: string | null;
  packagingTypeCode?: string | null;
  photoUrl?: string | null;
  additionalDetails?: any;
  price?: number;
  taxCode?: {
    id: number;
    code: string;
    rate: number;
    description?: string | null;
  } | null;
  unitOfMeasure?: { id: number; code: string; name: string } | null;
  name?: string;
  code?: string;
  unit_code?: string;
  jpqLinkId?: string; // BigInt as string. Represents the JournalPartnerGoodLink ID.
}

export type PaginatedGoodsResponse = { data: Good[]; total: number };

/**
 * === UPDATED INTERFACE FOR GOODS ===
 * This now mirrors FetchPartnersParams for consistent filtering logic.
 */
export interface FetchGoodsParams {
  limit?: number;
  offset?: number;
  typeCode?: string;

  // For J-G flow (Journal is 1st, Goods is 2nd) with filter buttons
  filterStatus?: ActivePartnerFilters;
  filterStatuses?: string[];

  contextJournalIds?: string[]; // Used for 'affected'
  journalId?: string | null; // Used for 'affected' filter
  restrictedJournalId?: string | null; // Used for role-based 'unaffected' and 'inProcess'

  // For J-P-G or P-J-G flows (Goods is 3rd, filtered by JPGL)
  forJournalIds?: string[];
  forPartnerId?: string;

  // For G-J or simple J-G when not using filterStatus
  linkedToJournalIds?: string[];

  // Common parameter for hierarchical journal selections
  includeJournalChildren?: boolean;

  context?: {
    partnerId: string;
    journalId: string;
  };

  // NEW: For J -> D -> P -> G flow
  forPartnersIntersection?: string[];
  // UPDATED: Allow multiple partner IDs for J -> P -> D -> G flow
  forPartnerIds?: string[];
}

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

export type UpdatePartnerClientData = Partial<
  Omit<CreatePartnerClientData, "partnerType">
>;

export type CreateGoodClientData = {
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
  price?: number;
};

export type UpdateGoodClientData = Partial<
  Omit<CreateGoodClientData, "referenceCode" | "barcode">
>;

export type CreateJournalPartnerLinkClientData = {
  journalId: string;
  partnerId: string;
  partnershipType?: string | null;
  exoneration?: boolean | null;
  periodType?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  documentReference?: string | null;
};

export interface JournalPartnerLinkClient {
  id: string;
  journalId: string;
  partnerId: string;
  partnershipType?: string | null;
  exoneration?: boolean | null;
  periodType?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  documentReference?: string | null;
  journal?: AccountNodeData;
  partner?: Partner;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateJournalGoodLinkClientData {
  journalId: string;
  goodId: string;
}

export interface JournalGoodLinkClient {
  id: string;
  journalId: string;
  goodId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface JournalGoodLinkWithDetails {
  id: string;
  goodId: string;
  journalId: string;
  journalName?: string;
  journalCode?: string;
  createdAt?: string | null;
}

export interface CreateJournalPartnerGoodLinkClientData {
  journalId: string;
  partnerId: string;
  goodId: string;
  partnershipType?: string | null;
  descriptiveText?: string | null;
  contextualTaxCodeId?: number | null;
}

export interface JournalPartnerGoodLinkClient {
  id: string;
  journalPartnerLinkId: string;
  goodId: string;
  descriptiveText?: string | null;
  contextualTaxCodeId?: number | null;
  createdAt?: string;
  updatedAt?: string;
  journalPartnerLink?: JournalPartnerLinkClient;
  good?: Good;
  contextualTaxCode?: {
    id: number;
    code: string;
    rate: number;
    description?: string | null;
  } | null;
}

// REFACTORED: RoleData no longer contains restriction info
export interface RoleData {
  name: string;
  permissions: Array<{ action: string; resource: string }>;
}

export type DocumentCreationMode =
  | "IDLE" // Not in creation mode
  | "SINGLE_ITEM" // J->P->G->D or J->G->P->D
  | "LOCK_PARTNER" // J->P->D->G
  | "LOCK_GOOD" // J->G->D->P
  | "INTERSECT_FROM_PARTNER" // J->D->P->G
  | "INTERSECT_FROM_GOOD"; // J->D->G->P

// NEW: Represents a line item being prepared for a document.
export interface DocumentItem {
  goodId: string;
  goodLabel: string;
  quantity: number;
  unitPrice: number;
  // This must be resolved just before submitting.
  journalPartnerGoodLinkId?: string;
}

// Represents a Document from the backend, with BigInts as strings for client-side safety
export interface Document {
  id: string; // BigInt as string
  refDoc: string;
  type: "INVOICE" | "QUOTE" | "PURCHASE_ORDER" | "CREDIT_NOTE";
  date: string; // ISO Date string
  state: "DRAFT" | "FINALIZED" | "PAID" | "VOID";
  partnerId: string; // BigInt as string
  totalHT: number;
  totalTax: number;
  totalTTC: number;
  balance: number;
  lines?: any[]; // Include lines if needed for view/edit
}

// Represents the shape of the paginated response for documents.
export interface PaginatedDocumentsResponse {
  data: Document[];
  total: number;
}

// Represents a single line item being prepared on the client for creation.
// This is the "shopping cart" item.
export interface DocumentLineClientData {
  // This is the critical link to the Good in its specific Journal-Partner context.
  // It MUST be a string to match the `Good.jpqLinkId`.
  journalPartnerGoodLinkId: string;
  designation: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  // ... other fields needed for calculation, e.g., discountPercentage
}

// Represents the final payload sent to the backend API to create a new document.
export interface CreateDocumentClientData {
  refDoc: string;
  type: Document["type"];
  date: Date; // The final modal will provide a Date object.
  partnerId: string; // The locked partner ID from the global store.
  lines: DocumentLineClientData[];
}

export type UpdateDocumentClientData = {
  refDoc?: string;
  date?: string; // Or Date
  description?: string | null;
  paymentMode?: string | null;
};
