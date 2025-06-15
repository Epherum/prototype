// src/features/users/UsersController.tsx

"use client";

import React, { useImperativeHandle, forwardRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { roleKeys } from "@/lib/queryKeys";

import { useUserManager } from "./useUserManager";
import { useRoleManagement } from "./useRoleManagement"; // <-- Import the hook
import ManageUserModal from "./components/ManageUserModal";
import { ManageRoleModal } from "./components/ManageRoleModal";
import { fetchAllRoles } from "@/services/clientRoleService";

// This allows the parent component (e.g., page.tsx) to call `openUserModal`
export interface UsersControllerRef {
  open: (userId?: string) => void;
}

export const UsersController = forwardRef<UsersControllerRef>((_props, ref) => {
  // This hook controls WHICH modal is visible ('user', 'role', or 'none')
  const {
    modalState,
    openUserModal,
    openRoleModal,
    closeModal,
    closeAllModals,
  } = useUserManager();

  // Fetch all roles once here, so both modals can use the data.
  // The User modal needs it for the list, the Role modal needs it for editing.
  const { data: allRoles } = useQuery({
    queryKey: roleKeys.all,
    queryFn: fetchAllRoles,
  });

  // This hook manages the FORM STATE and LOGIC for the Role Modal
  const roleManagement = useRoleManagement({
    roleIdToEdit: modalState.roleIdToEdit,
    allRoles: allRoles,
    onSuccess: closeModal, // On success, call the manager to close the role modal
  });

  // Expose the `openUserModal` function to the parent component
  useImperativeHandle(
    ref,
    () => ({
      open: openUserModal,
    }),
    [openUserModal]
  );

  return (
    <AnimatePresence>
      {modalState.view === "user" && (
        <ManageUserModal
          isOpen={true}
          onClose={closeAllModals}
          userIdToEdit={modalState.userIdToEdit}
          // Pass down the functions to change the view state in the manager
          onLaunchRoleCreate={() => openRoleModal()}
          onLaunchRoleEdit={(roleId) => openRoleModal(roleId)}
        />
      )}
      {modalState.view === "role" && (
        <ManageRoleModal
          isOpen={true}
          onClose={closeModal} // This will return to the user modal
          // Spread all the props from the roleManagement hook
          {...roleManagement}
        />
      )}
    </AnimatePresence>
  );
});

UsersController.displayName = "UsersController";
