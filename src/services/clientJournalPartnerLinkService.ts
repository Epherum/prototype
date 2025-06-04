// src/services/clientJournalPartnerLinkService.ts
import type {
  CreateJournalPartnerLinkClientData,
  JournalPartnerLinkClient,
  JournalPartnerLinkWithDetails, // This type should match JournalLinkWithDetailsClientResponse
} from "@/lib/types";

export async function createJournalPartnerLink(
  data: CreateJournalPartnerLinkClientData
): Promise<JournalPartnerLinkClient> {
  // The backend expects partnerId as BigInt, but the createLinkSchema preprocesses strings/numbers.
  // Dates are sent as ISO strings; the backend transforms them.
  const payload = {
    ...data,
    // Ensure partnerId is sent as a string if your form provides it that way,
    // backend Zod schema will handle BigInt conversion with preprocess.
    // If your form directly gives a BigInt-like string, it's fine.
  };

  const response = await fetch("/api/journal-partner-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: "Unknown error creating journal-partner link",
    }));
    throw new Error(
      errorData.message || `Failed to create link: ${response.statusText}`
    );
  }
  const newLink = await response.json();
  // Ensure IDs from response are strings
  return {
    ...newLink,
    id: String(newLink.id),
    partnerId: String(newLink.partnerId), // Assuming backend returns partnerId as BigInt-string
  };
}

export async function deleteJournalPartnerLink(
  linkId: string
): Promise<{ message: string }> {
  const response = await fetch(`/api/journal-partner-links/${linkId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Unknown error deleting link ID ${linkId}`,
    }));
    throw new Error(
      errorData.message || `Failed to delete link: ${response.statusText}`
    );
  }
  return response.json();
}

// UPDATED FUNCTION: Fetches links with details using the new endpoint
export async function fetchJournalLinksForPartner(
  partnerId: string
): Promise<JournalPartnerLinkWithDetails[]> {
  const response = await fetch(`/api/partners/${partnerId}/journal-links`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Failed to fetch links for partner ${partnerId}`,
    }));
    throw new Error(errorData.message || "Failed to fetch links");
  }
  const links: JournalPartnerLinkWithDetails[] = await response.json();
  // The backend should already format IDs as strings and provide the necessary details.
  // No complex client-side mapping should be needed if the backend does its job.
  return links;
}

export const fetchJplByContext = async (
  journalId: string,
  partnerId: string
): Promise<JournalPartnerLinkClient | null> => {
  const response = await fetch(
    `/api/journal-partner-links/findByContext?journalId=${encodeURIComponent(
      journalId
    )}&partnerId=${encodeURIComponent(partnerId)}`
  );
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch JPL by context: ${response.statusText}`);
  }
  return response.json();
};
