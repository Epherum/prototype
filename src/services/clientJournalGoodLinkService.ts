// src/services/clientJournalGoodLinkService.ts
import type {
  CreateJournalGoodLinkClientData,
  JournalGoodLinkClient,
  JournalGoodLinkWithDetails,
} from "@/lib/types"; // We'll define/update these types next

export async function createJournalGoodLink(
  data: CreateJournalGoodLinkClientData
): Promise<JournalGoodLinkClient> {
  const payload = {
    ...data,
    // goodId will be sent as string from client, backend Zod schema handles BigInt conversion
  };

  const response = await fetch("/api/journal-good-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: "Unknown error creating journal-good link",
    }));
    throw new Error(
      errorData.message ||
        `Failed to create journal-good link: ${response.statusText}`
    );
  }
  const newLink = await response.json();
  // Ensure IDs from response are strings
  return {
    ...newLink,
    id: String(newLink.id),
    goodId: String(newLink.goodId),
    journalId: String(newLink.journalId),
  };
}

export async function deleteJournalGoodLink(
  linkId: string
): Promise<{ message: string }> {
  const response = await fetch(`/api/journal-good-links/${linkId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Unknown error deleting journal-good link ID ${linkId}`,
    }));
    throw new Error(
      errorData.message || `Failed to delete link: ${response.statusText}`
    );
  }
  return response.json();
}

// Fetches all journals a specific good is linked to, with journal details
export async function fetchJournalLinksForGood(
  goodId: string
): Promise<JournalGoodLinkWithDetails[]> {
  const response = await fetch(`/api/goods/${goodId}/journal-links`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Failed to fetch journal links for good ${goodId}`,
    }));
    throw new Error(errorData.message || "Failed to fetch journal links");
  }
  const links: JournalGoodLinkWithDetails[] = await response.json();
  return links;
}
