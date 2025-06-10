// src/services/clientRoleService.ts
import type { Role } from "@prisma/client"; // Or a client-specific Role type
import { RoleWithPermissions } from "@/lib/types";

/**
 * Fetches roles available within the authenticated admin's company.
 * These roles can be assigned to new users.
 * @returns An array of Role objects.
 * @throws Error if the API request fails.
 */
// The fetch function now explicitly PROMISES to return the correct type.
export const fetchCompanyRoles = async (): Promise<RoleWithPermissions[]> => {
  const response = await fetch("/api/roles/company-roles");
  if (!response.ok) {
    // It's good practice to try and parse a JSON error body
    const errorData = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || "Failed to fetch company roles");
  }
  return response.json();
};
