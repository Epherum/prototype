// src/services/clientJournalService.ts
import type { AccountNodeData, Journal } from "@/lib/types";
import type { Journal as PrismaJournal } from "@prisma/client";
import { JournalForAdminSelection, buildTree } from "@/lib/helpers";
import { ROOT_JOURNAL_ID } from "@/lib/constants";

export async function fetchJournalHierarchy(
  restrictedTopLevelJournalId?: string | null
): Promise<AccountNodeData[]> {
  let apiUrl = "/api/journals";
  const params = new URLSearchParams();

  // If a user is restricted to a specific journal (not the conceptual root),
  // fetch only the subtree starting from that journal.
  if (
    restrictedTopLevelJournalId &&
    restrictedTopLevelJournalId !== ROOT_JOURNAL_ID
  ) {
    params.append("fetchSubtree", "true");
    params.append("restrictedTopLevelJournalId", restrictedTopLevelJournalId);
    console.log(
      `[clientJournalService] Fetching RESTRICTED journal sub-hierarchy for: ${restrictedTopLevelJournalId}`
    );
  } else {
    // For admins or unrestricted users, the default API call fetches the complete hierarchy.
    console.log(
      "[clientJournalService] Fetching COMPLETE journal hierarchy for admin/unrestricted user."
    );
  }

  if (params.toString()) {
    apiUrl += `?${params.toString()}`;
  }

  console.log(`[clientJournalService] Calling API: ${apiUrl}`);
  const response = await fetch(apiUrl);

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error fetching journals" }));
    console.error(
      "[clientJournalService] Error fetching journal hierarchy:",
      errorData
    );
    throw new Error(
      errorData.message ||
        `Failed to fetch journal hierarchy: ${response.statusText}`
    );
  }

  const flatJournals: Journal[] = await response.json();
  const hierarchy = buildTree(flatJournals);
  console.log(
    `[clientJournalService] Built journal hierarchy, count: ${hierarchy.length} top-level nodes.`
  );
  return hierarchy;
}

export async function createJournalEntry(
  journalData: Omit<Journal, "children" | "parent">
): Promise<Journal> {
  const response = await fetch("/api/journals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(journalData),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error creating journal" }));
    throw new Error(
      errorData.message || `Failed to create journal: ${response.statusText}`
    );
  }
  return response.json();
}

export async function deleteJournalEntry(journalId: string): Promise<any> {
  const response = await fetch(`/api/journals/${journalId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error deleting journal" }));
    throw new Error(
      errorData.message || `Failed to delete journal: ${response.statusText}`
    );
  }
  if (response.status === 204) {
    return { message: `Journal ${journalId} deleted successfully.` };
  }
  return response.json();
}

export async function fetchJournalsLinkedToPartner(
  partnerId: string
): Promise<Journal[]> {
  if (!partnerId) return [];
  const response = await fetch(`/api/journals?linkedToPartnerId=${partnerId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Failed to fetch journals linked to partner ${partnerId}`,
    }));
    throw new Error(errorData.message || "Failed to fetch journals");
  }
  const journals: Journal[] = await response.json();
  return journals.map((j) => ({ ...j, id: String(j.id) }));
}

export async function fetchJournalsLinkedToGood(
  goodId: string
): Promise<Journal[]> {
  if (!goodId) {
    console.warn("[fetchJournalsLinkedToGood] No goodId provided.");
    return [];
  }
  const response = await fetch(`/api/journals?linkedToGoodId=${goodId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Failed to fetch journals linked to good ${goodId}`,
    }));
    throw new Error(errorData.message || "Failed to fetch journals");
  }
  const journals: Journal[] = await response.json();
  return journals.map((j) => ({ ...j, id: String(j.id) }));
}

export interface TopLevelJournalAdminSelection
  extends Pick<PrismaJournal, "id" | "name"> {}

export async function fetchTopLevelJournalsForAdmin(): Promise<
  TopLevelJournalAdminSelection[]
> {
  const response = await fetch("/api/journals/top-level", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Failed to fetch top-level journals" }));
    throw new Error(
      errorData?.message ||
        `Failed to fetch top-level journals: ${response.statusText}`
    );
  }
  return response.json();
}

export async function fetchAllJournalsForAdminRestriction(): Promise<
  JournalForAdminSelection[]
> {
  const apiUrl = "/api/journals/all-for-admin-selection";
  console.log(`[clientJournalService] Attempting to fetch: ${apiUrl}`);
  try {
    const response = await fetch(apiUrl);
    console.log(
      `[clientJournalService] Response status for ${apiUrl}: ${response.status}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[clientJournalService] Raw error from ${apiUrl}:`,
        errorText
      );
      throw new Error(`Failed to fetch all journals: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(
      "[clientJournalService] Successfully fetched all journals for admin restriction, count:",
      data.length
    );
    return data;
  } catch (error) {
    console.error(
      `[clientJournalService] Network or other error in fetchAllJournalsForAdminRestriction for ${apiUrl}:`,
      error
    );
    throw error;
  }
}
