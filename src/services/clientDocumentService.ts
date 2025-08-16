// src/services/clientDocumentService.ts

import {
  Document as PrismaDocument,
  DocumentLine as PrismaDocumentLine,
} from "@prisma/client";
import { DocumentClient, PaginatedResponse } from "@/lib/types/models.client";
import { GetAllDocumentsOptions } from "@/lib/types/serviceOptions";
import {
  CreateDocumentPayload,
  UpdateDocumentPayload,
  ApiCreateDocumentPayload,
} from "@/lib/schemas/document.schema";

// --- Mapper Function ---
function mapToDocumentClient(
  raw: PrismaDocument & { 
    lines?: (PrismaDocumentLine & { good?: any })[]; 
    partner?: any;
    journal?: any;
    _count?: { lines: number };
  }
): DocumentClient {
  return {
    ...raw,
    id: String(raw.id),
    partnerId: String(raw.partnerId),
    partner: raw.partner ? {
      id: String(raw.partner.id),
      name: raw.partner.name,
      registrationNumber: raw.partner.registrationNumber,
      taxId: raw.partner.taxId,
    } : undefined,
    journal: raw.journal ? {
      id: raw.journal.id,
      name: raw.journal.name,
    } : undefined,
    _count: raw._count ? {
      lines: raw._count.lines,
    } : undefined,
    lines: raw.lines?.map((line) => ({
      ...line,
      id: String(line.id),
      documentId: String(line.documentId),
      goodId: line.goodId ? String(line.goodId) : null,
      journalPartnerGoodLinkId: line.journalPartnerGoodLinkId
        ? String(line.journalPartnerGoodLinkId)
        : null,
    })),
  };
}

// --- NEW: Powerful Document Fetching ---
/**
 * The new, primary function for fetching documents, with powerful filtering.
 * Replaces the old, simple fetchDocuments.
 * @param options - Options for pagination and filtering by journals, partners, or goods.
 * @returns A promise resolving to a paginated list of documents.
 */
export async function getAllDocuments(
  options: GetAllDocumentsOptions
): Promise<PaginatedResponse<DocumentClient>> {
  const queryParams = new URLSearchParams();

  // Pagination
  if (options.take) queryParams.append("take", String(options.take));
  if (options.skip) queryParams.append("skip", String(options.skip));

  // Filtering
  if (options.filterByJournalIds && options.filterByJournalIds.length > 0)
    queryParams.append(
      "filterByJournalIds",
      options.filterByJournalIds.join(",")
    );
  if (options.filterByPartnerIds && options.filterByPartnerIds.length > 0)
    queryParams.append(
      "filterByPartnerIds",
      options.filterByPartnerIds.join(",")
    );
  if (options.filterByGoodIds && options.filterByGoodIds.length > 0)
    queryParams.append("filterByGoodIds", options.filterByGoodIds.join(","));

  const response = await fetch(`/api/documents?${queryParams.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch documents");
  }

  const result: { data: PrismaDocument[]; totalCount: number } =
    await response.json();

  return {
    data: result.data.map(mapToDocumentClient),
    totalCount: result.totalCount,
  };
}

// --- CRUD Operations ---

export async function createDocument(
  data: ApiCreateDocumentPayload
): Promise<DocumentClient> {
  // Log the payload being sent for debugging
  console.log("Creating document with payload:", JSON.stringify(data, null, 2));
  
  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    
    // Log the full error response for debugging
    console.error("Document creation failed:", error);
    
    throw new Error(error.message || "Failed to create document");
  }
  const newDoc: PrismaDocument = await response.json();
  return mapToDocumentClient(newDoc);
}

export async function getDocumentById(
  id: string
): Promise<DocumentClient | null> {
  const response = await fetch(`/api/documents/${id}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error("Failed to fetch document details");
  }
  // The API now returns the document with lines and goods included
  const doc: PrismaDocument & { lines: any[] } = await response.json();
  return mapToDocumentClient(doc);
}

export async function updateDocument(
  id: string,
  data: UpdateDocumentPayload
): Promise<DocumentClient> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update document");
  }
  const updatedDoc: PrismaDocument = await response.json();
  return mapToDocumentClient(updatedDoc);
}

export async function deleteDocument(id: string): Promise<boolean> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
  });
  return response.ok;
}
