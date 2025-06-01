// src/services/clientGoodService.ts
import type {
  CreateGoodClientData,
  Good,
  PaginatedGoodsResponse,
  UpdateGoodClientData,
} from "@/lib/types";

// Ensure this interface matches the parameters `goodsQueryKeyParamsStructure` in page.tsx produces
interface FetchGoodsParams {
  limit?: number;
  offset?: number;
  typeCode?: string; // For filtering by good type if applicable

  // For J-G flow (Journal is 1st, Goods is 2nd) with filter buttons
  filterStatus?: "affected" | "unaffected" | "all" | null;
  contextJournalIds?: string[]; // Journal IDs from Journal slider (used with filterStatus or as default for J->G)

  // For J-P-G or P-J-G flows (Goods is 3rd, filtered by JPGL)
  forJournalIds?: string[]; // Journal IDs (from hierarchy or flat list selection)
  forPartnerId?: string; // Partner ID (from Partner slider selection)

  // For J-G (2-way link, if not using filterStatus, or G-J)
  linkedToJournalIds?: string[]; // General journal linking if no partner context

  // For P-G (2-way link, if no journal context)
  linkedToPartnerId?: string; // General partner linking if no journal context

  // Common parameter for hierarchical journal selections
  includeJournalChildren?: boolean;
}

export async function fetchGoods(
  params: FetchGoodsParams = {}
): Promise<PaginatedGoodsResponse> {
  const queryParams = new URLSearchParams();

  if (params.limit !== undefined)
    queryParams.append("limit", String(params.limit));
  if (params.offset !== undefined)
    queryParams.append("offset", String(params.offset));
  if (params.typeCode) queryParams.append("typeCode", params.typeCode);

  // Priority 1: 3-way JPGL style linking (e.g., J-P-G, P-J-G)
  // These parameters are sent from page.tsx's goodsQueryKeyParamsStructure for these specific flows.
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
    // Backend /api/goods should prioritize these for fetching goods via JournalPartnerGoodLink
  }
  // Priority 2: filterStatus for J-G flow (Journal is 1st, Goods is 2nd)
  else if (params.filterStatus) {
    queryParams.append("filterStatus", params.filterStatus);
    if (
      (params.filterStatus === "affected" || !params.filterStatus) && // Also handles null filterStatus as 'affected'
      params.contextJournalIds &&
      params.contextJournalIds.length > 0
    ) {
      queryParams.append(
        "contextJournalIds",
        params.contextJournalIds.join(",")
      );
    }
    // `includeJournalChildren` might be relevant here if contextJournalIds implies hierarchy.
    // Backend needs to know if includeJournalChildren applies to contextJournalIds for filterStatus.
    if (
      params.includeJournalChildren !== undefined &&
      params.contextJournalIds &&
      params.contextJournalIds.length > 0
    ) {
      queryParams.append(
        "includeJournalChildren",
        String(params.includeJournalChildren)
      );
    }
  }
  // Priority 3: Default J->G linking (no explicit filterStatus, but contextJournalIds present)
  // Or general 2-way linking for G-J (linkedToJournalIds) or P-G (linkedToPartnerId).
  else if (params.contextJournalIds && params.contextJournalIds.length > 0) {
    // Handles J is 1st, G is 2nd, no filterStatus button clicked, but journals are selected.
    queryParams.append("contextJournalIds", params.contextJournalIds.join(","));
    if (params.includeJournalChildren !== undefined) {
      queryParams.append(
        "includeJournalChildren",
        String(params.includeJournalChildren)
      );
    }
  } else if (
    params.linkedToJournalIds &&
    params.linkedToJournalIds.length > 0
  ) {
    // Fallback for G-J or simple J-G (2-way JournalGoodLink)
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
  } else if (params.linkedToPartnerId) {
    // Fallback for P-G (2-way PartnerGoodLink - if you have such a direct link)
    // Or, if your backend interprets linkedToPartnerId without journal context
    // as "all goods linked to this partner via JPGL".
    // The existing `fetchGoodsLinkedToPartnerViaJPGL` might be more specific for this.
    // If this `linkedToPartnerId` is meant for a different 2-way link, ensure backend distinguishes.
    queryParams.append("linkedToPartnerId", params.linkedToPartnerId);
  }
  // If none of the above, it's a general fetch (e.g., Goods slider is 1st)

  console.log(
    `[fetchGoods] Fetching from URL: /api/goods?${queryParams.toString()}`
  );
  const response = await fetch(`/api/goods?${queryParams.toString()}`);

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error fetching goods" }));
    throw new Error(
      errorData.message || `Failed to fetch goods: ${response.statusText}`
    );
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
// These remain largely the same as you provided.
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
  return result.data.map((g) => ({
    ...g,
    id: String(g.id),
    taxCodeId: g.taxCodeId ?? null,
    unitCodeId: g.unitCodeId ?? null,
  }));
}
