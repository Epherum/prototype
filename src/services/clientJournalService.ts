// src/services/clientJournalService.ts
import type { AccountNodeData, Journal } from "@/lib/types"; // Assuming Journal is the flat type from API / Prisma
// Add Pick from Prisma Client if you want to be more specific, or define a simpler type
import type { Journal as PrismaJournal } from "@prisma/client";

// Helper function to build the tree structure (Keep your existing buildTree function)
// ... your existing buildTree function ...
function buildTree(journals: Journal[]): AccountNodeData[] {
  const journalMap: Record<
    string,
    AccountNodeData & { childrenFromApi?: Journal[] }
  > = {};
  const tree: AccountNodeData[] = [];

  journals.forEach((journal) => {
    journalMap[journal.id] = {
      ...journal,
      name: journal.name,
      code: journal.id,
      children: [],
    };
  });

  journals.forEach((journal) => {
    if (journal.parentId && journalMap[journal.parentId]) {
      if (!journalMap[journal.parentId].children) {
        journalMap[journal.parentId].children = [];
      }
      journalMap[journal.parentId].children?.push(journalMap[journal.id]);
    } else {
      tree.push(journalMap[journal.id]);
    }
  });

  const sortChildren = (nodes: AccountNodeData[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        sortChildren(node.children);
      }
    });
  };
  sortChildren(tree);

  return tree;
}

// (Keep your existing fetchJournalHierarchy, createJournalEntry, deleteJournalEntry, etc.)
// ... your existing functions ...
export async function fetchJournalHierarchy(
  restrictedTopLevelJournalId?: string | null // Optional parameter
): Promise<AccountNodeData[]> {
  let apiUrl = "/api/journals";
  const params = new URLSearchParams();

  if (restrictedTopLevelJournalId) {
    // If a user is restricted, their "root" is this journal.
    // The client will then fetch children of this root as needed.
    // So, we ask the API for this specific journal and its direct children initially,
    // or tell the API to give us the hierarchy starting from this point.
    // For now, let's assume `useJournalManager` will handle subsequent child fetches.
    // This call aims to get the root of the user's view.
    // Option 1: fetch only the restricted root(s) by default if a restriction exists.
    // The API /api/journals GET needs to be adjusted to handle `restrictedTopLevelJournalId` param
    // to return data appropriately (e.g., the journal itself and its immediate children, or the whole sub-tree).
    // For now, let's assume the API `/api/journals?root=true&restrictedTopLevelJournalId=ID`
    // will return the restricted journal as the root.
    params.append("root", "true"); // We want the root of *their* accessible tree
    params.append("restrictedTopLevelJournalId", restrictedTopLevelJournalId);
    console.log(
      `Fetching restricted journal hierarchy for: ${restrictedTopLevelJournalId}`
    );
  } else {
    // For unrestricted users, fetch all journals to build the complete tree.
    // This was the original behavior.
    console.log("Fetching complete journal hierarchy for unrestricted user.");
  }
  if (params.toString()) {
    apiUrl += `?${params.toString()}`;
  }

  const response = await fetch(apiUrl);

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error fetching journals" }));
    throw new Error(
      errorData.message ||
        `Failed to fetch journal hierarchy: ${response.statusText}`
    );
  }

  const flatJournals: Journal[] = await response.json();
  const hierarchy = buildTree(flatJournals);
  console.log("Fetched and built journal hierarchy:", hierarchy);
  return hierarchy;
}

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

// Ensure the ID type matches what's expected by the API route for deletion (e.g., string for journal.id)
export async function deleteJournalEntry(journalId: string): Promise<any> {
  // The API endpoint for deleting a specific journal is /api/journals/[id]
  // Your current code calls /api/journals/${journalId} which is fine if [id] is journals/[journalId]
  const response = await fetch(`/api/journals/${journalId}`, {
    // This assumes you have a route like /api/journals/[journalId]/route.ts for DELETE
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
  partnerId: string // Assuming partnerId is string after BigInt conversion if needed client-side
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
  goodId: string // Assuming goodId is string after BigInt conversion
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

// --- NEW FUNCTION ---
// Type for the journals returned for admin selection (simpler than full Journal)
export interface TopLevelJournalAdminSelection
  extends Pick<PrismaJournal, "id" | "name" | "companyId"> {}

/**
 * Fetches top-level journals for the authenticated admin's company.
 * Used for populating a dropdown for journal restriction assignment.
 * @returns An array of simple journal objects (id, name, companyId).
 * @throws Error if the API request fails.
 */
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
