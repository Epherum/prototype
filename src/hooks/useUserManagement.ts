// src/hooks/useUserManagement.ts
import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createUser,
  CreateUserClientPayload,
} from "@/services/clientUserService"; // Adjust path
import { fetchCompanyRoles } from "@/services/clientRoleService"; // Adjust path
import {
  fetchTopLevelJournalsForAdmin,
  TopLevelJournalAdminSelection,
} from "@/services/clientJournalService"; // Adjust path
import type { Role } from "@prisma/client"; // Or your client-side Role type
// No need for CreateUserPayloadRoleAssignment from backend service here, as we manage form state directly

interface RoleAssignmentFormState {
  roleId: string;
  roleName?: string; // For display purposes in the form
  restrictedTopLevelJournalId?: string | null;
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
  roleAssignments: [], // Start with no roles assigned
};

export function useUserManagement() {
  const queryClient = useQueryClient();
  const [formState, setFormState] =
    useState<UserManagementFormState>(initialFormState);
  const [showPassword, setShowPassword] = useState(false);

  // --- TanStack Query: Data Fetching ---

  const {
    data: companyRoles,
    isLoading: isLoadingRoles,
    error: errorRoles,
  } = useQuery<Role[], Error>({
    queryKey: ["companyRoles"],
    queryFn: fetchCompanyRoles,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const {
    data: topLevelJournals,
    isLoading: isLoadingJournals,
    error: errorJournals,
  } = useQuery<TopLevelJournalAdminSelection[], Error>({
    queryKey: ["topLevelJournalsForAdmin"],
    queryFn: fetchTopLevelJournalsForAdmin,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // --- TanStack Query: Mutation for User Creation ---

  const createUserMutation = useMutation({
    mutationFn: (userData: CreateUserClientPayload) => createUser(userData),
    onSuccess: (data) => {
      console.log("User created successfully:", data);
      // Optionally invalidate queries that should refetch after user creation
      // e.g., if you have a user list: queryClient.invalidateQueries(['users']);
      queryClient.invalidateQueries({ queryKey: ["users"] }); // Example
      // Reset form or close modal - to be handled by the component using this hook
    },
    onError: (error: Error) => {
      console.error("Error creating user:", error.message);
      // Error will be available in mutation.error, can be shown in UI
    },
  });

  // --- Form State Management Callbacks ---

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
            // Try to find existing assignment to preserve journal restriction
            const existingAssignment = prev.roleAssignments.find(
              (ra) => ra.roleId === roleId
            );
            const role = companyRoles?.find((r) => r.id === roleId);
            return {
              roleId: roleId,
              roleName: role?.name || "Unknown Role",
              restrictedTopLevelJournalId:
                existingAssignment?.restrictedTopLevelJournalId || null,
            };
          }
        );
        return { ...prev, roleAssignments: newAssignments };
      });
    },
    [companyRoles]
  );

  const handleJournalRestrictionChange = useCallback(
    (roleId: string, journalId: string | null) => {
      setFormState((prev) => ({
        ...prev,
        roleAssignments: prev.roleAssignments.map((assignment) =>
          assignment.roleId === roleId
            ? { ...assignment, restrictedTopLevelJournalId: journalId }
            : assignment
        ),
      }));
    },
    []
  );

  const resetForm = useCallback(() => {
    setFormState(initialFormState);
    setShowPassword(false);
    // Note: createUserMutation.reset() might also be needed if you want to clear its status
  }, []);

  // --- Submission Handler ---

  const handleSubmit = useCallback(
    async (event?: React.FormEvent<HTMLFormElement>) => {
      if (event) event.preventDefault();

      if (formState.roleAssignments.length === 0) {
        // alert("Please assign at least one role."); // Or set an error state
        console.error("Attempted to submit with no roles assigned.");
        // Expose an error state for the UI
        createUserMutation.reset(); // Reset to clear any previous error from mutation
        // You might want to set a specific form error here
        return;
      }

      const payload: CreateUserClientPayload = {
        name: formState.name,
        email: formState.email,
        password: formState.password,
        roleAssignments: formState.roleAssignments.map((ra) => ({
          roleId: ra.roleId,
          // Ensure null is sent if undefined, or backend handles undefined as null
          restrictedTopLevelJournalId: ra.restrictedTopLevelJournalId || null,
        })),
      };
      // START OF ADDED LOGGING
      console.log("--- CLIENT SIDE PAYLOAD ---");
      console.log("Payload:", JSON.stringify(payload, null, 2));
      console.log("--- END CLIENT SIDE PAYLOAD ---");
      // END OF ADDED LOGGING
      await createUserMutation.mutateAsync(payload);
    },
    [formState, createUserMutation]
  );

  // --- Derived State & Utilities ---
  const isLoading =
    isLoadingRoles || isLoadingJournals || createUserMutation.isPending;

  const availableRolesForSelection = useMemo(() => {
    return companyRoles || [];
  }, [companyRoles]);

  const availableJournalsForRestriction = useMemo(() => {
    // Add a "None" option for clearing restriction
    const noneOption = { id: "", name: "None (No Restriction)", companyId: "" }; // companyId might not be strictly needed here
    return topLevelJournals ? [noneOption, ...topLevelJournals] : [noneOption];
  }, [topLevelJournals]);

  return {
    formState,
    setFormState, // Expose if direct manipulation is needed, though handlers are preferred
    handleInputChange,
    handleRoleSelectionChange,
    handleJournalRestrictionChange,
    handleSubmit,
    resetForm,

    companyRoles: availableRolesForSelection,
    topLevelJournals: availableJournalsForRestriction,

    isLoadingRoles,
    errorRoles,
    isLoadingJournals,
    errorJournals,

    createUserMutation, // Expose the whole mutation object for status (isPending, isSuccess, isError, error)
    isLoading, // Combined loading state

    showPassword,
    setShowPassword,
  };
}
