//src/services/clientJournalGoodLinkService.ts
import { JournalGoodLink as PrismaJGL } from "@prisma/client";
import { JournalGoodLinkClient } from "@/lib/types/models.client";
import { CreateJournalGoodLinkPayload } from "@/lib/schemas/journalGoodLink.schema";

const API_BASE_URL = "/api/journal-good-links";

// --- Mapper Function ---
function mapToJglClient(raw: PrismaJGL): JournalGoodLinkClient {
  return {
    ...raw,
    id: String(raw.id),
    goodId: String(raw.goodId),
  };
}

/**
 * Fetches JournalGoodLink records based on query parameters.
 * @param params - Optional query parameters to filter links.
 * @returns A promise resolving to an array of links.
 */
export async function getJournalGoodLinks(params: {
  linkId?: string;
  journalId?: string;
  goodId?: string;
}): Promise<JournalGoodLinkClient[]> {
  const query = new URLSearchParams(params as Record<string, string>);
  const response = await fetch(`${API_BASE_URL}?${query.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch journal-good links");
  }
  const rawLinks: PrismaJGL[] = await response.json();
  return rawLinks.map(mapToJglClient);
}

/**
 * Creates a new link between a Journal and a Good.
 * @param data - The payload for creating the link.
 * @returns The newly created link.
 */
export async function createJournalGoodLink(
  data: CreateJournalGoodLinkPayload
): Promise<JournalGoodLinkClient> {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to create journal-good link");
  }
  const newLink: PrismaJGL = await response.json();
  return mapToJglClient(newLink);
}

/**
 * Deletes a JournalGoodLink by its unique ID.
 * @param linkId - The ID of the link to delete.
 */
export async function deleteJournalGoodLinkById(linkId: string): Promise<void> {
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
