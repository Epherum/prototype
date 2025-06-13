// src/hooks/useUserManagement.ts
import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createUser,
  updateUser,
  fetchUserById, // We will create this
  CreateUserClientPayload,
  UpdateUserClientPayload,
} from "@/services/clientUserService";
import { fetchCompanyRoles } from "@/services/clientRoleService";
import { fetchAllJournalsForAdminRestriction } from "@/services/clientJournalService";
import { useCurrentUser } from "./useCurrentUser";
import type { RoleWithPermissions } from "@/lib/types";
import type { JournalForAdminSelection } from "@/lib/helpers";

// Types remain largely the same, but we make them reusable
interface RoleAssignmentFormState {
  roleId: string;
  roleName?: string;
  restrictedTopLevelJournalId?: string | null;
  restrictedTopLevelJournalCompanyId?: string | null;
  restrictedJournalDisplayName?: string | null;
}

export interface UserManagementFormState {
  id?: string; // For edit mode
  name: string;
  email: string;
  password?: string; // Optional for edit mode
  roleAssignments: RoleAssignmentFormState[];
}

const initialFormState: UserManagementFormState = {
  name: "",
  email: "",
  password: "",
  roleAssignments: [],
};

// The hook now accepts an optional userId for editing
export function useUserManagement(userIdToEdit?: string) {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser(); // Get the currently logged-in admin
  const [formState, setFormState] =
    useState<UserManagementFormState>(initialFormState);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const isEditMode = !!userIdToEdit;

  // --- DATA FETCHING (QUERIES) ---

  // 1. Fetch the user to edit (if in edit mode)
  const { data: userToEditData, isLoading: isLoadingUserToEdit } = useQuery({
    queryKey: ["user", userIdToEdit],
    queryFn: () => fetchUserById(userIdToEdit!),
    enabled: isEditMode, // Only run this query if we're editing
  });

  // 2. Fetch all available roles for the company
  const { data: companyRoles, isLoading: isLoadingRoles } = useQuery<
    RoleWithPermissions[],
    Error
  >({
    queryKey: ["companyRoles"],
    queryFn: fetchCompanyRoles,
    staleTime: 5 * 60 * 1000,
  });

  // 3. Fetch all journals for restriction selection (no change here)
  const { data: allCompanyJournalsData, isLoading: isLoadingJournals } =
    useQuery<JournalForAdminSelection[], Error>({
      queryKey: ["allCompanyJournalsForRestriction"],
      queryFn: fetchAllJournalsForAdminRestriction,
      staleTime: 5 * 60 * 1000,
    });

  // --- SECURITY: Filter roles the admin is allowed to assign ---
  const assignableRoles = useMemo(() => {
    // The guard clause is essential for when the data is loading
    if (!currentUser?.roles || !companyRoles) return [];

    // Create a Set of the admin's own permissions (from the flattened session token)
    const adminPermissions = new Set<string>();
    currentUser.roles.forEach((role) =>
      // `p` here is { action, resource }
      role.permissions.forEach((p) =>
        adminPermissions.add(`${p.action}:${p.resource}`)
      )
    );

    // Filter the company roles (which have a nested structure from the API)
    return companyRoles.filter((role) => {
      // An admin can assign a role if they possess EVERY permission that role requires.
      return role.permissions.every((p) => {
        // `p` here is RolePermission, so we access `p.permission`
        // THIS IS THE CORRECTED LOGIC
        const permissionString = `${p.permission.action}:${p.permission.resource}`;
        return adminPermissions.has(permissionString);
      });
    });
  }, [companyRoles, currentUser]);

  // --- DATA MUTATIONS (CREATE/UPDATE) ---

  const createUserMutation = useMutation({
    mutationFn: (userData: CreateUserClientPayload) => createUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] }); // Invalidate list of all users
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (userData: UpdateUserClientPayload) =>
      updateUser(userIdToEdit!, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] }); // Invalidate list
      queryClient.invalidateQueries({ queryKey: ["user", userIdToEdit] }); // Invalidate this specific user
    },
  });

  // --- FORM STATE MANAGEMENT ---

  // Effect to populate the form when editing a user
  useEffect(() => {
    if (isEditMode && userToEditData) {
      setFormState({
        id: userToEditData.id,
        name: userToEditData.name || "",
        email: userToEditData.email,
        password: "", // Password should be blank for editing
        roleAssignments: userToEditData.userRoles.map((ur) => ({
          roleId: ur.roleId,
          roleName: ur.role.name,
          restrictedTopLevelJournalId: ur.restrictedTopLevelJournalId,
          restrictedTopLevelJournalCompanyId:
            ur.restrictedTopLevelJournalCompanyId,
          // We need a way to fetch/find the display name if needed, or reconstruct it
          restrictedJournalDisplayName: ur.restrictedTopLevelJournalId
            ? `ID: ${ur.restrictedTopLevelJournalId}`
            : null,
        })),
      });
    }
  }, [isEditMode, userToEditData]);

  // --- HANDLERS (no change in their logic, just their context) ---

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    },
    []
  );

  const handleRoleSelectionChange = useCallback(
    (selectedRoleIds: string[]) => {
      setFormState((prev) => {
        const newAssignments: RoleAssignmentFormState[] = selectedRoleIds.map(
          (roleId) => {
            const existing = prev.roleAssignments.find(
              (ra) => ra.roleId === roleId
            );
            const role = companyRoles?.find((r) => r.id === roleId);
            return {
              roleId: roleId,
              roleName: role?.name || "Unknown Role",
              restrictedTopLevelJournalId:
                existing?.restrictedTopLevelJournalId || null,
              restrictedTopLevelJournalCompanyId:
                existing?.restrictedTopLevelJournalCompanyId || null,
              restrictedJournalDisplayName:
                existing?.restrictedJournalDisplayName || null,
            };
          }
        );
        return { ...prev, roleAssignments: newAssignments };
      });
    },
    [companyRoles]
  );

  const handleJournalRestrictionChange = useCallback(
    (
      roleId: string,
      journalId: string | null,
      journalCompanyId: string | null,
      displayName: string | null
    ) => {
      setFormState((prev) => ({
        ...prev,
        roleAssignments: prev.roleAssignments.map((a) =>
          a.roleId === roleId
            ? {
                ...a,
                restrictedTopLevelJournalId: journalId,
                restrictedTopLevelJournalCompanyId: journalCompanyId,
                restrictedJournalDisplayName: displayName,
              }
            : a
        ),
      }));
    },
    []
  );

  const resetForm = useCallback(() => {
    setFormState(initialFormState);
    setShowPassword(false);
  }, []);

  const openCreateUserModal = useCallback(() => {
    // Reset form state in case it was used for editing before
    resetForm();
    setIsCreateUserModalOpen(true);
  }, [resetForm]);

  const closeCreateUserModal = useCallback(() => {
    setIsCreateUserModalOpen(false);
    resetForm();
  }, [resetForm]);

  // Universal submit handler
  const handleSubmit = useCallback(async () => {
    if (formState.roleAssignments.length === 0) {
      console.error("Attempted to submit with no roles assigned.");
      return;
    }

    const assignmentPayload = formState.roleAssignments.map((ra) => ({
      roleId: ra.roleId,
      restrictedTopLevelJournalId: ra.restrictedTopLevelJournalId || null,
      restrictedTopLevelJournalCompanyId:
        ra.restrictedTopLevelJournalCompanyId || null,
    }));

    if (isEditMode) {
      const payload: UpdateUserClientPayload = {
        name: formState.name,
        email: formState.email,
        password: formState.password || undefined, // Send password only if it's been set
        roleAssignments: assignmentPayload,
      };
      await updateUserMutation.mutateAsync(payload);
    } else {
      const payload: CreateUserClientPayload = {
        name: formState.name,
        email: formState.email,
        password: formState.password!, // Password is required for creation
        roleAssignments: assignmentPayload,
      };
      await createUserMutation.mutateAsync(payload);
    }
  }, [formState, isEditMode, createUserMutation, updateUserMutation]);

  const mutation = isEditMode ? updateUserMutation : createUserMutation;

  return {
    formState,
    setFormState,
    isEditMode,
    isLoading: isLoadingRoles || isLoadingJournals || isLoadingUserToEdit,
    isSubmitting: mutation.isPending,
    isSuccess: mutation.isSuccess,
    submissionError: mutation.error,
    resetMutation: mutation.reset,

    // Data
    assignableRoles,
    allCompanyJournalsData,

    // Handlers
    handleInputChange,
    handleRoleSelectionChange,
    handleJournalRestrictionChange,
    handleSubmit,
    resetForm,

    // UI State
    showPassword,
    setShowPassword,
    isCreateUserModalOpen,
    // EXPORT THE NEW FUNCTION
    openCreateUserModal,
    closeCreateUserModal,
    // Remove the setter from the public API
    // setIsCreateUserModalOpen,
  };
}
