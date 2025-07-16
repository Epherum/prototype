// src/services/clientGoodService.ts
import type {
  CreateGoodClientData,
  Good,
  PaginatedGoodsResponse,
  UpdateGoodClientData,
  FetchGoodsParams,
} from "@/lib/types";

// --- Main fetchGoods function (remains unchanged) ---
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

// --- CRUD Operations (remain unchanged) ---
export async function createGood(
  goodData: CreateGoodClientData
): Promise<Good> {
  const response = await fetch("/api/goods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(goodData),
  });
  if (!response.ok) throw new Error("Failed to create good/service");
  const newGood = await response.json();
  return { ...newGood, id: String(newGood.id) };
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
  if (!response.ok) throw new Error("Failed to update good/service");
  const updatedGood = await response.json();
  return { ...updatedGood, id: String(updatedGood.id) };
}

export async function deleteGood(goodId: string): Promise<{ message: string }> {
  const response = await fetch(`/api/goods/${goodId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete good/service");
  if (response.status === 204)
    return { message: `Good/service ${goodId} deleted successfully.` };
  return response.json();
}

export async function fetchGoodById(goodId: string): Promise<Good | null> {
  const response = await fetch(`/api/goods/${goodId}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch good/service ${goodId}`);
  }
  const good = await response.json();
  return { ...good, id: String(good.id) };
}

// --- Specialized Fetch Functions (unchanged portions) ---
export async function fetchGoodsForJournalsAndPartner(
  journalIds: string[],
  partnerId: string,
  includeJournalChildren: boolean = true
): Promise<Good[]> {
  if (!journalIds || journalIds.length === 0 || !partnerId) return [];
  const result = await fetchGoods({
    forJournalIds: journalIds,
    forPartnerId: partnerId,
    includeJournalChildren: includeJournalChildren,
  });
  return result.data;
}

export async function fetchGoodsLinkedToJournals(
  journalIds: string[],
  includeChildren: boolean = true
): Promise<Good[]> {
  if (!journalIds || journalIds.length === 0) return [];
  const result = await fetchGoods({
    linkedToJournalIds: journalIds,
    includeJournalChildren: includeChildren,
  });
  return result.data;
}

export async function fetchGoodsLinkedToPartnerViaJPGL(
  partnerId: string
): Promise<Good[]> {
  if (!partnerId || partnerId === "undefined") return [];
  const response = await fetch(`/api/partners/${partnerId}/goods-via-jpgl`);
  if (!response.ok) throw new Error("Failed to fetch goods");
  const result: PaginatedGoodsResponse = await response.json();
  return result.data.map((g) => ({ ...g, id: String(g.id) }));
}

export async function fetchGoodsForDocumentContext(
  partnerId: string,
  journalId: string
): Promise<PaginatedGoodsResponse> {
  if (!partnerId || partnerId === "undefined" || !journalId) {
    throw new Error(
      "Invalid arguments provided to fetchGoodsForDocumentContext."
    );
  }
  const apiUrl = `/api/partners/${partnerId}/goods-via-jpgl?journalId=${journalId}`;
  const response = await fetch(apiUrl);
  if (!response.ok)
    throw new Error("Failed to fetch goods for document context");
  const result: PaginatedGoodsResponse = await response.json();
  result.data = result.data.map((good) => ({ ...good, id: String(good.id) }));
  return result;
}

// ✅ --- ADDED: New Consolidated Function ---
/**
 * Fetches goods for one or more partners within a journal context.
 * Calls the new consolidated `/api/goods/for-partners` endpoint.
 * - If one ID is provided, it fetches all goods for that partner (union-like).
 * - If multiple IDs are provided, it fetches the intersection of goods common to all partners.
 * @param partnerIds - An array of partner IDs.
 * @param journalId - The ID of the journal context.
 * @returns A promise that resolves to the API response with goods data.
 */
export async function getGoodsForPartners(
  partnerIds: string[],
  journalId: string
): Promise<PaginatedGoodsResponse> {
  if (partnerIds.length === 0 || !journalId) {
    // Return a promise that resolves to an empty state to prevent API errors
    return Promise.resolve({ data: [], total: 0 });
  }

  // Construct the query parameters. The key is joining the array into a comma-separated string.
  const params = new URLSearchParams({
    partnerIds: partnerIds.join(","),
    journalId: journalId,
  });

  console.log(
    `[CLIENT-SERVICE: getGoodsForPartners] Firing API Request to: /api/goods/for-partners?${params.toString()}`
  );

  const response = await fetch(`/api/goods/for-partners?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to fetch goods for partners");
  }

  const result: PaginatedGoodsResponse = await response.json();
  result.data = result.data.map((good) => ({
    ...good,
    id: String(good.id),
  }));
  return result;
}

// ✅ --- REMOVED: Obsolete Functions ---
// `fetchIntersectionOfGoods` has been removed.
// `fetchGoodsForPartnersUnion` has been removed.
