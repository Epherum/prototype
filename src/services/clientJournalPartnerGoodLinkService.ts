// src/services/clientJournalPartnerGoodLinkService.ts
import {
  CreateJournalPartnerGoodLinkClientData,
  JournalPartnerGoodLinkClient,
} from "@/lib/types";
// Import the configured JSONbig from your utility
import { parse as JSONbigParse } from "@/app/utils/jsonBigInt"; // Assuming your util exports it as 'parse'

const API_BASE_URL = "/api/journal-partner-good-links";

export async function createJournalPartnerGoodLink(
  data: CreateJournalPartnerGoodLinkClientData
): Promise<JournalPartnerGoodLinkClient> {
  console.log("Client Service: Creating JPGL with data:", data);
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // JSON.stringify will use your jsonBigIntReplacer if BigInts are present in `data`
    body: JSON.stringify(data), // Standard JSON.stringify is usually fine here IF data doesn't contain BigInts from client
    // If data CAN contain BigInts from client, use your stringify from jsonBigInt util
    // import { stringify as JSONbigStringify } from "@/app/utils/jsonBigInt";
    // body: JSONbigStringify(data),
  });

  const responseText = await response.text();
  if (!response.ok) {
    let errorData;
    try {
      errorData = JSONbigParse(responseText); // Use JSONbig.parse directly
    } catch (e) {
      errorData = {
        message: "Failed to parse error response: " + responseText,
      };
    }
    console.error("Error creating JPGL:", errorData);
    throw new Error(
      errorData.message || `HTTP error ${response.status}: ${responseText}`
    );
  }
  // Use the parse function from json-bigint library
  return JSONbigParse(responseText) as JournalPartnerGoodLinkClient;
}

export async function fetchJpgLinksForGoodAndJournalContext(
  goodId: string,
  journalId: string
): Promise<JournalPartnerGoodLinkClient[]> {
  const params = new URLSearchParams({ goodId, journalId });
  const response = await fetch(
    `${API_BASE_URL}/for-context?${params.toString()}`
  );
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to fetch JPG links for context: ${responseText}`);
  }
  // Use the parse function from json-bigint library
  return JSONbigParse(responseText) as JournalPartnerGoodLinkClient[];
}

export async function deleteJournalPartnerGoodLink(
  linkId: string
): Promise<{ message: string }> {
  console.log(`Client Service: Deleting JPGL with ID: ${linkId}`);
  const response = await fetch(`${API_BASE_URL}/${linkId}`, {
    method: "DELETE",
  });

  const responseText = await response.text(); // Get text first
  let responseData;

  if (!response.ok) {
    try {
      responseData = JSONbigParse(responseText); // Try to parse error as JSON
    } catch (e) {
      responseData = { message: responseText }; // Fallback to text if not JSON
    }
    console.error("Error deleting JPGL:", responseData);
    throw new Error(responseData.message || `HTTP error ${response.status}`);
  }

  try {
    responseData = JSONbigParse(responseText); // Parse success response as JSON
  } catch (e) {
    // If DELETE is successful but returns no body or non-JSON body
    // and your API guarantees a JSON message object on success:
    console.warn(
      "Successful DELETE but response was not valid JSON:",
      responseText
    );
    responseData = {
      message: "Operation successful, but response format was unexpected.",
    };
    // If your API on successful DELETE might return empty or non-JSON, handle that:
    if (response.status === 200 || response.status === 204) {
      // 204 No Content
      // Your current API returns JSON with a message for successful DELETE
    } else {
      // This path should ideally not be hit if response.ok was true
    }
  }
  return responseData;
}

// And other fetch functions like fetchJpgLinksForJournalPartnerLink
export async function fetchJpgLinksForJournalPartnerLink(
  journalPartnerLinkId: string
): Promise<JournalPartnerGoodLinkClient[]> {
  const response = await fetch(
    `${API_BASE_URL}?journalPartnerLinkId=${journalPartnerLinkId}`
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch JPG links for JPL ${journalPartnerLinkId}`
    );
  }
  const responseText = await response.text();
  return JSONbigParse(responseText) as JournalPartnerGoodLinkClient[];
}
