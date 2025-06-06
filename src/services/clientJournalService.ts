// src/services/clientJournalService.ts
import type { AccountNodeData, Journal } from "@/lib/types";
import type { Journal as PrismaJournal } from "@prisma/client";

// ... (buildTree function remains the same) ...
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
      code: journal.id, // Assuming 'id' is used as 'code' if no separate code field
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
      // This node is a root (either a true root or the root of a sub-hierarchy)
      tree.push(journalMap[journal.id]);
    }
  });

  const sortChildren = (nodes: AccountNodeData[]) => {
    nodes.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        sortChildren(node.children);
      }
    });
  };
  sortChildren(tree);

  return tree;
}

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
