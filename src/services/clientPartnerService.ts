// src/services/clientPartnerService.ts
import type {
  PaginatedPartnersResponse,
  Partner,
  CreatePartnerClientData,
  UpdatePartnerClientData,
  FetchPartnersParams,
} from "@/lib/types";

// --- (fetchPartners and other CRUD functions are unchanged) ---
export async function fetchPartners(
  params: FetchPartnersParams = {}
): Promise<PaginatedPartnersResponse> {
  const queryParams = new URLSearchParams();

  if (params.limit !== undefined)
    queryParams.append("limit", String(params.limit));
  if (params.offset !== undefined)
    queryParams.append("offset", String(params.offset));
  if (params.partnerType) queryParams.append("partnerType", params.partnerType);

  if (
    params.linkedToGoodId &&
    params.linkedToJournalIds &&
    params.linkedToJournalIds.length > 0
  ) {
    queryParams.append("linkedToGoodId", params.linkedToGoodId);
    queryParams.append(
      "linkedToJournalIds",
      params.linkedToJournalIds.join(",")
    );
    if (params.includeChildren !== undefined) {
      queryParams.append("includeChildren", String(params.includeChildren));
    }
  } else if (params.filterStatuses && params.filterStatuses.length > 0) {
    queryParams.append("filterStatuses", params.filterStatuses.join(","));
    if (
      params.filterStatuses.includes("affected") &&
      params.contextJournalIds &&
      params.contextJournalIds.length > 0
    ) {
      queryParams.append(
        "contextJournalIds",
        params.contextJournalIds.join(",")
      );
    }
  } else if (
    params.linkedToJournalIds &&
    params.linkedToJournalIds.length > 0
  ) {
    queryParams.append(
      "linkedToJournalIds",
      params.linkedToJournalIds.join(",")
    );
  }

  if (params.restrictedJournalId) {
    queryParams.append("restrictedJournalId", params.restrictedJournalId);
  }

  const response = await fetch(`/api/partners?${queryParams.toString()}`);

  if (!response.ok) {
    let errorMessage = `Failed to fetch partners: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {}
    throw new Error(errorMessage);
  }

  const result: PaginatedPartnersResponse = await response.json();
  result.data = result.data.map((p) => ({ ...p, id: String(p.id) }));
  return result;
}

export async function createPartner(
  partnerData: CreatePartnerClientData
): Promise<Partner> {
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
  return { ...newPartner, id: String(newPartner.id) };
}

export async function updatePartner(
  partnerId: string,
  partnerData: UpdatePartnerClientData
): Promise<Partner> {
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
  return { ...updatedPartner, id: String(updatedPartner.id) };
}

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

export async function fetchPartnerById(
  partnerId: string
): Promise<Partner | null> {
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
  return { ...partner, id: String(partner.id) };
}

export async function fetchPartnersLinkedToJournals(
  journalIds: string[],
  includeChildren: boolean = true
): Promise<Partner[]> {
  if (!journalIds || journalIds.length === 0) {
    return [];
  }
  const result = await fetchPartners({
    linkedToJournalIds: journalIds,
    includeChildren: includeChildren,
  });
  return result.data;
}

export async function fetchPartnersLinkedToJournalsAndGood(
  journalIds: string[],
  goodId: string,
  includeChildren: boolean = true
): Promise<Partner[]> {
  if (!journalIds || journalIds.length === 0 || !goodId) {
    return [];
  }
  const result = await fetchPartners({
    linkedToJournalIds: journalIds,
    linkedToGoodId: goodId,
    includeChildren: includeChildren,
  });
  return result.data;
}

// ✅ --- ADDED: New Consolidated Function ---
/**
 * Fetches partners for one or more goods within a journal context.
 * Calls the new consolidated `/api/partners/for-goods` endpoint.
 * - If one ID is provided, it fetches all partners for that good.
 * - If multiple IDs are provided, it fetches the intersection of partners common to all goods.
 * @param goodIds - An array of good IDs.
 * @param journalId - The ID of the journal context.
 * @returns A promise that resolves to the API response with partners data.
 */
export async function getPartnersForGoods(
  goodIds: string[],
  journalId: string
): Promise<PaginatedPartnersResponse> {
  if (goodIds.length === 0 || !journalId) {
    return Promise.resolve({ data: [], total: 0 });
  }

  const params = new URLSearchParams({
    goodIds: goodIds.join(","),
    journalId: journalId,
  });

  const response = await fetch(`/api/partners/for-goods?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to fetch partners for goods");
  }

  const result: PaginatedPartnersResponse = await response.json();
  result.data = result.data.map((p) => ({ ...p, id: String(p.id) }));
  return result;
}

// ✅ --- REMOVED: Obsolete Functions ---
// `fetchIntersectionOfPartners` has been removed and replaced by `getPartnersForGoods`.
