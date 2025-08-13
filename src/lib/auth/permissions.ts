/**
 * This file is the single source of truth for all permissions in the application.
 * All parts of the system (seeding, API authorization) MUST use these definitions
 * to ensure consistency and type safety.
 */

// The master definition object. The keys are our Resources.
export const PERMISSION_DEFINITIONS = {
  USER: ["MANAGE"],
  ROLE: ["MANAGE"],
  PARTNER: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
  GOODS: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
  JOURNAL: ["CREATE", "READ", "UPDATE", "DELETE"],
  DOCUMENT: ["MANAGE"],
} as const; // 'as const' is crucial for TypeScript to infer the exact strings.

/**
 * A strongly-typed representation of a Resource.
 * It can ONLY be one of the keys from PERMISSION_DEFINITIONS.
 * e.g., 'USER' | 'ROLE' | 'PARTNER' | ...
 */
export type Resource = keyof typeof PERMISSION_DEFINITIONS;

/**
 * A strongly-typed representation of a permission object, used for authorization checks.
 * This is the type that withAuthorization and other functions should use.
 */
export type Permission = {
  action: string;
  resource: Resource;
};
