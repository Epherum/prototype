// src/services/clientPartnerService.ts

import type {
  PaginatedPartnersResponse,
  Partner,
  CreatePartnerClientData,
  UpdatePartnerClientData,
  FetchPartnersParams,
} from "@/lib/types";

/**
 * === CORRECTED FUNCTION ===
 * This now correctly appends `restrictedJournalId` when it's present in the params.
 */
export async function fetchPartners(
  params: FetchPartnersParams = {}
): Promise<PaginatedPartnersResponse> {
  const queryParams = new URLSearchParams();

  // Append standard pagination and type parameters
  if (params.limit !== undefined)
    queryParams.append("limit", String(params.limit));
  if (params.offset !== undefined)
    queryParams.append("offset", String(params.offset));
  if (params.partnerType) queryParams.append("partnerType", params.partnerType);

  // --- Logic for different filtering scenarios ---

  // Priority 1: Specific linking scenarios (e.g., J-G-P, G-J-P)
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
  }
  // Priority 2: Our main Journal-as-Root multi-select filter
  else if (params.filterStatuses && params.filterStatuses.length > 0) {
    // Join the array into a comma-separated string for the URL
    queryParams.append("filterStatuses", params.filterStatuses.join(","));

    // contextJournalIds is primarily for the 'affected' filter.
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
  }
  // Priority 3: Other general linking (fallback)
  else if (params.linkedToJournalIds && params.linkedToJournalIds.length > 0) {
    queryParams.append(
      "linkedToJournalIds",
      params.linkedToJournalIds.join(",")
    );
  }

  // This parameter is independent and should be added if present,
  // as it's crucial for the backend logic of 'unaffected' and 'inProcess'.
  if (params.restrictedJournalId) {
    queryParams.append("restrictedJournalId", params.restrictedJournalId);
  }

  console.log(
    `[fetchPartners] Fetching from URL: /api/partners?${queryParams.toString()}`
  );
  const response = await fetch(`/api/partners?${queryParams.toString()}`);

  if (!response.ok) {
    let errorMessage = `Failed to fetch partners: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      // Could not parse JSON, use the original status text
    }
    throw new Error(errorMessage);
  }

  const result: PaginatedPartnersResponse = await response.json();
  result.data = result.data.map((p) => ({ ...p, id: String(p.id) }));
  return result;
}

// ... (createPartner, updatePartner, deletePartner, etc. remain the same) ...

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
    console.log(
      "[fetchPartnersLinkedToJournals] No journalIds provided, returning []."
    );
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
