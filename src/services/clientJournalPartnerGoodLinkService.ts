//src/services/clientJournalPartnerGoodLinkService.ts
import { JournalPartnerGoodLink as PrismaJPGL } from "@prisma/client";
import { JournalPartnerGoodLinkClient } from "@/lib/types/models.client";
import { CreateJournalPartnerGoodLinkPayload } from "@/lib/schemas/journalPartnerGoodLink.schema";

const API_BASE_URL = "/api/journal-partner-good-links";

// --- Mapper Function ---
function mapToJpglClient(raw: PrismaJPGL): JournalPartnerGoodLinkClient {
  return {
    ...raw,
    id: String(raw.id),
    journalPartnerLinkId: String(raw.journalPartnerLinkId),
    goodId: String(raw.goodId),
  };
}

/**
 * Fetches JournalPartnerGoodLink records based on query parameters.
 * @param params - Optional query parameters to filter links.
 * @returns A promise resolving to an array of links.
 */
export async function getJournalPartnerGoodLinks(params: {
  linkId?: string;
  journalPartnerLinkId?: string;
  goodId?: string;
  journalId?: string; // For the context lookup
}): Promise<JournalPartnerGoodLinkClient[]> {
  const query = new URLSearchParams(params as Record<string, string>);
  const response = await fetch(`${API_BASE_URL}?${query.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch journal-partner-good links");
  }
  const rawLinks: PrismaJPGL[] = await response.json();
  return rawLinks.map(mapToJpglClient);
}

/**
 * Creates a new three-way link between a Journal, Partner, and Good.
 * This calls the orchestration service on the backend.
 * @param data - The payload for creating the link.
 * @returns The newly created link.
 */
export async function createJournalPartnerGoodLink(
  data: CreateJournalPartnerGoodLinkPayload
): Promise<JournalPartnerGoodLinkClient> {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    
    // Better error message with details  
    const errorMessage = error.message || "Failed to create journal-partner-good link";
    const errorDetails = error.errors ? JSON.stringify(error.errors) : "";
    throw new Error(`${errorMessage}${errorDetails ? ` - ${errorDetails}` : ""}`);
  }
  const newLink: PrismaJPGL = await response.json();
  return mapToJpglClient(newLink);
}

/**
 * Deletes a JournalPartnerGoodLink by its unique ID.
 * @param linkId - The ID of the link to delete.
 */
export async function deleteJournalPartnerGoodLinkById(
  linkId: string
): Promise<void> {
  const query = new URLSearchParams({ linkId });
  const response = await fetch(`${API_BASE_URL}?${query.toString()}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to delete link");
  }
}

/**
 * Creates multiple three-way links in a single batch operation.
 * @param linksData - Array of link creation payloads.
 * @returns Array of newly created links.
 */
export async function createBulkJournalPartnerGoodLinks(
  linksData: CreateJournalPartnerGoodLinkPayload[]
): Promise<JournalPartnerGoodLinkClient[]> {
  // Ensure all IDs are strings before sending to API
  const sanitizedLinks = linksData.map(link => ({
    ...link,
    journalId: String(link.journalId),
    partnerId: String(link.partnerId),
    goodId: String(link.goodId),
  }));

  const response = await fetch(`${API_BASE_URL}/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ links: sanitizedLinks }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    
    // Better error message with details
    const errorMessage = error.message || "Failed to create bulk journal-partner-good links";
    const errorDetails = error.errors ? JSON.stringify(error.errors) : "";
    throw new Error(`${errorMessage}${errorDetails ? ` - ${errorDetails}` : ""}`);
  }
  const newLinks: PrismaJPGL[] = await response.json();
  return newLinks.map(mapToJpglClient);
}

/**
 * Deletes multiple JournalPartnerGoodLinks by their IDs.
 * @param linkIds - Array of link IDs to delete.
 */
export async function deleteBulkJournalPartnerGoodLinks(
  linkIds: string[]
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkIds }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to delete bulk links");
  }
}

/**
 * Fetches existing links for a specific partner across multiple journals.
 * @param partnerId - The partner ID to find links for.
 * @param journalIds - Array of journal IDs to filter by.
 * @returns Array of existing links with expanded data.
 */
export async function getLinksForPartnerInJournals(
  partnerId: string,
  journalIds: string[]
): Promise<JournalPartnerGoodLinkClient[]> {
  const query = new URLSearchParams({
    partnerId,
    journalIds: journalIds.join(','),
    expandRelations: 'true'
  });
  
  const response = await fetch(`${API_BASE_URL}?${query.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch partner links in journals");
  }
  const rawLinks: PrismaJPGL[] = await response.json();
  return rawLinks.map(mapToJpglClient);
}

/**
 * Fetches existing links for a specific good across multiple journals.
 * @param goodId - The good ID to find links for.
 * @param journalIds - Array of journal IDs to filter by.
 * @returns Array of existing links with expanded data.
 */
export async function getLinksForGoodInJournals(
  goodId: string,
  journalIds: string[]
): Promise<JournalPartnerGoodLinkClient[]> {
  const query = new URLSearchParams({
    goodId,
    journalIds: journalIds.join(','),
    expandRelations: 'true'
  });
  
  const response = await fetch(`${API_BASE_URL}?${query.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch good links in journals");
  }
  const rawLinks: PrismaJPGL[] = await response.json();
  return rawLinks.map(mapToJpglClient);
}
