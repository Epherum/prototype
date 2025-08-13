//src/services/clientJournalPartnerLinkService.ts
import {
  JournalPartnerLink as PrismaJPL,
  Journal,
  Partner,
} from "@prisma/client";
import {
  JournalPartnerLinkClient,
  JournalPartnerLinkWithDetailsClient,
} from "@/lib/types/models.client";
import { CreateJournalPartnerLinkPayload } from "@/lib/schemas/journalPartnerLink.schema";

const API_BASE_URL = "/api/journal-partner-links";

// --- Mapper Function ---
function mapToJplClient(
  raw: PrismaJPL & { journal?: Journal; partner?: Partner }
): JournalPartnerLinkWithDetailsClient {
  return {
    ...raw,
    id: String(raw.id),
    partnerId: String(raw.partnerId),
    // Map relations if they exist
    partner: raw.partner
      ? { ...raw.partner, id: String(raw.partner.id) }
      : undefined,
  };
}

/**
 * Fetches JournalPartnerLink records based on query parameters.
 * @param params - Optional query parameters to filter links.
 * @returns A promise resolving to an array of links.
 */
export async function getJournalPartnerLinks(params: {
  linkId?: string;
  journalId?: string;
  partnerId?: string;
}): Promise<JournalPartnerLinkClient[]> {
  const query = new URLSearchParams(params as Record<string, string>);
  const response = await fetch(`${API_BASE_URL}?${query.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch journal-partner links");
  }
  const rawLinks: PrismaJPL[] = await response.json();
  return rawLinks.map(mapToJplClient);
}

/**
 * Creates a new link between a Journal and a Partner.
 * @param data - The payload for creating the link.
 * @returns The newly created link.
 */
export async function createJournalPartnerLink(
  data: CreateJournalPartnerLinkPayload
): Promise<JournalPartnerLinkClient> {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to create journal-partner link");
  }
  const newLink: PrismaJPL = await response.json();
  return mapToJplClient(newLink);
}

/**
 * Deletes a JournalPartnerLink by its unique ID.
 * @param linkId - The ID of the link to delete.
 */
export async function deleteJournalPartnerLinkById(
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
