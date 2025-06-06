// src/services/clientUserService.ts
import type { User } from "@prisma/client"; // Or a client-specific User type if you have one
import type { CreateUserPayloadRoleAssignment } from "@/app/services/userService"; // Import from backend service type

// This type should match the Zod schema in your /api/users/route.ts POST handler
export interface CreateUserClientPayload {
  name: string;
  email: string;
  password: string;
  roleAssignments: CreateUserPayloadRoleAssignment[]; // Re-using the backend type here is fine
}

/**
 * Creates a new user.
 * @param userData - The data for the new user.
 * @returns The created user object (excluding passwordHash).
 * @throws Error if the API request fails.
 */
export async function createUser(
  userData: CreateUserClientPayload
): Promise<Omit<User, "passwordHash">> {
  const response = await fetch("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = {
        message: `Failed to create user: ${response.statusText} (No JSON error body)`,
      };
    }
    console.error("Error creating user:", errorData);
    throw new Error(
      errorData?.message || `Failed to create user: ${response.statusText}`
    );
  }

  return response.json();
}
