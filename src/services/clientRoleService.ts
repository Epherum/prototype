// src/services/clientRoleService.ts
import type { Permission } from "@prisma/client";
import type { RoleWithPermissions } from "@/lib/types";

/**
 * The data payload required for creating or updating a role.
 */
export interface ClientRolePayload {
  name: string;
  description?: string;
  permissionIds: string[];
}

/**
 * Fetches all roles in the system.
 * These roles can be assigned to new users.
 * @returns An array of Role objects with their permissions.
 * @throws Error if the API request fails.
 */
export const fetchAllRoles = async (): Promise<RoleWithPermissions[]> => {
  // The endpoint is now generic, not company-specific.
  const response = await fetch("/api/roles");
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || "Failed to fetch roles");
  }
  return response.json();
};

/**
 * Fetches the master list of all available permissions in the system.
 * @returns A promise that resolves to an array of all Permission records.
 * @throws Error if the API request fails.
 */
export const fetchAllPermissions = async (): Promise<Permission[]> => {
  const response = await fetch("/api/permissions");
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || "Failed to fetch permissions");
  }
  return response.json();
};

/**
 * Sends a request to create a new role.
 * @param roleData - The data for the new role.
 * @returns The newly created role with its permissions.
 * @throws Error if the API request fails.
 */
export const createRole = async (
  roleData: ClientRolePayload
): Promise<RoleWithPermissions> => {
  const response = await fetch("/api/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(roleData),
  });
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || "Failed to create role");
  }
  return response.json();
};

/**
 * Sends a request to update an existing role.
 * @param roleId - The ID of the role to update.
 * @param roleData - The updated data for the role.
 * @returns The updated role with its permissions.
 * @throws Error if the API request fails.
 */
export const updateRole = async (
  roleId: string,
  roleData: ClientRolePayload
): Promise<RoleWithPermissions> => {
  const response = await fetch(`/api/roles/${roleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(roleData),
  });
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || "Failed to update role");
  }
  return response.json();
};

/**
 * Sends a request to delete a role.
 * @param roleId - The ID of the role to delete.
 * @returns A confirmation message.
 * @throws Error if the API request fails.
 */
export const deleteRole = async (
  roleId: string
): Promise<{ message: string }> => {
  const response = await fetch(`/api/roles/${roleId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || "Failed to delete role");
  }
  if (response.status === 204) {
    return { message: `Role ${roleId} deleted successfully.` };
  }
  return response.json();
};
