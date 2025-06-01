// src/services/clientPartnerService.ts
import type {
  PaginatedPartnersResponse,
  Partner,
  CreatePartnerClientData,
  UpdatePartnerClientData,
} from "@/lib/types";

interface FetchPartnersParams {
  limit?: number;
  offset?: number;
  partnerType?: string; // Changed from PartnerType to string for query params
  filterStatus?: "affected" | "unaffected" | "all" | null;
  contextJournalIds?: string[]; // For "affected" status or default J->P
  // Parameters for other linking scenarios
  linkedToJournalIds?: string[]; // For general J-P, J-G-P, P-J-G if P is first
  linkedToGoodId?: string; // For J-G-P, G-P
  includeChildren?: boolean; // For linkedToJournalIds
}

export async function fetchPartners(
  params: FetchPartnersParams = {}
): Promise<PaginatedPartnersResponse> {
  const queryParams = new URLSearchParams();

  if (params.limit !== undefined)
    queryParams.append("limit", String(params.limit));
  if (params.offset !== undefined)
    queryParams.append("offset", String(params.offset));
  if (params.partnerType) queryParams.append("partnerType", params.partnerType);

  let isJPFilteringApplied = false;

  // Priority 1: 3-way JPGL style linking (e.g., J-G-P, G-J-P)
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
    isJPFilteringApplied = true; // This is a specific filter, not the J-P root filter
  }
  // Priority 2: J-P flow (Journal is 1st, Partner is 2nd)
  // This block handles explicit filterStatus OR the default case (filterStatus: null)
  // params.contextJournalIds will be [] initially or when no journals are selected.
  // params.filterStatus will be 'affected', 'unaffected', 'all', or null.
  else if (
    params.hasOwnProperty("filterStatus") ||
    params.hasOwnProperty("contextJournalIds")
  ) {
    // We are in a J-P context if either filterStatus or contextJournalIds is provided from page.tsx for this flow
    // (even if their values are null or empty array respectively)

    const effectiveFilterStatus = params.filterStatus || "affected"; // Default to 'affected' if null
    queryParams.append("filterStatus", effectiveFilterStatus);

    if (params.contextJournalIds && params.contextJournalIds.length > 0) {
      queryParams.append(
        "contextJournalIds",
        params.contextJournalIds.join(",")
      );
    }
    // If contextJournalIds is empty or not provided:
    // - For "affected": backend should return [].
    // - For "unaffected": backend should return partners not linked to ANY journal (or all if no journals exist).
    // - For "all": backend should return all partners.

    if (
      params.includeChildren !== undefined &&
      params.contextJournalIds &&
      params.contextJournalIds.length > 0
    ) {
      queryParams.append("includeChildren", String(params.includeChildren));
    }
    isJPFilteringApplied = true;
  }
  // Priority 3: General 2-way linking if linkedToJournalIds is used without linkedToGoodId (and not in J-P root filter)
  // This might be redundant if J-P context (Priority 2) covers it with contextJournalIds.
  // Kept for explicitness if `linkedToJournalIds` is used in a different, non-root-filter context by page.tsx.
  else if (params.linkedToJournalIds && params.linkedToJournalIds.length > 0) {
    // This suggests a direct request to find partners for specific journals,
    // not necessarily through the J-P root filtering UI.
    // Backend might treat this like "filterStatus: affected" with these journal IDs.
    queryParams.append(
      "linkedToJournalIds",
      params.linkedToJournalIds.join(",")
    );
    if (params.includeChildren !== undefined) {
      queryParams.append("includeChildren", String(params.includeChildren));
    }
    isJPFilteringApplied = true;
  }

  // If !isJPFilteringApplied, it means Partner slider is 1st, or no relevant filter params were passed.
  // The URL will only have limit/offset, fetching all. This is correct for "Partner 1st".
  // For "Journal 1st, Partner 2nd, initial load", `isJPFilteringApplied` should be true now,
  // and `filterStatus=affected` (with no contextJournalIds) will be sent.

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
      /* Could not parse JSON */
    }
    throw new Error(errorMessage);
  }

  const result: PaginatedPartnersResponse = await response.json();
  // Ensure IDs are strings
  result.data = result.data.map((p) => ({ ...p, id: String(p.id) }));
  return result;
}

// ... (createPartner, updatePartner, deletePartner, fetchPartnerById remain the same) ...
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

// The existing fetchPartnersLinkedToJournals and fetchPartnersLinkedToJournalsAndGood
// effectively become specific use cases of the more general `fetchPartners` above
// if the backend API route `/api/partners` correctly prioritizes parameters.
// You could choose to deprecate them or keep them as convenience wrappers.

// For example, fetchPartnersLinkedToJournals could be:
// export async function fetchPartnersLinkedToJournals(journalIds: string[], includeChildren: boolean = true): Promise<Partner[]> {
//   if (!journalIds || journalIds.length === 0) return [];
//   const result = await fetchPartners({ linkedToJournalIds: journalIds, includeChildren });
//   return result.data;
// }
// However, the current fetchPartnersLinkedToJournals is fine as it maps directly to a specific backend behavior.
// The key is that your main `fetchPartners` can now handle the new filterStatus.

// Keep existing specific fetchers if they map to distinct UI needs or backend logic paths
// that are not covered by the general `filterStatus` approach.
// The backend `/api/partners/route.ts` already has logic to handle `linkedToJournalIds`
// distinctly if `filterStatus` is not present.

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
  // This call will hit the backend logic that handles 'linkedToJournalIds' specifically,
  // which internally in partnerService might use 'filterByAffectedJournals'.
  const result = await fetchPartners({
    linkedToJournalIds: journalIds,
    includeChildren: includeChildren,
    // Not sending filterStatus here, so backend uses its priority for linkedToJournalIds
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
    // Not sending filterStatus here
  });
  return result.data;
}
