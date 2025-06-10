// src/services/clientUserService.ts
import type { User, UserRole, Role } from "@prisma/client";
import type { CreateUserPayloadRoleAssignment } from "@/app/services/userService";

// Client-side payload for creating a user
export interface CreateUserClientPayload {
  name: string;
  email: string;
  password: string; // Required for creation
  roleAssignments: CreateUserPayloadRoleAssignment[];
}

// Client-side payload for updating a user
export interface UpdateUserClientPayload {
  name: string;
  email: string;
  password?: string; // Optional for updates
  roleAssignments: CreateUserPayloadRoleAssignment[];
}

// Define a richer type for the user object we get back from the API
export type UserWithRoles = User & {
  userRoles: (UserRole & {
    role: Role;
  })[];
};

// --- FUNCTIONS ---

export async function createUser(
  userData: CreateUserClientPayload
): Promise<User> {
  // ... your existing createUser function (no changes needed) ...
  const response = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to create user");
  }
  return response.json();
}

// NEW: Function to update a user
export async function updateUser(
  userId: string,
  userData: UpdateUserClientPayload
): Promise<User> {
  const response = await fetch(`/api/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update user");
  }
  return response.json();
}

// NEW: Function to fetch a single user's details for the edit form
export async function fetchUserById(userId: string): Promise<UserWithRoles> {
  const response = await fetch(`/api/users/${userId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch user details");
  }
  return response.json();
}
