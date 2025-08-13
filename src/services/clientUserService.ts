//src/services/clientUserService.ts
import { UserWithRolesClient, UserClient } from "@/lib/types/models.client";
import {
  CreateUserPayload,
  UpdateUserPayload,
} from "@/lib/schemas/user.schema";
import { User as PrismaUser } from "@prisma/client";

const API_BASE_URL = "/api/users";

// --- Mapper Function ---
function mapToUserClient(raw: PrismaUser): UserClient {
  return raw; // Prisma type matches client type
}
function mapToUserWithRolesClient(raw: any): UserWithRolesClient {
  return raw; // Prisma type structure matches client type structure
}

// --- API Functions ---

export async function fetchAllUsers(): Promise<UserWithRolesClient[]> {
  const response = await fetch(API_BASE_URL);
  if (!response.ok) throw new Error("Failed to fetch users");
  const rawUsers = await response.json();
  return rawUsers.map(mapToUserWithRolesClient);
}

export async function fetchUserById(
  userId: string
): Promise<UserWithRolesClient> {
  const response = await fetch(`${API_BASE_URL}/${userId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch user details");
  }
  return response.json();
}

export async function createUser(
  payload: CreateUserPayload
): Promise<UserClient> {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to create user");
  }
  const rawUser: PrismaUser = await response.json();
  return mapToUserClient(rawUser);
}

export async function updateUser(
  userId: string,
  payload: UpdateUserPayload
): Promise<UserClient> {
  const response = await fetch(`${API_BASE_URL}/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to update user");
  }
  const rawUser: PrismaUser = await response.json();
  return mapToUserClient(rawUser);
}

export async function deleteUser(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/${userId}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to delete user");
  }
}
