import type {
  PaginatedDocumentsResponse,
  Document,
  CreateDocumentClientData,
} from "@/lib/types";

/**
 * Fetches documents for a specific partner.
 * In our application flow, documents are always viewed in the context of a selected partner.
 *
 * @param partnerId The ID of the partner whose documents are to be fetched.
 * @returns A promise that resolves to a paginated list of documents.
 */
export async function fetchDocuments(
  partnerId: string
): Promise<PaginatedDocumentsResponse> {
  // A partnerId is mandatory for this feature's context.
  if (!partnerId) {
    console.warn("[fetchDocuments] No partnerId provided. Returning empty.");
    return { data: [], total: 0 };
  }

  const queryParams = new URLSearchParams();
  queryParams.append("partnerId", partnerId);

  const response = await fetch(`/api/documents?${queryParams.toString()}`);

  if (!response.ok) {
    let errorMessage = `Failed to fetch documents: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      // Could not parse JSON, use the original status text.
    }
    throw new Error(errorMessage);
  }

  // The backend API serializes BigInts to strings, which matches our client-side types.
  const result: PaginatedDocumentsResponse = await response.json();
  return result;
}

/**
 * Sends a request to the backend to create a new document.
 * The payload contains the document header and an array of line items.
 *
 * @param data The data required to create a new document.
 * @returns A promise that resolves to the newly created document.
 */
export async function createDocument(
  data: CreateDocumentClientData
): Promise<Document> {
  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // JSON.stringify will handle the conversion of the data object,
    // including the nested lines array, into a JSON string.
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error creating document" }));
    throw new Error(
      errorData.message || `Failed to create document: ${response.statusText}`
    );
  }

  // The backend returns the complete new Document object upon success.
  const newDocument: Document = await response.json();
  return newDocument;
}
