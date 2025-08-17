//src/services/clientJournalService.ts
import { Journal as PrismaJournal } from "@prisma/client";
import { JournalClient } from "@/lib/types/models.client";
import { CreateJournalPayload } from "@/lib/schemas/journal.schema";
import { AccountNodeData } from "@/lib/types/ui"; // This UI-specific type can remain for now
import { buildTree } from "@/lib/helpers";
import { ROOT_JOURNAL_ID } from "@/lib/constants";

// --- Mapper Function ---
// Even though JournalClient = PrismaJournal, this is a good pattern to maintain.
function mapToJournalClient(raw: PrismaJournal): JournalClient {
  return raw; // No transformation needed as per models.client.ts
}

// --- Fetching Logic ---

/**
 * Fetches the journal hierarchy or a sub-hierarchy for a restricted user.
 * @param restrictedJournalId - The user's top-level journal permission.
 * @returns A promise resolving to the tree structure used by the UI.
 */
export async function fetchJournalHierarchy(
  restrictedJournalId?: string | null
): Promise<AccountNodeData[]> {
  const params = new URLSearchParams();
  if (restrictedJournalId && restrictedJournalId !== ROOT_JOURNAL_ID) {
    // This aligns with the new API spec: GET /api/journals?rootJournalId=...
    params.append("rootJournalId", restrictedJournalId);
  }

  const apiUrl = `/api/journals?${params.toString()}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error("Failed to fetch journal hierarchy");
  }

  const flatJournals: PrismaJournal[] = await response.json();
  const clientJournals = flatJournals.map(mapToJournalClient);

  // The buildTree helper now operates on the consistent JournalClient type.
  return buildTree(clientJournals);
}

/**
 * ✨ NEW: Fetches all available journals for selection in dropdowns.
 * Respects user's journal restrictions.
 * @param restrictedJournalId - The user's top-level journal permission.
 * @returns A promise resolving to a flat array of journals.
 */
export async function fetchJournalsForSelection(
  restrictedJournalId?: string | null
): Promise<JournalClient[]> {
  const params = new URLSearchParams();
  if (restrictedJournalId && restrictedJournalId !== ROOT_JOURNAL_ID) {
    params.append("rootJournalId", restrictedJournalId);
  }

  const apiUrl = `/api/journals?${params.toString()}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error("Failed to fetch journals for selection");
  }

  const flatJournals: PrismaJournal[] = await response.json();
  return flatJournals.map(mapToJournalClient);
}

/**
 * Finds all unique journals linked to one or more partners.
 * @param partnerIds - An array of partner IDs (string format).
 * @returns A promise resolving to an array of JournalClient objects.
 */
export async function fetchJournalsForPartners(
  partnerIds: string[]
): Promise<JournalClient[]> {
  if (!partnerIds || partnerIds.length === 0) return [];

  const params = new URLSearchParams({
    findByPartnerIds: partnerIds.join(","),
  });
  const response = await fetch(`/api/journals?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch journals for partners");
  }
  const journals: PrismaJournal[] = await response.json();
  return journals.map(mapToJournalClient);
}

/**
 * Finds all unique journals linked to one or more goods.
 * @param goodIds - An array of good IDs (string format).
 * @returns A promise resolving to an array of JournalClient objects.
 */
export async function fetchJournalsForGoods(
  goodIds: string[]
): Promise<JournalClient[]> {
  if (!goodIds || goodIds.length === 0) return [];

  const params = new URLSearchParams({ findByGoodIds: goodIds.join(",") });
  const response = await fetch(`/api/journals?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch journals for goods");
  }
  const journals: PrismaJournal[] = await response.json();
  return journals.map(mapToJournalClient);
}

/**
 * Finds all unique journals linked to a specific document through DocumentLine.
 * @param documentId - The document ID (string format).
 * @returns A promise resolving to an array of JournalClient objects.
 */
export async function fetchJournalsForDocument(
  documentId: string
): Promise<JournalClient[]> {
  if (!documentId) return [];

  const params = new URLSearchParams({ findByDocumentId: documentId });
  const response = await fetch(`/api/journals?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch journals for document");
  }
  const journals: PrismaJournal[] = await response.json();
  return journals.map(mapToJournalClient);
}

// --- CRUD Operations ---

export async function createJournal(
  journalData: CreateJournalPayload
): Promise<JournalClient> {
  const response = await fetch("/api/journals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(journalData),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to create journal");
  }
  const newJournal: PrismaJournal = await response.json();
  return mapToJournalClient(newJournal);
}

export async function deleteJournal(journalId: string): Promise<any> {
  const response = await fetch(`/api/journals/${journalId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete journal");
  }
  if (response.status === 204) {
    return { message: `Journal ${journalId} deleted successfully.` };
  }
  return response.json();
}
