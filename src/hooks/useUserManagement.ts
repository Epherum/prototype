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
// THIS IMPORT IS CRUCIAL
import {
  generateJournalDisplayPaths,
  JournalWithDisplayPath,
} from "@/lib/helpers"; // Ensure path is correct and function name matches export

// IMPORTANT: The `CreateUserClientPayload` type (likely defined in or used by `clientUserService.ts`)
// needs to be updated. Its `roleAssignments` array elements should now expect:
// interface CreateUserClientPayloadRoleAssignment {
//   roleId: string;
//   restrictedTopLevelJournalId: string | null;
//   restrictedTopLevelJournalCompanyId: string | null; // <-- THIS IS NEW
// }
// Make sure `clientUserService.createUser` is adapted to receive and use this.

interface RoleAssignmentFormState {
  roleId: string;
  roleName?: string;
  restrictedTopLevelJournalId?: string | null;
  restrictedTopLevelJournalCompanyId?: string | null; // NEW: To store the companyId of the restricted journal
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
    data: allCompanyJournalsData, // RENAMED from topLevelJournals
    isLoading: isLoadingJournals,
    error: errorJournals,
  } = useQuery<any, Error>({
    // Type updated
    queryKey: ["allCompanyJournalsForRestriction"], // RENAMED queryKey
    queryFn: fetchAllJournalsForAdminRestriction, // UPDATED function call
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
              // Preserve companyId too
              restrictedTopLevelJournalCompanyId:
                existingAssignment?.restrictedTopLevelJournalCompanyId || null,
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
        roleAssignments: prev.roleAssignments.map((assignment) => {
          if (assignment.roleId === roleId) {
            if (journalId && allCompanyJournalsData) {
              // Find the selected journal to get its companyId
              const selectedJournal = allCompanyJournalsData.find(
                (j) => j.id === journalId
              );
              return {
                ...assignment,
                restrictedTopLevelJournalId: journalId,
                restrictedTopLevelJournalCompanyId:
                  selectedJournal?.companyId || null,
              };
            }
            // Clearing restriction
            return {
              ...assignment,
              restrictedTopLevelJournalId: null,
              restrictedTopLevelJournalCompanyId: null,
            };
          }
          return assignment;
        }),
      }));
    },
    [allCompanyJournalsData] // Add dependency
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

  // UPDATED: Generate display paths for all journals for the dropdown
  const availableJournalsForRestriction =
    useMemo((): JournalWithDisplayPath[] => {
      const noneOption: JournalWithDisplayPath = {
        id: "", // Represents 'None'
        name: "None (No Restriction)",
        parentId: null,
        companyId: "", // Ensure companyId is part of the type, can be empty for "None"
        displayPath: "None (No Restriction)",
      };

      if (!allCompanyJournalsData || allCompanyJournalsData.length === 0) {
        return [noneOption];
      }

      const processedJournals = generateJournalDisplayPaths(
        allCompanyJournalsData
      );
      return [noneOption, ...processedJournals];
    }, [allCompanyJournalsData]);

  return {
    formState,
    setFormState,
    handleInputChange,
    handleRoleSelectionChange,
    handleJournalRestrictionChange,
    handleSubmit,
    resetForm,

    companyRoles: availableRolesForSelection,
    availableJournalsForRestriction, // RENAMED from topLevelJournals and REPURPOSED

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
