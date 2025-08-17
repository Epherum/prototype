// src/hooks/usePermissions.ts
import { useAppStore } from "@/store/appStore";
import { useMemo } from "react";

type PermissionQuery = {
  action: string;
  resource: string;
};

/**
 * A hook to check if the current user has a specific permission.
 * Reads the user's roles and permissions from the global Zustand store.
 *
 * @param {PermissionQuery} query - The permission to check for, e.g., { action: 'CREATE', resource: 'PARTNER' }.
 * @returns {{ can: boolean }} An object with a boolean `can` property indicating if the permission is granted.
 */
export const usePermissions = (query: PermissionQuery) => {
  const user = useAppStore((state) => state.user);

  const can = useMemo(() => {
    if (!user?.roles || user.roles.length === 0) {
      return false;
    }

    const requiredAction = query.action.toUpperCase();
    const requiredResource = query.resource.toUpperCase();

    // Iterate through each role and its permissions
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        if (
          permission.action.toUpperCase() === requiredAction &&
          permission.resource.toUpperCase() === requiredResource
        ) {
          return true; // Permission found
        }
      }
    }

    return false; // Permission not found in any role
  }, [user, query.action, query.resource]);

  return { can };
};
