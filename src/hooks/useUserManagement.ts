// src/hooks/useUserManagement.ts
import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createUser,
  CreateUserClientPayload,
} from "@/services/clientUserService";
import { fetchCompanyRoles } from "@/services/clientRoleService";
import type { Role } from "@prisma/client";
import { fetchAllJournalsForAdminRestriction } from "@/services/clientJournalService";
import { JournalForAdminSelection } from "@/lib/helpers";

interface RoleAssignmentFormState {
  roleId: string;
  roleName?: string;
  restrictedTopLevelJournalId?: string | null;
  restrictedTopLevelJournalCompanyId?: string | null; // NEW: To store the companyId of the restricted journal
  restrictedJournalDisplayName?: string | null; // NEW: To store the display name of the restricted journal
}

export interface UserManagementFormState {
  name: string;
  email: string;
  password: string;
  roleAssignments: RoleAssignmentFormState[];
}

const initialFormState: UserManagementFormState = {
  name: "",
  email: "",
  password: "",
  roleAssignments: [],
};

export function useUserManagement() {
  const queryClient = useQueryClient();
  const [formState, setFormState] =
    useState<UserManagementFormState>(initialFormState);
  const [showPassword, setShowPassword] = useState(false);

  const {
    data: companyRoles,
    isLoading: isLoadingRoles,
    error: errorRoles,
  } = useQuery<Role[], Error>({
    queryKey: ["companyRoles"],
    queryFn: fetchCompanyRoles,
    staleTime: 5 * 60 * 1000,
  });

  // UPDATED: Fetch all journals for the company for restriction selection
  const {
    data: allCompanyJournalsData,
    isLoading: isLoadingJournals,
    error: errorJournals,
  } = useQuery<JournalForAdminSelection[], Error>({
    // Use the specific type here
    queryKey: ["allCompanyJournalsForRestriction"],
    queryFn: fetchAllJournalsForAdminRestriction,
    staleTime: 5 * 60 * 1000,
  });

  const createUserMutation = useMutation({
    mutationFn: (userData: CreateUserClientPayload) => createUser(userData),
    onSuccess: (data) => {
      console.log("User created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) => {
      console.error("Error creating user:", error.message);
    },
  });

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;
      setFormState((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleRoleSelectionChange = useCallback(
    (selectedRoleIds: string[]) => {
      setFormState((prev) => {
        const newAssignments: RoleAssignmentFormState[] = selectedRoleIds.map(
          (roleId) => {
            const existingAssignment = prev.roleAssignments.find(
              (ra) => ra.roleId === roleId
            );
            const role = companyRoles?.find((r) => r.id === roleId);
            return {
              roleId: roleId,
              roleName: role?.name || "Unknown Role",
              restrictedTopLevelJournalId:
                existingAssignment?.restrictedTopLevelJournalId || null,
              restrictedTopLevelJournalCompanyId:
                existingAssignment?.restrictedTopLevelJournalCompanyId || null,
              // Preserve or initialize display name
              restrictedJournalDisplayName:
                existingAssignment?.restrictedJournalDisplayName || null,
            };
          }
        );
        return { ...prev, roleAssignments: newAssignments };
      });
    },
    [companyRoles]
  );

  // MODIFIED: Now also takes displayName for UI update in the CreateUserModal
  const handleJournalRestrictionChange = useCallback(
    (
      roleId: string,
      journalId: string | null,
      journalCompanyId: string | null,
      journalDisplayName: string | null
    ) => {
      setFormState((prev) => ({
        ...prev,
        roleAssignments: prev.roleAssignments.map((assignment) => {
          if (assignment.roleId === roleId) {
            return {
              ...assignment,
              restrictedTopLevelJournalId: journalId,
              restrictedTopLevelJournalCompanyId: journalCompanyId,
              restrictedJournalDisplayName: journalDisplayName,
            };
          }
          return assignment;
        }),
      }));
    },
    [] // No dependency on allCompanyJournalsData here, as details are passed in
  );

  const resetForm = useCallback(() => {
    setFormState(initialFormState);
    setShowPassword(false);
    createUserMutation.reset();
  }, [createUserMutation]);

  const handleSubmit = useCallback(
    async (event?: React.FormEvent<HTMLFormElement>) => {
      if (event) event.preventDefault();

      if (formState.roleAssignments.length === 0) {
        console.error("Attempted to submit with no roles assigned.");
        createUserMutation.reset(); // Reset to clear any previous error from mutation
        return;
      }

      const payload: CreateUserClientPayload = {
        name: formState.name,
        email: formState.email,
        password: formState.password,
        roleAssignments: formState.roleAssignments.map((ra) => ({
          roleId: ra.roleId,
          restrictedTopLevelJournalId: ra.restrictedTopLevelJournalId || null,
          restrictedTopLevelJournalCompanyId:
            ra.restrictedTopLevelJournalCompanyId || null, // NEW
        })),
      };
      console.log("--- CLIENT SIDE PAYLOAD (useUserManagement) ---");
      console.log(
        "Payload to be sent to clientUserService.createUser:",
        JSON.stringify(payload, null, 2)
      );
      await createUserMutation.mutateAsync(payload);
    },
    [formState, createUserMutation]
  );

  const isLoading =
    isLoadingRoles || isLoadingJournals || createUserMutation.isPending;

  const availableRolesForSelection = useMemo(() => {
    return companyRoles || [];
  }, [companyRoles]);

  return {
    formState,
    setFormState,
    handleInputChange,
    handleRoleSelectionChange,
    handleJournalRestrictionChange,
    handleSubmit,
    resetForm,

    companyRoles: companyRoles || [], // Return companyRoles, ensure it's an array

    allCompanyJournalsData: allCompanyJournalsData, // <<<<------ ADD THIS LINE

    isLoadingRoles,
    errorRoles,
    isLoadingJournals,
    errorJournals,

    createUserMutation,
    isLoading,

    showPassword,
    setShowPassword,
  };
}
