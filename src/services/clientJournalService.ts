// src/services/clientJournalService.ts
import type { AccountNodeData, Journal } from "@/lib/types";
import type { Journal as PrismaJournal } from "@prisma/client";
import { JournalForAdminSelection, buildTree } from "@/lib/helpers";

export async function fetchJournalHierarchy(
  restrictedTopLevelJournalId?: string | null
): Promise<AccountNodeData[]> {
  let apiUrl = "/api/journals";
  const params = new URLSearchParams();

  if (restrictedTopLevelJournalId) {
    // If a user is restricted, fetch their specific sub-hierarchy.
    // The API's getJournalSubHierarchy will return the restrictedTopLevelJournalId node
    // and all its descendants. buildTree will then correctly form a tree with
    // restrictedTopLevelJournalId as the root because its parent won't be in the fetched list.
    params.append("fetchSubtree", "true"); // Signal to API to fetch the sub-tree
    params.append("restrictedTopLevelJournalId", restrictedTopLevelJournalId);
    console.log(
      `[clientJournalService] Fetching RESTRICTED journal sub-hierarchy for: ${restrictedTopLevelJournalId}`
    );
  } else {
    // For unrestricted users, fetch all journals for the company.
    // The API GET handler (without specific params like parentId or restrictedTopLevelJournalId)
    // defaults to journalService.getAllJournals(). buildTree will construct the full hierarchy.
    console.log(
      "[clientJournalService] Fetching COMPLETE journal hierarchy for unrestricted user."
    );
    // No specific params needed if API default is getAllJournals for the company.
    // If your API requires an explicit "fetchAll" or "root=true" for all top-levels, add it here.
    // For now, assuming calling /api/journals with no params gives all journals for the company.
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
  // buildTree will correctly form a tree. If restrictedTopLevelJournalId was used,
  // that node will be the root of the returned tree because its actual parent
  // (if any) won't be in flatJournals.
  const hierarchy = buildTree(flatJournals);
  console.log(
    "[clientJournalService] Built journal hierarchy, count:",
    hierarchy.length,
    "top-level nodes. Data:",
    hierarchy
  );
  return hierarchy;
}

// ... (createJournalEntry, deleteJournalEntry, fetchJournalsLinkedToPartner, fetchJournalsLinkedToGood, fetchTopLevelJournalsForAdmin functions remain the same) ...
export async function createJournalEntry(
  journalData: Omit<Journal, "children" | "parent" | "companyId"> // companyId added by backend
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
    // No Content
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
  extends Pick<PrismaJournal, "id" | "name" | "companyId"> {}

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
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = {
        message: `Failed to fetch top-level journals: ${response.statusText} (No JSON error body)`,
      };
    }
    console.error("Error fetching top-level journals:", errorData);
    throw new Error(
      errorData?.message ||
        `Failed to fetch top-level journals: ${response.statusText}`
    );
  }
  return response.json();
}

// It calls the new API endpoint /api/journals/all-for-admin-selection
// src/services/clientJournalService.ts
export async function fetchAllJournalsForAdminRestriction(): Promise<
  JournalForAdminSelection[]
> {
  const apiUrl = "/api/journals/all-for-admin-selection";
  console.log(`[clientJournalService] Attempting to fetch: ${apiUrl}`);
  try {
    const response = await fetch(apiUrl, {
      /* ... headers ... */
    });
    console.log(
      `[clientJournalService] Response status for ${apiUrl}: ${response.status}`
    );

    if (!response.ok) {
      let errorData = {
        message: `Request failed with status ${response.status} ${response.statusText}`,
      };
      try {
        const textError = await response.text(); // Try to get raw text
        console.error(
          `[clientJournalService] Raw error response text for ${apiUrl}:`,
          textError
        );
        errorData = JSON.parse(textError); // Then try to parse if it might be JSON
      } catch (e) {
        console.error(
          `[clientJournalService] Could not parse error response as JSON for ${apiUrl}, or response was not JSON.`,
          e
        );
        // errorData.message remains the status text
      }
      console.error(
        "[clientJournalService] Error fetching all journals for admin restriction (non-ok response):",
        errorData
      );
      throw new Error(
        errorData?.message || `Failed to fetch: ${response.statusText}`
      );
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
    throw error; // Re-throw to be caught by TanStack Query
  }
}
