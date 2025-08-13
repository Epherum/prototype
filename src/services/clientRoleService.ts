//src/services/clientRoleService.ts
import {
  RoleWithPermissionsClient,
  PermissionClient,
  RoleClient,
} from "@/lib/types/models.client";
import {
  CreateRolePayload,
  UpdateRolePayload,
} from "@/lib/schemas/role.schema";
import {
  Permission as PrismaPermission,
  Role as PrismaRole,
} from "@prisma/client";

const API_BASE_URL = "/api/roles";

// --- Mapper Functions (for consistency, even if they are identity functions) ---
function mapToRoleWithPermissionsClient(raw: any): RoleWithPermissionsClient {
  return raw; // Prisma types match client types here
}

function mapToPermissionClient(raw: PrismaPermission): PermissionClient {
  return raw;
}

// --- API Functions ---

export async function fetchAllRoles(): Promise<RoleWithPermissionsClient[]> {
  const response = await fetch(API_BASE_URL);
  if (!response.ok) throw new Error("Failed to fetch roles");
  const rawRoles = await response.json();
  return rawRoles.map(mapToRoleWithPermissionsClient);
}

export async function fetchAllPermissions(): Promise<PermissionClient[]> {
  const response = await fetch("/api/permissions");
  if (!response.ok) throw new Error("Failed to fetch permissions");
  const rawPermissions = await response.json();
  return rawPermissions.map(mapToPermissionClient);
}

export async function createRole(
  payload: CreateRolePayload
): Promise<RoleWithPermissionsClient> {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to create role");
  }
  return response.json();
}

export async function updateRole(
  roleId: string,
  payload: UpdateRolePayload
): Promise<RoleWithPermissionsClient> {
  const response = await fetch(`${API_BASE_URL}/${roleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to update role");
  }
  return response.json();
}

export async function deleteRole(roleId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/${roleId}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to delete role");
  }
}
