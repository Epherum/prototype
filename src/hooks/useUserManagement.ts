// src/hooks/useUserManagement.ts

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import {
  createUser,
  updateUser,
  fetchUserById,
  CreateUserClientPayload,
  UpdateUserClientPayload,
} from "@/services/clientUserService";
import { fetchAllRoles } from "@/services/clientRoleService";
import { fetchAllJournalsForAdminRestriction } from "@/services/clientJournalService";
import { useCurrentUser } from "./useCurrentUser";
import type { RoleWithPermissions } from "@/lib/types";

interface RoleAssignmentFormState {
  roleId: string;
  roleName?: string;
  restrictedTopLevelJournalId?: string | null;
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

  const { data: allRoles, isLoading: isLoadingRoles } = useQuery<
    RoleWithPermissions[],
    Error
  >({
    queryKey: ["allRoles"],
    queryFn: fetchAllRoles,
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allJournalsData, isLoading: isLoadingJournals } = useQuery<
    any[],
    Error
  >({
    queryKey: ["allJournalsForRestriction"],
    queryFn: fetchAllJournalsForAdminRestriction,
    enabled: isAdmin,
    staleTime: 10 * 60 * 1000,
  });

  // Security: Admins can only assign roles whose permissions are a subset of their own.
  const assignableRoles = useMemo(() => {
    if (!currentUser?.roles || !allRoles) return [];
    const adminPermissions = new Set<string>();
    currentUser.roles.forEach((role) =>
      role.permissions.forEach((p) =>
        adminPermissions.add(`${p.action}:${p.resource}`)
      )
    );
    return allRoles.filter((role) => {
      return role.permissions.every((p) => {
        const permissionString = `${p.permission.action}:${p.permission.resource}`;
        return adminPermissions.has(permissionString);
      });
    });
  }, [allRoles, currentUser]);

  // --- DATA MUTATIONS (CREATE/UPDATE) ---

  const createUserMutation = useMutation({
    mutationFn: (userData: CreateUserClientPayload) => createUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (userData: UpdateUserClientPayload) =>
      updateUser(userIdToEdit!, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user", userIdToEdit] });
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
          restrictedJournalDisplayName: ur.restrictedTopLevelJournalId
            ? `ID: ${ur.restrictedTopLevelJournalId}`
            : null,
        })),
      });
    } else {
      resetForm();
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
            const role = allRoles?.find((r) => r.id === roleId);
            return {
              roleId: roleId,
              roleName: role?.name || "Unknown Role",
              restrictedTopLevelJournalId:
                existing?.restrictedTopLevelJournalId || null,
              restrictedJournalDisplayName:
                existing?.restrictedJournalDisplayName || null,
            };
          }
        );
        return { ...prev, roleAssignments: newAssignments };
      });
    },
    [allRoles]
  );

  const handleJournalRestrictionChange = useCallback(
    (roleId: string, journalId: string | null, displayName: string | null) => {
      setFormState((prev) => ({
        ...prev,
        roleAssignments: prev.roleAssignments.map((a) =>
          a.roleId === roleId
            ? {
                ...a,
                restrictedTopLevelJournalId: journalId,
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

  const handleSubmit = useCallback(async () => {
    if (formState.roleAssignments.length === 0) {
      alert("A user must have at least one role.");
      return;
    }

    const assignmentPayload = formState.roleAssignments.map((ra) => ({
      roleId: ra.roleId,
      restrictedTopLevelJournalId: ra.restrictedTopLevelJournalId || null,
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
    }
  }, [formState, isEditMode, createUserMutation, updateUserMutation]);

  const mutation = isEditMode ? updateUserMutation : createUserMutation;

  const openCreateUserModal = useCallback(() => {
    setIsCreateUserModalOpen(true);
  }, []);

  const closeCreateUserModal = useCallback(() => {
    setIsCreateUserModalOpen(false);
    resetForm();
  }, [resetForm]);

  return {
    formState,
    isEditMode,
    isLoading: isLoadingRoles || isLoadingJournals || isLoadingUserToEdit,
    isSubmitting: mutation.isPending,
    isSuccess: mutation.isSuccess,
    submissionError: mutation.error,
    resetMutation: mutation.reset,
    assignableRoles,
    allJournalsData, // Changed from allCompanyJournalsData
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
