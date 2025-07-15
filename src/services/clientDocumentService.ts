// src/services/clientDocumentService.ts
import type {
  PaginatedDocumentsResponse,
  Document,
  CreateDocumentClientData,
  UpdateDocumentClientData,
} from "@/lib/types";

export async function fetchDocuments(
  partnerId: string
): Promise<PaginatedDocumentsResponse> {
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
      // Ignore JSON parse error
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export async function createDocument(
  data: CreateDocumentClientData
): Promise<Document> {
  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  return response.json();
}

export async function getDocumentById(id: string): Promise<Document> {
  const response = await fetch(`/api/documents/${id}`);
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error fetching document details" }));
    throw new Error(
      errorData.message ||
        `Failed to fetch document details: ${response.statusText}`
    );
  }
  return response.json();
}

export async function updateDocument({
  id,
  data,
}: {
  id: string;
  data: UpdateDocumentClientData;
}): Promise<Document> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error updating document" }));
    throw new Error(
      errorData.message || `Failed to update document: ${response.statusText}`
    );
  }
  return response.json();
}

export async function deleteDocument(id: string): Promise<boolean> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error deleting document" }));
    throw new Error(
      errorData.message || `Failed to delete document: ${response.statusText}`
    );
  }
  return true;
}

/**
 * Sends a request to the backend to create multiple documents in bulk.
 * @param data An array of document creation payloads.
 * @returns A promise that resolves to a success response.
 */
export async function createBulkDocuments(
  data: CreateDocumentClientData[]
): Promise<{ success: boolean; createdCount: number }> {
  const response = await fetch("/api/documents/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents: data }),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error during bulk creation" }));
    throw new Error(
      errorData.message || `Failed to create documents: ${response.statusText}`
    );
  }

  return response.json();
}
