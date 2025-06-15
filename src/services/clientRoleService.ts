// src/services/clientRoleService.ts

import { RoleWithPermissions } from "@/lib/types";
import { Permission } from "@prisma/client";

export type RoleClientPayload = {
  name: string;
  description?: string;
  permissionIds: string[];
};

export async function fetchAllRoles(): Promise<RoleWithPermissions[]> {
  const response = await fetch("/api/roles");
  if (!response.ok) throw new Error("Failed to fetch roles");
  return response.json();
}

export async function fetchAllPermissions(): Promise<Permission[]> {
  const response = await fetch("/api/permissions");
  if (!response.ok) throw new Error("Failed to fetch permissions");
  return response.json();
}

export async function createRole(
  payload: RoleClientPayload
): Promise<RoleWithPermissions> {
  const response = await fetch("/api/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to create role");
  }
  return response.json();
}

export async function updateRole(
  roleId: string,
  payload: RoleClientPayload
): Promise<RoleWithPermissions> {
  const response = await fetch(`/api/roles/${roleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update role");
  }
  return response.json();
}

export async function deleteRole(roleId: string): Promise<void> {
  const response = await fetch(`/api/roles/${roleId}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to delete role");
  }
}
