//src/services/clientGoodService.ts
import { GoodsAndService as PrismaGood } from "@prisma/client";
import { GoodClient, PaginatedResponse } from "@/lib/types/models.client";
import {
  CreateGoodPayload,
  UpdateGoodPayload,
} from "@/lib/schemas/good.schema";
import {
  GetAllItemsOptions,
  IntersectionFindOptions,
} from "@/lib/types/serviceOptions";

// --- Mapper Function ---
// Centralizes the transformation from the raw API response to the client-side model.
function mapToGoodClient(raw: PrismaGood): GoodClient {
  return {
    ...raw,
    id: String(raw.id),
  };
}

/**
 * The primary function for fetching goods, handling pagination and journal-based filtering.
 * Replaces the old complex fetchGoods function.
 * @param options - Options for pagination, filtering, and permissions.
 * @returns A promise resolving to a paginated list of goods.
 */
export async function getAllGoods(
  options: GetAllItemsOptions<any> // `any` because Prisma types aren't on client
): Promise<PaginatedResponse<GoodClient>> {
  const queryParams = new URLSearchParams();
  if (options.take) queryParams.append("take", String(options.take));
  if (options.skip) queryParams.append("skip", String(options.skip));

  // Journal filtering modes
  if (options.filterMode) {
    queryParams.append("filterMode", options.filterMode);
    if (options.selectedJournalIds) {
      queryParams.append(
        "selectedJournalIds",
        options.selectedJournalIds.join(",")
      );
    }
    if (options.permissionRootId) {
      queryParams.append("permissionRootId", options.permissionRootId);
    }
  }

  const response = await fetch(`/api/goods?${queryParams.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch goods");
  }

  const result: { data: PrismaGood[]; totalCount: number } =
    await response.json();

  return {
    data: result.data.map(mapToGoodClient),
    totalCount: result.totalCount,
  };
}

/**
 * Finds goods that are common to a set of partners, optionally within a journal context.
 * @param options - Options specifying partner and journal IDs for intersection.
 * @returns A promise resolving to a paginated list of common goods.
 */
export async function findGoodsForPartners(
  options: IntersectionFindOptions
): Promise<PaginatedResponse<GoodClient>> {
  if (!options.partnerIds || options.partnerIds.length === 0) {
    return { data: [], totalCount: 0 };
  }
  const queryParams = new URLSearchParams();
  queryParams.append("intersectionOfPartnerIds", options.partnerIds.join(","));
  if (options.journalIds && options.journalIds.length > 0) {
    queryParams.append("journalIds", options.journalIds.join(","));
  }

  const response = await fetch(`/api/goods?${queryParams.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to find goods for partners");
  }
  const result: { data: PrismaGood[]; totalCount: number } =
    await response.json();
  return {
    data: result.data.map(mapToGoodClient),
    totalCount: result.totalCount,
  };
}

// --- CRUD Operations ---

export async function createGood(
  goodData: CreateGoodPayload
): Promise<GoodClient> {
  const response = await fetch("/api/goods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(goodData),
  });
  if (!response.ok) throw new Error("Failed to create good/service");
  const newGood: PrismaGood = await response.json();
  return mapToGoodClient(newGood);
}

export async function updateGood(
  goodId: string,
  goodData: UpdateGoodPayload
): Promise<GoodClient> {
  const response = await fetch(`/api/goods/${goodId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(goodData),
  });
  if (!response.ok) throw new Error("Failed to update good/service");
  const updatedGood: PrismaGood = await response.json();
  return mapToGoodClient(updatedGood);
}

export async function deleteGood(goodId: string): Promise<{ message: string }> {
  const response = await fetch(`/api/goods/${goodId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete good/service");
  if (response.status === 204) {
    return { message: `Good/service ${goodId} deleted successfully.` };
  }
  return response.json();
}

export async function fetchGoodById(
  goodId: string
): Promise<GoodClient | null> {
  const response = await fetch(`/api/goods/${goodId}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch good/service ${goodId}`);
  }
  const good: PrismaGood = await response.json();
  return mapToGoodClient(good);
}
