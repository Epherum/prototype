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
    throw new Error(
      error.message || "Failed to create journal-partner-good link"
    );
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
