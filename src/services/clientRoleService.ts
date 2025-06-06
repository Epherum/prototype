// src/services/clientRoleService.ts
import type { Role } from "@prisma/client"; // Or a client-specific Role type

/**
 * Fetches roles available within the authenticated admin's company.
 * These roles can be assigned to new users.
 * @returns An array of Role objects.
 * @throws Error if the API request fails.
 */
export async function fetchCompanyRoles(): Promise<Role[]> {
  const response = await fetch("/api/roles/company-roles", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = {
        message: `Failed to fetch company roles: ${response.statusText} (No JSON error body)`,
      };
    }
    console.error("Error fetching company roles:", errorData);
    throw new Error(
      errorData?.message ||
        `Failed to fetch company roles: ${response.statusText}`
    );
  }

  return response.json();
}
