// src/services/clientPartnerService.ts

// ✅ CHANGED: Import the new, robust client model and Zod payload types.
import { PartnerClient } from "@/lib/types/models.client";
import {
  CreatePartnerPayload,
  UpdatePartnerPayload,
} from "@/lib/schemas/partner.schema";

// ✅ NEW: Define a type for the paginated response using our new client model.
export interface PaginatedPartnersResponse {
  data: PartnerClient[];
  totalCount: number;
}

// ✅ NEW: Define a type for the fetch parameters, which are specific to the client service.
// This replaces the old FetchPartnersParams.
export interface FetchPartnersParams {
  take?: number;
  skip?: number;
  filterMode?: "affected" | "unaffected" | "inProcess";
  activeFilterModes?: ("affected" | "unaffected" | "inProcess")[]; // Array of filter modes for multi-select
  permissionRootId?: string;
  selectedJournalIds?: string[];
  intersectionOfGoodIds?: string[]; // Note: API expects bigint, we send string
  allFilters?: string[]; // Include all active filters to ensure query key changes
}

/**
 * A generic helper to map an API response object (with bigint) to a Client model (with string).
 * This is crucial for ensuring type consistency across the client-side.
 */
const mapToPartnerClient = (partner: any): PartnerClient => {
  return {
    ...partner,
    id: String(partner.id),
    // Map other bigint fields if they exist, e.g., createdById
    createdById: partner.createdById ? String(partner.createdById) : null,
    deletedById: partner.deletedById ? String(partner.deletedById) : null,
    previousVersionId: partner.previousVersionId ? String(partner.previousVersionId) : null,
    nextVersionId: partner.nextVersionId ? String(partner.nextVersionId) : null,
    // Preserve the journalPartnerLinks relationship data
    journalPartnerLinks: partner.journalPartnerLinks?.map((link: any) => ({
      ...link,
      id: String(link.id),
      journalId: String(link.journalId),
      partnerId: String(link.partnerId),
      journal: link.journal ? {
        ...link.journal,
        id: String(link.journal.id),
        parentId: link.journal.parentId ? String(link.journal.parentId) : null,
      } : null,
    })) || [],
  };
};

// ✅ REWRITTEN: This function now correctly calls the single GET /api/partners endpoint.
export async function fetchPartners(
  params: FetchPartnersParams = {}
): Promise<PaginatedPartnersResponse> {
  // Use URLSearchParams for clean query string construction.
  const queryParams = new URLSearchParams();

  // Standard pagination
  if (params.take !== undefined)
    queryParams.append("take", String(params.take));
  if (params.skip !== undefined)
    queryParams.append("skip", String(params.skip));

  // Intersection mode (G -> P)
  if (params.intersectionOfGoodIds && params.intersectionOfGoodIds.length > 0) {
    queryParams.append(
      "intersectionOfGoodIds",
      params.intersectionOfGoodIds.join(",")
    );
    // Intersection can also be filtered by journals
    if (params.selectedJournalIds && params.selectedJournalIds.length > 0) {
      queryParams.append(
        "selectedJournalIds",
        params.selectedJournalIds.join(",")
      );
    }
  }
  // Journal filter modes (J -> P)
  else if (
    (params.filterMode || params.activeFilterModes) &&
    params.selectedJournalIds &&
    params.selectedJournalIds.length > 0
  ) {
    // Use activeFilterModes if provided, otherwise fall back to filterMode
    if (params.activeFilterModes && params.activeFilterModes.length > 0) {
      queryParams.append("activeFilterModes", params.activeFilterModes.join(","));
    } else if (params.filterMode) {
      queryParams.append("filterMode", params.filterMode);
    }
    queryParams.append(
      "selectedJournalIds",
      params.selectedJournalIds.join(",")
    );
    if (params.permissionRootId) {
      queryParams.append("permissionRootId", params.permissionRootId);
    }
  }

  const response = await fetch(`/api/partners?${queryParams.toString()}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to fetch partners");
  }

  // The API returns a { data, totalCount } object.
  const result = await response.json();

  // ✅ CRITICAL: Map the raw data to the `PartnerClient` type.
  return {
    data: result.data.map(mapToPartnerClient),
    totalCount: result.totalCount,
  };
}

// ✅ CHANGED: Function signature and return type updated.
export async function createPartner(
  partnerData: CreatePartnerPayload
): Promise<PartnerClient> {
  const response = await fetch("/api/partners", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partnerData),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error creating partner" }));
    throw new Error(
      errorData.message || `Failed to create partner: ${response.statusText}`
    );
  }

  const newPartner = await response.json();
  // ✅ CRITICAL: Map the raw API response to the correct client type.
  return mapToPartnerClient(newPartner);
}

// ✅ CHANGED: Function signature and return type updated.
export async function updatePartner(
  partnerId: string,
  partnerData: UpdatePartnerPayload
): Promise<PartnerClient> {
  const response = await fetch(`/api/partners/${partnerId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partnerData),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error updating partner" }));
    throw new Error(
      errorData.message || `Failed to update partner: ${response.statusText}`
    );
  }

  const updatedPartner = await response.json();
  // ✅ CRITICAL: Map the raw API response to the correct client type.
  return mapToPartnerClient(updatedPartner);
}

// This function's signature does not need to change.
export async function deletePartner(
  partnerId: string
): Promise<{ message: string }> {
  const response = await fetch(`/api/partners/${partnerId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error deleting partner" }));
    throw new Error(
      errorData.message || `Failed to delete partner: ${response.statusText}`
    );
  }

  if (response.status === 204)
    return { message: `Partner ${partnerId} deleted successfully.` };
  return response.json();
}

// ✅ CHANGED: Return type updated.
export async function fetchPartnerById(
  partnerId: string
): Promise<PartnerClient | null> {
  const response = await fetch(`/api/partners/${partnerId}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error fetching partner by ID" }));
    throw new Error(
      errorData.message ||
        `Failed to fetch partner ${partnerId}: ${response.statusText}`
    );
  }

  const partner = await response.json();
  // ✅ CRITICAL: Map the raw API response to the correct client type.
  return mapToPartnerClient(partner);
}

/**
 * Fetches partners that are linked to a specific document through DocumentLine.
 * @param documentId - The document ID (string format).
 * @returns A promise resolving to a paginated response of PartnerClient objects.
 */
export async function fetchPartnersForDocument(
  documentId: string
): Promise<PaginatedPartnersResponse> {
  if (!documentId) {
    return { data: [], totalCount: 0 };
  }

  const params = new URLSearchParams({ findByDocumentId: documentId });
  const response = await fetch(`/api/partners?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error fetching partners for document" }));
    throw new Error(
      errorData.message ||
        `Failed to fetch partners for document ${documentId}: ${response.statusText}`
    );
  }

  const result = await response.json();
  
  // Map the raw API response to the correct client types
  const mappedData = result.data.map(mapToPartnerClient);
  
  return {
    data: mappedData,
    totalCount: result.totalCount,
  };
}
