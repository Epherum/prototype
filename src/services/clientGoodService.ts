// src/services/clientGoodService.ts
import type {
  CreateGoodClientData,
  Good,
  PaginatedGoodsResponse,
  UpdateGoodClientData,
  FetchGoodsParams,
  ActivePartnerFilters, // Import the array type
} from "@/lib/types";

export async function fetchGoods(
  params: FetchGoodsParams = {}
): Promise<PaginatedGoodsResponse> {
  const queryParams = new URLSearchParams();

  // Standard params
  if (params.limit !== undefined)
    queryParams.append("limit", String(params.limit));
  if (params.offset !== undefined)
    queryParams.append("offset", String(params.offset));
  if (params.typeCode) queryParams.append("typeCode", params.typeCode);

  // --- Logic for different filtering scenarios ---

  // Priority 1: J-P-G linking
  if (
    params.forPartnerId &&
    params.forJournalIds &&
    params.forJournalIds.length > 0
  ) {
    queryParams.append("forPartnerId", params.forPartnerId);
    queryParams.append("forJournalIds", params.forJournalIds.join(","));
    if (params.includeJournalChildren !== undefined) {
      queryParams.append(
        "includeJournalChildren",
        String(params.includeJournalChildren)
      );
    }
  }
  // --- REFACTORED: Priority 2: Journal-as-Root filtering ---
  else if (params.filterStatuses && params.filterStatuses.length > 0) {
    queryParams.append("filterStatuses", params.filterStatuses.join(",")); // Send the array
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
    if (params.restrictedJournalId) {
      queryParams.append("restrictedJournalId", params.restrictedJournalId);
    }
  }
  // Priority 3: Other linking scenarios
  else if (params.linkedToJournalIds && params.linkedToJournalIds.length > 0) {
    queryParams.append(
      "linkedToJournalIds",
      params.linkedToJournalIds.join(",")
    );
    if (params.includeJournalChildren !== undefined) {
      queryParams.append(
        "includeJournalChildren",
        String(params.includeJournalChildren)
      );
    }
  }

  const response = await fetch(`/api/goods?${queryParams.toString()}`);
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(errorData.message || `Failed to fetch goods`);
  }
  const result: PaginatedGoodsResponse = await response.json();
  result.data = result.data.map((good) => ({
    ...good,
    id: String(good.id),
    taxCodeId: good.taxCodeId ?? null,
    unitCodeId: good.unitCodeId ?? null,
  }));
  return result;
}
// --- CRUD Operations (createGood, updateGood, deleteGood, fetchGoodById) ---
export async function createGood(
  goodData: CreateGoodClientData
): Promise<Good> {
  const response = await fetch("/api/goods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(goodData),
  });
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error creating good/service" }));
    throw new Error(
      errorData.message ||
        `Failed to create good/service: ${response.statusText}`
    );
  }
  const newGood = await response.json();
  return {
    ...newGood,
    id: String(newGood.id),
    taxCodeId: newGood.taxCodeId ?? null,
    unitCodeId: newGood.unitCodeId ?? null,
  };
}

export async function updateGood(
  goodId: string,
  goodData: UpdateGoodClientData
): Promise<Good> {
  const response = await fetch(`/api/goods/${goodId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(goodData),
  });
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error updating good/service" }));
    throw new Error(
      errorData.message ||
        `Failed to update good/service: ${response.statusText}`
    );
  }
  const updatedGood = await response.json();
  return {
    ...updatedGood,
    id: String(updatedGood.id),
    taxCodeId: updatedGood.taxCodeId ?? null,
    unitCodeId: updatedGood.unitCodeId ?? null,
  };
}

export async function deleteGood(goodId: string): Promise<{ message: string }> {
  const response = await fetch(`/api/goods/${goodId}`, { method: "DELETE" });
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error deleting good/service" }));
    throw new Error(
      errorData.message ||
        `Failed to delete good/service: ${response.statusText}`
    );
  }
  if (response.status === 204)
    // No Content
    return { message: `Good/service ${goodId} deleted successfully.` };
  return response.json();
}

export async function fetchGoodById(goodId: string): Promise<Good | null> {
  const response = await fetch(`/api/goods/${goodId}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error fetching good/service by ID" }));
    throw new Error(
      errorData.message ||
        `Failed to fetch good/service ${goodId}: ${response.statusText}`
    );
  }
  const good = await response.json();
  return {
    ...good,
    id: String(good.id),
    taxCodeId: good.taxCodeId ?? null,
    unitCodeId: good.unitCodeId ?? null,
  };
}

// --- Specialized Fetch Functions ---
// These can be kept if they map to specific backend logic not covered by the main fetchGoods,
// or they can be refactored to use the main fetchGoods if the backend /api/goods is versatile enough.

// This function is used in page.tsx for J-P-G and P-J-G flows.
// It now correctly calls the main `fetchGoods` which will handle these params.
export async function fetchGoodsForJournalsAndPartner(
  journalIds: string[],
  partnerId: string,
  includeJournalChildren: boolean = true
): Promise<Good[]> {
  if (!journalIds || journalIds.length === 0 || !partnerId) return [];
  const result = await fetchGoods({
    forJournalIds: journalIds, // Matches FetchGoodsParams
    forPartnerId: partnerId, // Matches FetchGoodsParams
    includeJournalChildren: includeJournalChildren,
  });
  return result.data;
}

// This function is used for J-G or G-J (2-way) flows.
export async function fetchGoodsLinkedToJournals(
  journalIds: string[],
  includeChildren: boolean = true // Renamed to includeJournalChildren for consistency with FetchGoodsParams
): Promise<Good[]> {
  if (!journalIds || journalIds.length === 0) return [];
  const result = await fetchGoods({
    linkedToJournalIds: journalIds, // Matches FetchGoodsParams
    includeJournalChildren: includeChildren,
  });
  return result.data;
}

// This function hits a DEDICATED backend endpoint for fetching goods linked to a partner via JPGL,
// irrespective of a specific journal context from the UI at that moment.
// KEEP THIS AS IS if it serves a distinct purpose (e.g., showing ALL goods ever 3-way linked to a partner).
export async function fetchGoodsLinkedToPartnerViaJPGL(
  partnerId: string
): Promise<Good[]> {
  if (!partnerId || partnerId === "undefined") {
    console.warn(
      `[fetchGoodsLinkedToPartnerViaJPGL] Called with invalid partnerId: '${partnerId}'. Returning [].`
    );
    return [];
  }
  // This specific endpoint likely has its own optimized query.
  const response = await fetch(`/api/partners/${partnerId}/goods-via-jpgl`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Failed to fetch goods linked to partner ${partnerId} via JPGL`,
    }));
    throw new Error(errorData.message || "Failed to fetch goods");
  }

  const result: PaginatedGoodsResponse = await response.json(); // Assuming it returns PaginatedGoodsResponse

  console.log(`[clientGoodService] Parsed response data:`, result.data);

  return result.data.map((g) => ({
    ...g,
    id: String(g.id),
    taxCodeId: g.taxCodeId ?? null,
    unitCodeId: g.unitCodeId ?? null,
  }));
}

/**
 * Fetches goods specifically for the document creation context by hitting the
 * endpoint that is guaranteed to return the `jpqLinkId`.
 * @param partnerId The ID of the selected partner.
 * @param journalId The ID of the selected journal.
 * @returns A promise that resolves to a paginated list of goods, annotated with jpqLinkId.
 */
/**
 */
export async function fetchGoodsForDocumentContext(
  partnerId: string,
  journalId: string
): Promise<PaginatedGoodsResponse> {
  // --- BULLETPROOF GUARD AND LOGGING ---
  console.log(
    `[clientGoodService] fetchGoodsForDocumentContext called with: partnerId='${partnerId}' (type: ${typeof partnerId}), journalId='${journalId}'`
  );

  // This is the most important guard. It prevents the API call if the data is invalid.
  if (!partnerId || partnerId === "undefined" || !journalId) {
    const errorMessage = `[clientGoodService] Invalid arguments provided. Aborting fetch. PartnerID: ${partnerId}, JournalID: ${journalId}`;
    console.error(errorMessage);
    // Throw an error to stop the React Query from proceeding.
    throw new Error(errorMessage);
  }

  // Construct the final URL.
  const apiUrl = `/api/partners/${partnerId}/goods-via-jpgl?journalId=${journalId}`;

  console.log(`[clientGoodService] Making fetch request to: ${apiUrl}`);
  // --- END BULLETPROOF GUARD ---

  const response = await fetch(apiUrl); // Use the constructed apiUrl variable

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(
      errorData.message || `Failed to fetch goods for document context`
    );
  }

  const result: PaginatedGoodsResponse = await response.json();
  result.data = result.data.map((good) => ({
    ...good,
    id: String(good.id),
    // The backend is now responsible for adding `jpqLinkId` to each good object.
  }));
  return result;
}
