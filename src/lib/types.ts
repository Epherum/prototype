// src/lib/types.ts
import {
  PartnerType as PrismaPartnerType,
  ApprovalStatus,
  EntityState,
  Role,
  RolePermission,
  Permission,
} from "@prisma/client";

export type PartnerTypeClient = "LEGAL_ENTITY" | "NATURAL_PERSON";

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
  companyId: string;
  entityState: EntityState;
  approvalStatus: ApprovalStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    journalPartnerLinks?: number;
  } | null;
};

/**
 * @description Defines the possible filter states for the partner list when Journal is the primary slider.
 * This is the single source of truth for the filter buttons.
 */
export type PartnerFilterStatus =
  | "all"
  | "affected"
  | "unaffected"
  | "inProcess"
  | null;

/**
 * @description Client-side parameters for fetching partners.
 * This has been simplified to align with the refactored API route and backend service.
 */
export interface FetchPartnersParams {
  limit?: number;
  offset?: number;
  partnerType?: PartnerTypeClient;

  // --- Primary filter mechanism for Journal-as-Root view ---
  filterStatus?: PartnerFilterStatus;
  contextJournalIds?: string[]; // Used for 'affected' and 'all' filter statuses

  // --- Parameters for other linking scenarios (e.g., J-G-P, G-J-P) ---
  linkedToJournalIds?: string[];
  linkedToGoodId?: string;
  includeChildren?: boolean; // Maintained for legacy/specific flows if needed
}

// (Make sure to include all other existing types from your original file here)
export type PaginatedPartnersResponse = { data: Partner[]; total: number };
export interface AccountNodeData {
  id: string;
  name: string;
  code: string;
  children?: AccountNodeData[];
  isConceptualRoot?: boolean;
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
}
export type PaginatedGoodsResponse = { data: Good[]; total: number };
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
export interface FetchGoodsParams {
  limit?: number;
  offset?: number;
  typeCode?: string;
  filterStatus?: "affected" | "unaffected" | "all" | null;
  contextJournalIds?: string[];
  linkedToJournalIds?: string[];
  linkedToPartnerId?: string;
  forJournalIds?: string[];
  forPartnerId?: string;
  includeJournalChildren?: boolean;
}
export interface RoleData {
  name: string;
  permissions: Array<{ action: string; resource: string }>;
  restrictedTopLevelJournalId?: string | null;
  restrictedTopLevelJournalCompanyId?: string | null;
}
