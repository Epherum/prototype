// src/lib/types.ts

import { SLIDER_TYPES } from "@/lib/constants";
import {
  ApprovalStatus,
  EntityState,
  Permission,
  Role,
  RolePermission,
} from "@prisma/client";

// =================================================================
// --- Foundational & Shared Types ---
// =================================================================

/**
 * The canonical list of all possible slider types in the application.
 * This is the fix for the TypeScript error.
 */
export type SliderType = (typeof SLIDER_TYPES)[keyof typeof SLIDER_TYPES];

export type PartnerTypeClient = "LEGAL_ENTITY" | "NATURAL_PERSON";
export type PartnerGoodFilterStatus = "affected" | "unaffected" | "inProcess";
export type ActivePartnerFilters = PartnerGoodFilterStatus[];

// =================================================================
// --- Core Business Entities ---
// =================================================================

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

export interface Journal {
  id: string;
  name: string;
  parentId?: string | null;
  isTerminal?: boolean;
  additionalDetails?: any;
}

export interface AccountNodeData {
  id: string;
  name: string;
  code: string;
  children?: AccountNodeData[];
  isConceptualRoot?: boolean;
  isTerminal?: boolean;
}

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

// =================================================================
// --- API Fetching & Pagination ---
// =================================================================

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
  forGoodsIntersection?: string[];
}

export type PaginatedPartnersResponse = { data: Partner[]; total: number };

export interface FetchGoodsParams {
  limit?: number;
  offset?: number;
  typeCode?: string;
  filterStatus?: ActivePartnerFilters;
  filterStatuses?: string[];
  contextJournalIds?: string[];
  journalId?: string | null;
  restrictedJournalId?: string | null;
  forJournalIds?: string[];
  forPartnerId?: string;
  linkedToJournalIds?: string[];
  includeJournalChildren?: boolean;
  context?: {
    partnerId: string;
    journalId: string;
  };
  forPartnersIntersection?: string[];
  forPartnerIds?: string[];
}

export type PaginatedGoodsResponse = { data: Good[]; total: number };
export interface PaginatedDocumentsResponse {
  data: Document[];
  total: number;
}

// ✅ START: ADDED TYPE FOR CONSISTENT JOURNAL RESPONSE
export interface PaginatedJournalResponse {
  data: AccountNodeData[] | Journal[];
  total: number;
}
// ✅ END: ADDED TYPE FOR CONSISTENT JOURNAL RESPONSE

// =================================================================
// --- Data Creation & Update Payloads ---
// =================================================================

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

export interface CreateDocumentClientData {
  refDoc: string;
  type: Document["type"];
  date: Date;
  partnerId: string;
  lines: DocumentLineClientData[];
}

export type UpdateDocumentClientData = {
  refDoc?: string;
  date?: string;
  description?: string | null;
  paymentMode?: string | null;
};

// =================================================================
// --- Linking Table Types & Payloads ---
// =================================================================

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

export interface JournalGoodLinkWithDetails {
  id: string;
  goodId: string;
  journalId: string;
  journalName?: string;
  journalCode?: string;
  createdAt?: string | null;
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

// =================================================================
// --- Document Creation Flow ---
// =================================================================

export type DocumentCreationMode =
  | "IDLE" // Not in creation mode
  | "SINGLE_ITEM" // J->P->G->D or J->G->P->D
  | "LOCK_PARTNER" // J->P->D->G
  | "LOCK_GOOD" // J->G->D->P
  | "INTERSECT_FROM_PARTNER" // J->D->P->G
  | "INTERSECT_FROM_GOOD"; // J->D->G->P

export interface DocumentItem {
  goodId: string;
  goodLabel: string;
  quantity: number;
  unitPrice: number;
  journalPartnerGoodLinkId?: string;
}

export interface DocumentLineClientData {
  journalPartnerGoodLinkId: string;
  designation: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

// =================================================================
// --- Auth & Permissions ---
// =================================================================

export type RoleWithPermissions = Role & {
  permissions: (RolePermission & {
    permission: Permission;
  })[];
};

export interface RoleData {
  name: string;
  permissions: Array<{ action: string; resource: string }>;
}
