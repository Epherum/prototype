// src/features/users/useRoleManagement.ts

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { permissionKeys, roleKeys } from "@/lib/queryKeys";

import {
  createRole,
  updateRole,
  fetchAllPermissions,
  RoleClientPayload,
} from "@/services/clientRoleService";
import type { RoleWithPermissions } from "@/lib/types";

export interface RoleFormState {
  id?: string;
  name: string;
  description: string;
  permissionIds: string[];
}

const initialFormState: RoleFormState = {
  name: "",
  description: "",
  permissionIds: [],
};

// This hook is now initialized with the role to edit and all available roles
interface UseRoleManagementProps {
  roleIdToEdit?: string | null;
  allRoles?: RoleWithPermissions[];
  onSuccess: () => void; // Callback to run on successful mutation
}

export function useRoleManagement({
  roleIdToEdit,
  allRoles,
  onSuccess,
}: UseRoleManagementProps) {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<RoleFormState>(initialFormState);
  const isEditMode = !!roleIdToEdit;

  // Effect to populate the form when a roleId is provided for editing
  useEffect(() => {
    if (roleIdToEdit && allRoles) {
      const roleToEdit = allRoles.find((role) => role.id === roleIdToEdit);
      if (roleToEdit) {
        setFormState({
          id: roleToEdit.id,
          name: roleToEdit.name,
          description: roleToEdit.description || "",
          permissionIds: roleToEdit.permissions.map((p) => p.permissionId),
        });
      }
    } else {
      setFormState(initialFormState);
    }
  }, [roleIdToEdit, allRoles]);

  const { data: allPermissions, isLoading: isLoadingPermissions } = useQuery({
    queryKey: permissionKeys.all,
    queryFn: fetchAllPermissions,
    staleTime: Infinity,
  });

  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      onSuccess(); // The controller will handle closing the modal
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    },
  };

  const createMutation = useMutation({
    mutationFn: createRole,
    ...mutationOptions,
  });
  const updateMutation = useMutation({
    mutationFn: (vars: { roleId: string; payload: RoleClientPayload }) =>
      updateRole(vars.roleId, vars.payload),
    ...mutationOptions,
  });

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormState((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    },
    []
  );

  const handlePermissionToggle = useCallback((permissionId: string) => {
    setFormState((prev) => {
      const newPermissionIds = prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...prev.permissionIds, permissionId];
      return { ...prev, permissionIds: newPermissionIds };
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const payload: RoleClientPayload = {
      name: formState.name,
      description: formState.description,
      permissionIds: formState.permissionIds,
    };

    if (isEditMode && roleIdToEdit) {
      updateMutation.mutate({ roleId: roleIdToEdit, payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [formState, isEditMode, roleIdToEdit, createMutation, updateMutation]);

  return {
    formState,
    isEditMode,
    allPermissions,
    isLoadingPermissions,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    handleInputChange,
    handlePermissionToggle,
    handleSubmit,
  };
}
