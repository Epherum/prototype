// src/hooks/useModalStates.ts
import { useState, useCallback } from "react";

// Define a type for the context passed to AddJournalModal
export interface AddJournalModalContext {
  level: "top" | "child";
  parentId: string | null;
  parentCode: string | null;
  parentName: string;
}

export function useModalStates() {
  // Existing states
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [isAddJournalModalOpen, setIsAddJournalModalOpen] = useState(false);
  const [addJournalContext, setAddJournalContext] =
    useState<AddJournalModalContext | null>(null);

  // --- NEW: State for Create User Modal ---
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);

  // Existing callbacks
  const openJournalModal = useCallback(() => setIsJournalModalOpen(true), []);
  const closeJournalModal = useCallback(() => setIsJournalModalOpen(false), []);

  const openAddJournalModalWithContext = useCallback(
    (context: AddJournalModalContext) => {
      setAddJournalContext(context);
      setIsAddJournalModalOpen(true);
      setIsJournalModalOpen(false);
    },
    []
  );

  const closeAddJournalModal = useCallback(() => {
    setIsAddJournalModalOpen(false);
    setAddJournalContext(null);
  }, []);

  // --- NEW: Callbacks for Create User Modal ---
  const openCreateUserModal = useCallback(() => {
    // Potentially close other conflicting modals if necessary
    // e.g., if CreateUserModal shouldn't overlap with JournalModal
    // setIsJournalModalOpen(false);
    setIsCreateUserModalOpen(true);
  }, []);

  const closeCreateUserModal = useCallback(() => {
    setIsCreateUserModalOpen(false);
    // The CreateUserModal itself (via useUserManagement) will handle resetting its internal form state
    // upon successful submission or when it's closed.
  }, []);

  return {
    // Existing returns
    isJournalModalOpen,
    openJournalModal,
    closeJournalModal,
    isAddJournalModalOpen,
    addJournalContext,
    openAddJournalModalWithContext,
    closeAddJournalModal,

    // --- NEW: Returns for Create User Modal ---
    isCreateUserModalOpen,
    openCreateUserModal,
    closeCreateUserModal,
  };
}
