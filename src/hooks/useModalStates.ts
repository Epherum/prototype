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
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [isAddJournalModalOpen, setIsAddJournalModalOpen] = useState(false);
  const [addJournalContext, setAddJournalContext] =
    useState<AddJournalModalContext | null>(null);
  // isConfirmationModalOpen is part of useDocumentCreation, so it stays there.

  const openJournalModal = useCallback(() => setIsJournalModalOpen(true), []);
  const closeJournalModal = useCallback(() => setIsJournalModalOpen(false), []);

  const openAddJournalModalWithContext = useCallback(
    (context: AddJournalModalContext) => {
      setAddJournalContext(context);
      setIsAddJournalModalOpen(true);
      setIsJournalModalOpen(false); // Close the main journal modal if open
    },
    []
  );

  const closeAddJournalModal = useCallback(() => {
    setIsAddJournalModalOpen(false);
    setAddJournalContext(null);
  }, []);

  return {
    isJournalModalOpen,
    openJournalModal,
    closeJournalModal,
    isAddJournalModalOpen,
    addJournalContext,
    openAddJournalModalWithContext,
    closeAddJournalModal,
  };
}
