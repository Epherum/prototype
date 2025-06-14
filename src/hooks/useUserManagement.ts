// src/hooks/useUserManagement.ts

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore"; // Import the Zustand store
import {
  createUser,
  updateUser,
  fetchUserById,
  CreateUserClientPayload,
  UpdateUserClientPayload,
} from "@/services/clientUserService";
import { fetchCompanyRoles } from "@/services/clientRoleService";
import { fetchAllJournalsForAdminRestriction } from "@/services/clientJournalService";
import { useCurrentUser } from "./useCurrentUser";
import type { RoleWithPermissions } from "@/lib/types";
import type { JournalForAdminSelection } from "@/lib/helpers";

// Types remain the same
interface RoleAssignmentFormState {
  roleId: string;
  roleName?: string;
  restrictedTopLevelJournalId?: string | null;
  restrictedTopLevelJournalCompanyId?: string | null;
  restrictedJournalDisplayName?: string | null;
}

export interface UserManagementFormState {
  id?: string;
  name: string;
  email: string;
  password?: string;
  roleAssignments: RoleAssignmentFormState[];
}

const initialFormState: UserManagementFormState = {
  name: "",
  email: "",
  password: "",
  roleAssignments: [],
};

export function useUserManagement(userIdToEdit?: string) {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

  // Get the isAdmin flag from our global store
  const isAdmin = useAppStore((state) => state.auth.isAdmin);

  const [formState, setFormState] =
    useState<UserManagementFormState>(initialFormState);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const isEditMode = !!userIdToEdit;

  // --- DATA FETCHING (QUERIES) ---

  const { data: userToEditData, isLoading: isLoadingUserToEdit } = useQuery({
    queryKey: ["user", userIdToEdit],
    queryFn: () => fetchUserById(userIdToEdit!),
    enabled: isEditMode,
  });

  const { data: companyRoles, isLoading: isLoadingRoles } = useQuery<
    RoleWithPermissions[],
    Error
  >({
    queryKey: ["companyRoles"],
    queryFn: fetchCompanyRoles,
    enabled: isAdmin, // Also a good idea to only fetch roles if the user is an admin
    staleTime: 5 * 60 * 1000,
  });

  // --- THIS IS THE CORRECTED QUERY ---
  const { data: allCompanyJournalsData, isLoading: isLoadingJournals } =
    useQuery<JournalForAdminSelection[], Error>({
      queryKey: ["allCompanyJournalsForRestriction"],
      queryFn: fetchAllJournalsForAdminRestriction,
      // This query will now ONLY run if the logged-in user is an admin.
      enabled: isAdmin,
      staleTime: 10 * 60 * 1000,
    });

  // --- SECURITY: Filter roles the admin is allowed to assign ---
  const assignableRoles = useMemo(() => {
    if (!currentUser?.roles || !companyRoles) return [];
    const adminPermissions = new Set<string>();
    currentUser.roles.forEach((role) =>
      role.permissions.forEach((p) =>
        adminPermissions.add(`${p.action}:${p.resource}`)
      )
    );
    return companyRoles.filter((role) => {
      return role.permissions.every((p) => {
        const permissionString = `${p.permission.action}:${p.permission.resource}`;
        return adminPermissions.has(permissionString);
      });
    });
  }, [companyRoles, currentUser]);

  // --- DATA MUTATIONS (CREATE/UPDATE) ---

  const createUserMutation = useMutation({
    mutationFn: (userData: CreateUserClientPayload) => createUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      closeCreateUserModal(); // Close modal on success
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (userData: UpdateUserClientPayload) =>
      updateUser(userIdToEdit!, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user", userIdToEdit] });
      closeCreateUserModal(); // Close modal on success
    },
  });

  // --- FORM STATE MANAGEMENT ---

  useEffect(() => {
    if (isEditMode && userToEditData) {
      setFormState({
        id: userToEditData.id,
        name: userToEditData.name || "",
        email: userToEditData.email,
        password: "",
        roleAssignments: userToEditData.userRoles.map((ur) => ({
          roleId: ur.roleId,
          roleName: ur.role.name,
          restrictedTopLevelJournalId: ur.restrictedTopLevelJournalId,
          restrictedTopLevelJournalCompanyId:
            ur.restrictedTopLevelJournalCompanyId,
          restrictedJournalDisplayName: ur.restrictedTopLevelJournalId
            ? `ID: ${ur.restrictedTopLevelJournalId}`
            : null,
        })),
      });
    }
  }, [isEditMode, userToEditData]);

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
    resetForm();
    setIsCreateUserModalOpen(true);
  }, [resetForm]);

  const closeCreateUserModal = useCallback(() => {
    setIsCreateUserModalOpen(false);
    resetForm();
  }, [resetForm]);

  const handleSubmit = useCallback(async () => {
    if (formState.roleAssignments.length === 0) {
      console.error("Attempted to submit with no roles assigned.");
      alert("A user must have at least one role.");
      return;
    }

    const assignmentPayload = formState.roleAssignments.map((ra) => ({
      roleId: ra.roleId,
      restrictedTopLevelJournalId: ra.restrictedTopLevelJournalId || null,
      restrictedTopLevelJournalCompanyId:
        ra.restrictedTopLevelJournalCompanyId || null,
    }));

    const mutationToRun = isEditMode ? updateUserMutation : createUserMutation;
    const payload = {
      name: formState.name,
      email: formState.email,
      password: formState.password || undefined,
      roleAssignments: assignmentPayload,
    };

    try {
      await mutationToRun.mutateAsync(payload as any);
    } catch (error) {
      console.error("Submission failed", error);
      // Error will be available on mutation.error, no need to alert here
    }
  }, [formState, isEditMode, createUserMutation, updateUserMutation]);

  const mutation = isEditMode ? updateUserMutation : createUserMutation;

  return {
    formState,
    isEditMode,
    isLoading: isLoadingRoles || isLoadingJournals || isLoadingUserToEdit,
    isSubmitting: mutation.isPending,
    isSuccess: mutation.isSuccess,
    submissionError: mutation.error,
    resetMutation: mutation.reset,
    assignableRoles,
    allCompanyJournalsData,
    handleInputChange,
    handleRoleSelectionChange,
    handleJournalRestrictionChange,
    handleSubmit,
    resetForm,
    showPassword,
    setShowPassword,
    isCreateUserModalOpen,
    openCreateUserModal,
    closeCreateUserModal,
  };
}
