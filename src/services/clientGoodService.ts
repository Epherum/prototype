// src/services/clientGoodService.ts
import type {
  CreateGoodClientData,
  Good,
  PaginatedGoodsResponse,
  UpdateGoodClientData,
} from "@/lib/types"; // We'll define these next

interface FetchGoodsParams {
  limit?: number;
  offset?: number;
  typeCode?: string;
  linkedToJournalId?: string;
  linkedToPartnerId?: string; // For filtering by partner only
  // For filtering by journal AND partner
  forJournalId?: string;
  forPartnerId?: string; // This will be string for query param, converted to BigInt on backend
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

  // Specific filtering scenarios
  if (params.forJournalId && params.forPartnerId) {
    queryParams.append("forJournalId", params.forJournalId);
    queryParams.append("forPartnerId", params.forPartnerId); // Backend handles BigInt conversion
    if (params.includeJournalChildren !== undefined) {
      queryParams.append(
        "includeJournalChildren",
        String(params.includeJournalChildren)
      );
    }
  } else if (params.linkedToPartnerId) {
    queryParams.append("linkedToPartnerId", params.linkedToPartnerId);
  } else if (params.linkedToJournalId) {
    queryParams.append("linkedToJournalId", params.linkedToJournalId);
    if (params.includeJournalChildren !== undefined) {
      queryParams.append(
        "includeJournalChildren",
        String(params.includeJournalChildren)
      );
    }
  }
  // If no specific filters, it fetches all (with pagination if limit/offset provided)

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
  // Ensure IDs are strings if they were BigInt
  result.data = result.data.map((good) => ({
    ...good,
    id: String(good.id), // Explicitly cast id to string
  }));
  return result;
}

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
  return { ...newGood, id: String(newGood.id) }; // Ensure ID is string
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
  return { ...updatedGood, id: String(updatedGood.id) }; // Ensure ID is string
}

export async function deleteGood(goodId: string): Promise<{ message: string }> {
  const response = await fetch(`/api/goods/${goodId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error deleting good/service" }));
    throw new Error(
      errorData.message ||
        `Failed to delete good/service: ${response.statusText}`
    );
  }
  if (response.status === 204) {
    return { message: `Good/service ${goodId} deleted successfully.` };
  }
  return response.json();
}

// Optional: Fetch a single good by ID
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
  return { ...good, id: String(good.id) }; // Ensure ID is string
}

// MODIFIED: Was fetchGoodsForJournalAndPartner
export async function fetchGoodsForJournalsAndPartner(
  journalIds: string[], // Changed from single journalId
  partnerId: string,
  includeJournalChildren: boolean = true
): Promise<Good[]> {
  // Assuming direct array return for now, adjust if Paginated
  if (!journalIds || journalIds.length === 0 || !partnerId) {
    return []; // Or fetch all goods for partner if journalIds is empty, etc.
  }
  const queryParams = new URLSearchParams({
    forJournalIds: journalIds.join(","), // Create comma-separated string
    forPartnerId: partnerId,
    includeJournalChildren: String(includeJournalChildren),
  });

  const response = await fetch(`/api/goods?${queryParams.toString()}`);
  if (!response.ok) {
    // ... error handling (same as before)
    const errorData = await response.json().catch(() => ({
      message: `Failed to fetch goods for journals ${journalIds.join(
        ","
      )} and partner ${partnerId}`,
    }));
    throw new Error(errorData.message || "Failed to fetch goods");
  }
  // Assuming API returns { data: Good[], total: number }
  const result: PaginatedGoodsResponse = await response.json(); // Assuming PaginatedGoodsResponse
  return result.data.map((g) => ({
    ...g,
    id: String(g.id),
    taxCodeId: g.taxCodeId ?? null,
    unitCodeId: g.unitCodeId ?? null,
  })); // Ensure string IDs and handle nulls
}

export async function fetchGoodsLinkedToJournals(
  journalIds: string[],
  includeChildren: boolean = true
): Promise<Good[]> {
  // Expects to return Good[]
  if (!journalIds || journalIds.length === 0) {
    return [];
  }
  const queryParams = new URLSearchParams({
    linkedToJournalIds: journalIds.join(","),
    includeChildren: String(includeChildren),
  });

  const response = await fetch(`/api/goods?${queryParams.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Failed to fetch goods for journals ${journalIds.join(",")}`,
    }));
    throw new Error(errorData.message || "Failed to fetch goods");
  }
  // Assuming the API for this specific filter returns { data: Good[], total: number }
  const result: PaginatedGoodsResponse = await response.json();
  return result.data.map((g) => ({
    ...g,
    id: String(g.id),
    taxCodeId: g.taxCodeId ?? null,
    unitCodeId: g.unitCodeId ?? null,
  }));
}

export async function fetchGoodsLinkedToPartnerViaJPGL(
  partnerId: string
): Promise<Good[]> {
  if (!partnerId || partnerId === "undefined") {
    // Explicitly check for the string "undefined"
    console.warn(
      `[fetchGoodsLinkedToPartnerViaJPGL] Called with invalid partnerId: '${partnerId}'. Returning [].`
    );
    return [];
  }

  const response = await fetch(`/api/partners/${partnerId}/goods-via-jpgl`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Failed to fetch goods linked to partner ${partnerId} via JPGL`,
    }));
    throw new Error(errorData.message || "Failed to fetch goods");
  }
  const result: PaginatedGoodsResponse = await response.json();
  return result.data.map((g) => ({
    ...g,
    id: String(g.id),
    taxCodeId: g.taxCodeId ?? null,
    unitCodeId: g.unitCodeId ?? null,
  }));
}
