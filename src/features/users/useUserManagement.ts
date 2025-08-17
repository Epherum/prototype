// src/features/users/useUserManagement.ts

import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userKeys, roleKeys } from "@/lib/queryKeys";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useJournalManager } from "@/features/journals/useJournalManager";
// ✨ MODIFIED: Import new, correct types from schemas and client models.
import {
  CreateUserPayload,
  UpdateUserPayload,
} from "@/lib/schemas/user.schema";
import {
  createUser,
  updateUser,
  fetchUserById,
} from "@/services/clientUserService";
import { fetchAllRoles } from "@/services/clientRoleService";
import type { RoleWithPermissionsClient } from "@/lib/types/models.client";
import type { UserWithRolesClient } from "@/lib/types/models.client";
import type { AccountNodeData } from "@/lib/types/ui";

interface RoleAssignmentFormState {
  roleId: string;
  roleName?: string;
}

export interface UserManagementFormState {
  id?: string;
  name: string;
  email: string;
  password?: string;
  roleAssignments: RoleAssignmentFormState[];
  restrictedTopLevelJournalId: string | null;
}

const initialFormState: UserManagementFormState = {
  name: "",
  email: "",
  password: "",
  roleAssignments: [],
  restrictedTopLevelJournalId: null,
};

// Helper function to find a specific journal node in the hierarchy
function findNodeById(
  nodes: AccountNodeData[],
  id: string
): AccountNodeData | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function useUserManagement(
  userIdToEdit?: string,
  onSuccess?: () => void,
  enabled: boolean = true
) {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const isEditMode = !!userIdToEdit;

  // Fetch the FULL journal hierarchy from the base manager
  const {
    hierarchyData: fullJournalHierarchy,
    isJournalDataLoading: isLoadingJournals,
  } = useJournalManager();

  const [formState, setFormState] =
    useState<UserManagementFormState>(initialFormState);
  const [showPassword, setShowPassword] = useState(false);

  const isCurrentUserRestricted = !!currentUser?.restrictedTopLevelJournalId;

  // --- REFINED: Filter the assignable journals based on the current admin's restriction ---
  const assignableJournals = useMemo(() => {
    if (!fullJournalHierarchy) return [];
    if (!isCurrentUserRestricted) {
      return fullJournalHierarchy; // Unrestricted admin sees everything
    }
    // Restricted admin sees only their own sub-tree
    const adminJournalRoot = findNodeById(
      fullJournalHierarchy,
      currentUser.restrictedTopLevelJournalId!
    );
    return adminJournalRoot ? [adminJournalRoot] : [];
  }, [fullJournalHierarchy, isCurrentUserRestricted, currentUser]);

  // ✨ MODIFIED: The query will now return the correct `UserWithRolesClient` type.
  const { data: userToEditData, isLoading: isLoadingUserToEdit } = useQuery({
    queryKey: userKeys.detail(userIdToEdit!),
    queryFn: (): Promise<UserWithRolesClient> => fetchUserById(userIdToEdit!),
    enabled: isEditMode,
  });

  // ✨ MODIFIED: The query now returns the correct `RoleWithPermissionsClient[]` type.
  const { data: assignableRoles, isLoading: isLoadingRoles } = useQuery({
    queryKey: roleKeys.all,
    queryFn: (): Promise<RoleWithPermissionsClient[]> => fetchAllRoles(),
    enabled: enabled, // Only fetch when enabled to avoid 403 errors
  });

  // ✨ MODIFIED: Use the correct Zod-inferred payload types.
  const mutation = useMutation({
    mutationFn: (data: {
      id?: string;
      payload: CreateUserPayload | UpdateUserPayload;
    }) => {
      return data.id
        ? updateUser(data.id, data.payload as UpdateUserPayload)
        : createUser(data.payload as CreateUserPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      if (userIdToEdit) {
        queryClient.invalidateQueries({
          queryKey: userKeys.detail(userIdToEdit),
        });
      }
      onSuccess?.();
    },
  });

  // --- FORM STATE MANAGEMENT ---
  useEffect(() => {
    // Populate form for editing an existing user
    if (isEditMode && userToEditData) {
      setFormState({
        id: userToEditData.id,
        name: userToEditData.name || "",
        email: userToEditData.email,
        password: "",
        restrictedTopLevelJournalId:
          userToEditData.restrictedTopLevelJournalId || null,
        roleAssignments: userToEditData.userRoles.map((ur) => ({
          roleId: ur.roleId,
          roleName: ur.role.name,
        })),
      });
    }
    // Set restriction for a new user if the creating admin is restricted
    else if (!isEditMode && isCurrentUserRestricted) {
      setFormState({
        ...initialFormState,
        restrictedTopLevelJournalId: currentUser.restrictedTopLevelJournalId,
      });
    }
    // Reset form for creating a new user by an unrestricted admin
    else {
      setFormState(initialFormState);
    }
  }, [isEditMode, userToEditData, isCurrentUserRestricted, currentUser]);

  const resetForm = useCallback(() => {
    const defaultState = isCurrentUserRestricted
      ? {
          ...initialFormState,
          restrictedTopLevelJournalId: currentUser.restrictedTopLevelJournalId,
        }
      : initialFormState;
    setFormState(defaultState);
    setShowPassword(false);
  }, [isCurrentUserRestricted, currentUser]);

  // --- HANDLERS ---
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    },
    []
  );

  const handleRoleSelectionChange = useCallback(
    (selectedRoleIds: string[]) => {
      setFormState((prev) => {
        const newAssignments = selectedRoleIds.map((roleId) => {
          const existing = prev.roleAssignments.find(
            (ra) => ra.roleId === roleId
          );
          if (existing) return existing;

          const role = assignableRoles?.find((r) => r.id === roleId);
          return {
            roleId,
            roleName: role?.name || "Unknown Role",
          };
        });
        return { ...prev, roleAssignments: newAssignments };
      });
    },
    [assignableRoles]
  );

  // REFACTORED: Simple handler for the single restriction dropdown
  const handleJournalRestrictionChange = useCallback(
    (journalId: string | null) => {
      setFormState((prev) => ({
        ...prev,
        restrictedTopLevelJournalId: journalId,
      }));
    },
    []
  );

  // ✨ MODIFIED: Build a payload that strictly matches the Zod schema.
  const handleSubmit = useCallback(async () => {
    if (formState.roleAssignments.length === 0) {
      alert("A user must have at least one role.");
      return;
    }

    // The user's single top-level journal restriction is applied to ALL role assignments.
    // This bridges the gap between the UI's single selection and the schema's per-role structure.
    const mappedRoleAssignments = formState.roleAssignments.map(
      ({ roleId }) => ({
        roleId: roleId,
        // The journalId for each assignment is the user's overall restriction.
        journalId: formState.restrictedTopLevelJournalId,
      })
    );

    const payload: CreateUserPayload | UpdateUserPayload = {
      name: formState.name,
      email: formState.email,
      // This now matches the schema: { roleAssignments: [...] }
      roleAssignments: mappedRoleAssignments,
      restrictedTopLevelJournalId: formState.restrictedTopLevelJournalId,
    };

    // Only include password if it's not empty. The Zod schema handles validation.
    if (formState.password) {
      // The `as any` is a small concession because the base type doesn't include password,
      // but it's added conditionally. The Zod schemas handle this correctly.
      (payload as any).password = formState.password;
    }

    mutation.mutate({ id: formState.id, payload });
  }, [formState, mutation]);

  return {
    formState,
    isEditMode,
    isLoading: isLoadingRoles || isLoadingJournals || isLoadingUserToEdit,
    isSubmitting: mutation.isPending,
    isSuccess: mutation.isSuccess,
    submissionError: mutation.error,
    resetMutation: mutation.reset,
    assignableRoles,
    assignableJournals,
    isCurrentUserRestricted,
    handleInputChange,
    handleRoleSelectionChange,
    handleJournalRestrictionChange,
    handleSubmit,
    resetForm,
    showPassword,
    setShowPassword,
  };
}
