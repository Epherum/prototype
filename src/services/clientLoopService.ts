//src/services/clientLoopService.ts
import { JournalLoop, JournalLoopConnection } from "@prisma/client";
import {
  CreateLoopPayload,
  UpdateLoopPayload,
  LoopWithConnections
} from "@/lib/schemas/loop.schema";

// --- Mapper Functions ---
function mapToLoopClient(raw: JournalLoop): JournalLoop {
  return raw; // No transformation needed
}

function mapToLoopWithConnections(raw: LoopWithConnections): LoopWithConnections {
  return raw; // No transformation needed
}

// --- Fetching Logic ---

/**
 * Fetches all journal loops with optional filtering
 * @param status - Optional status filter (ACTIVE/INACTIVE/DRAFT)
 * @param search - Optional search term for loop names
 * @returns A promise resolving to an array of LoopWithConnections
 */
export async function fetchLoops(
  status?: "ACTIVE" | "INACTIVE" | "DRAFT",
  search?: string
): Promise<LoopWithConnections[]> {
  const params = new URLSearchParams();
  if (status) {
    params.append("status", status);
  }
  if (search && search.trim()) {
    params.append("search", search.trim());
  }

  const apiUrl = `/api/loops?${params.toString()}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Failed to fetch loops" }));
    throw new Error(error.message || "Failed to fetch loops");
  }

  const loops: LoopWithConnections[] = await response.json();
  return loops.map(mapToLoopWithConnections);
}

/**
 * Fetches a specific loop by ID with all connections
 * @param loopId - The loop ID to fetch
 * @returns A promise resolving to a LoopWithConnections object
 */
export async function fetchLoopById(
  loopId: string
): Promise<LoopWithConnections> {
  const response = await fetch(`/api/loops/${loopId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Loop not found");
    }
    const error = await response
      .json()
      .catch(() => ({ message: "Failed to fetch loop" }));
    throw new Error(error.message || "Failed to fetch loop");
  }

  const loop: LoopWithConnections = await response.json();
  return mapToLoopWithConnections(loop);
}

/**
 * Finds loops that contain a specific journal
 * @param journalId - The journal ID to search for
 * @returns A promise resolving to an array of LoopWithConnections
 */
export async function fetchLoopsForJournal(
  journalId: string
): Promise<LoopWithConnections[]> {
  if (!journalId) return [];

  const params = new URLSearchParams({
    findByJournalId: journalId,
  });
  const response = await fetch(`/api/loops?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch loops for journal");
  }
  const loops: LoopWithConnections[] = await response.json();
  return loops.map(mapToLoopWithConnections);
}

// --- CRUD Operations ---

/**
 * Creates a new journal loop
 * @param loopData - The loop data to create
 * @returns A promise resolving to the created LoopWithConnections
 */
export async function createLoop(
  loopData: CreateLoopPayload
): Promise<LoopWithConnections> {
  const response = await fetch("/api/loops", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loopData),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to create loop");
  }
  const newLoop: LoopWithConnections = await response.json();
  return mapToLoopWithConnections(newLoop);
}

/**
 * Updates an existing loop
 * @param loopId - The ID of the loop to update
 * @param updates - The updates to apply
 * @returns A promise resolving to the updated LoopWithConnections
 */
export async function updateLoop(
  loopId: string,
  updates: UpdateLoopPayload
): Promise<LoopWithConnections> {
  const response = await fetch(`/api/loops/${loopId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Loop not found");
    }
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to update loop");
  }
  const updatedLoop: LoopWithConnections = await response.json();
  return mapToLoopWithConnections(updatedLoop);
}

/**
 * Soft deletes a loop
 * @param loopId - The ID of the loop to delete
 * @returns A promise resolving to a success message
 */
export async function deleteLoop(loopId: string): Promise<{ message: string }> {
  const response = await fetch(`/api/loops/${loopId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Loop not found");
    }
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to delete loop");
  }

  return { message: `Loop ${loopId} deleted successfully.` };
}