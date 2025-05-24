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
  // Future: partnerType?: string;
  // Future: linkedToJournalId?: string;
}

export async function fetchPartners(
  params: FetchPartnersParams
): Promise<PaginatedPartnersResponse> {
  const queryParams = new URLSearchParams();
  if (params.limit !== undefined) {
    queryParams.append("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    queryParams.append("offset", String(params.offset));
  }
  // Example for future filters:
  // if (params.partnerType) queryParams.append("partnerType", params.partnerType);

  const response = await fetch(`/api/partners?${queryParams.toString()}`);

  if (!response.ok) {
    let errorMessage = `Failed to fetch partners: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      // Could not parse JSON, stick with statusText
    }
    throw new Error(errorMessage);
  }

  const result: PaginatedPartnersResponse = await response.json();
  // IDs should be strings here due to jsonBigIntReplacer on the server.
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
  // The response from POST /api/partners should already handle BigInt to string for the ID
  return response.json();
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
  // The response from PUT /api/partners/[id] should also handle BigInt to string
  return response.json();
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
  // DELETE often returns 204 No Content or a simple message object
  if (response.status === 204) {
    return { message: `Partner ${partnerId} deleted successfully.` };
  }
  return response.json(); // Expects { message: "..." }
}

// Optional: Fetch a single partner (if needed for edit form pre-fill, though often list data is sufficient)
export async function fetchPartnerById(
  partnerId: string
): Promise<Partner | null> {
  const response = await fetch(`/api/partners/${partnerId}`);
  if (!response.ok) {
    if (response.status === 404) return null; // Not found
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error fetching partner by ID" }));
    throw new Error(
      errorData.message ||
        `Failed to fetch partner ${partnerId}: ${response.statusText}`
    );
  }
  return response.json(); // Expects ID to be string
}

// MODIFIED: Was fetchPartnersLinkedToJournal, now takes string[]
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
  const queryParams = new URLSearchParams({
    linkedToJournalIds: journalIds.join(","),
    includeChildren: String(includeChildren),
  });
  console.log(
    `[fetchPartnersLinkedToJournals] Fetching from URL: /api/partners?${queryParams.toString()}`
  );

  const response = await fetch(`/api/partners?${queryParams.toString()}`);
  console.log(
    `[fetchPartnersLinkedToJournals] Response status for journals ${journalIds.join(
      ","
    )}: ${response.status}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Failed to fetch partners for journals ${journalIds.join(",")}`,
    }));
    console.error(
      `[fetchPartnersLinkedToJournals] API error for journals ${journalIds.join(
        ","
      )}:`,
      errorData
    );
    throw new Error(errorData.message || "Failed to fetch partners");
  }
  const result: PaginatedPartnersResponse = await response.json();
  console.log(
    `[fetchPartnersLinkedToJournals] Raw API response for journals ${journalIds.join(
      ","
    )}:`,
    result
  );
  const partners = result.data.map((p) => ({ ...p, id: String(p.id) }));
  console.log(
    `[fetchPartnersLinkedToJournals] Processed partners for journals ${journalIds.join(
      ","
    )}:`,
    partners
  );
  return partners;
}

export async function fetchPartnersLinkedToJournalsAndGood(
  journalIds: string[],
  goodId: string,
  includeChildren: boolean = true
): Promise<Partner[]> {
  if (!journalIds || journalIds.length === 0 || !goodId) {
    console.log(
      "[fetchPartnersLinkedToJournalsAndGood] Missing journalIds or goodId. Returning []."
    );
    return [];
  }
  const queryParams = new URLSearchParams({
    linkedToJournalIds: journalIds.join(","),
    linkedToGoodId: goodId,
    includeChildren: String(includeChildren),
  });

  const response = await fetch(`/api/partners?${queryParams.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Failed to fetch partners for journals [${journalIds.join(
        ","
      )}] and good ${goodId}`,
    }));
    throw new Error(errorData.message || "Failed to fetch partners");
  }
  // API for this specific filter returns { data: Partner[], total: number }
  const result: PaginatedPartnersResponse = await response.json();
  return result.data.map((p) => ({ ...p, id: String(p.id) }));
}
