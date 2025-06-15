// src/features/users/useUserManager.ts

import { useState, useCallback } from "react";

export type ModalState = {
  view: "none" | "user" | "role";
  userIdToEdit?: string;
  roleIdToEdit?: string;
};

const initialState: ModalState = {
  view: "none",
};

/**
 * The primary "Manager" hook for the entire User Management feature.
 * It follows the "Pillar 2" architecture by encapsulating all top-level
 * state and logic for this feature, such as which modals are currently open.
 */
export function useUserManager() {
  const [modalState, setModalState] = useState<ModalState>(initialState);

  const openUserModal = useCallback((userId?: string) => {
    setModalState({
      view: "user",
      userIdToEdit: userId,
    });
  }, []);

  const openRoleModal = useCallback((roleId?: string) => {
    setModalState((prev) => ({
      ...prev, // Keep user context if editing a role from the user modal
      view: "role",
      roleIdToEdit: roleId,
    }));
  }, []);

  const closeModal = useCallback(() => {
    // If we are closing the role modal, we want to return to the user modal.
    if (modalState.view === "role") {
      setModalState((prev) => ({
        ...prev,
        view: "user", // Go back to the user modal
        roleIdToEdit: undefined,
      }));
    } else {
      // Otherwise, close everything.
      setModalState(initialState);
    }
  }, [modalState.view]);

  // Special handler to fully close all modals from anywhere.
  const closeAllModals = useCallback(() => {
    setModalState(initialState);
  }, []);

  return {
    modalState,
    openUserModal,
    openRoleModal,
    closeModal,
    closeAllModals,
  };
}
