// src/services/clientJournalService.ts
import type { AccountNodeData, Journal } from "@/lib/types"; // Assuming Journal is the flat type from API / Prisma

// Helper function to build the tree structure
// This assumes each journal has an `id` and a `parentId`
function buildTree(journals: Journal[]): AccountNodeData[] {
  const journalMap: Record<
    string,
    AccountNodeData & { childrenFromApi?: Journal[] }
  > = {};
  const tree: AccountNodeData[] = [];

  // First pass: create nodes and map them by ID
  journals.forEach((journal) => {
    journalMap[journal.id] = {
      ...journal, // Spread all properties from the API response
      name: journal.name, // Ensure name is present
      code: journal.id, // Assuming 'id' is used as 'code' in the hierarchy
      children: [], // Initialize children array
    };
  });

  // Second pass: link children to their parents
  journals.forEach((journal) => {
    if (journal.parentId && journalMap[journal.parentId]) {
      // Ensure the parent's children array exists
      if (!journalMap[journal.parentId].children) {
        journalMap[journal.parentId].children = [];
      }
      journalMap[journal.parentId].children?.push(journalMap[journal.id]);
    } else {
      // If no parentId or parent not found, it's a root node
      tree.push(journalMap[journal.id]);
    }
  });

  // Optional: Sort children at each level by ID/code if needed
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

export async function fetchJournalHierarchy(): Promise<AccountNodeData[]> {
  // We want all journals to build the tree client-side.
  // The API GET /api/journals (with no params) returns all journals.
  const response = await fetch("/api/journals");

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

  // Transform the flat list into a tree structure
  const hierarchy = buildTree(flatJournals);
  console.log("Fetched and built journal hierarchy:", hierarchy);
  return hierarchy;
}

// --- CRUD Operations for Journals (to be used by Home.tsx handlers) ---

export async function createJournalEntry(
  journalData: Omit<Journal, "children" | "parent">
): Promise<Journal> {
  // Omit if these are not part of CreateJournalData
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
  // DELETE might return 204 No Content or a confirmation message
  if (response.status === 204) {
    return { message: `Journal ${journalId} deleted successfully.` }; // Or just return undefined
  }
  return response.json();
}

export async function fetchJournalsLinkedToPartner(
  partnerId: string
): Promise<Journal[]> {
  if (!partnerId) return [];

  // Assuming the API returns Journal[] directly, not PaginatedJournalResponse
  // If it was paginated, we'd expect { data: Journal[], total: number }
  const response = await fetch(`/api/journals?linkedToPartnerId=${partnerId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Failed to fetch journals linked to partner ${partnerId}`,
    }));
    throw new Error(errorData.message || "Failed to fetch journals");
  }
  const journals: Journal[] = await response.json(); // Adjust if API returns {data: ...}
  return journals.map((j) => ({ ...j, id: String(j.id) })); // Ensure IDs are strings
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
  const journals: Journal[] = await response.json(); // API returns Journal[] directly
  return journals.map((j) => ({ ...j, id: String(j.id) })); // Ensure IDs are strings
}
