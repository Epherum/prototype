// src/lib/permissions.ts

import { ExtendedUser } from "./authOptions";

/**
 * Checks if a user has a specific permission by checking for an action on a resource.
 * The check is case-insensitive.
 *
 * @param user - The user object from the session, containing their roles and permissions.
 * @param action - The action to check for (e.g., 'CREATE', 'MANAGE').
 * @param resource - The resource the action applies to (e.g., 'PARTNER', 'USERS').
 * @returns {boolean} - True if the user has the permission, false otherwise.
 */
export const hasPermission = (
  user: ExtendedUser | undefined | null,
  action: string,
  resource: string
): boolean => {
  if (!user?.roles) {
    return false;
  }

  const requiredAction = action.toUpperCase();
  const requiredResource = resource.toUpperCase();

  // Iterate through each role the user has
  for (const role of user.roles) {
    // Check if any permission in that role matches the required action and resource
    // The user's original code and the error message confirm that 'p' is the permission object itself.
    if (
      role.permissions.some(
        (p) =>
          // BEFORE (Incorrect):
          // p.permission.action.toUpperCase() === requiredAction &&
          // p.permission.resource.toUpperCase() === requiredResource

          // AFTER (Correct):
          p.action.toUpperCase() === requiredAction &&
          p.resource.toUpperCase() === requiredResource
      )
    ) {
      return true; // Permission found, no need to check further
    }
  }

  return false; // No matching permission was found in any role
};
