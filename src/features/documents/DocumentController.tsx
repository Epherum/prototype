//src/features/documents/documentController.tsx
"use client";

import React, { createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IoAddCircleOutline } from "react-icons/io5";

import { useDocumentManager } from "./useDocumentManager";
import DocumentConfirmationModal from "./components/DocumentConfirmationModal";
import DocumentCreationToolbar from "./components/DocumentCreationToolbar";

// Import hooks and types needed for props
import { useJournalManager } from "@/features/journals/useJournalManager";
import styles from "@/app/page.module.css"; // Assuming styles are in this file

type DocumentManagerContextType = ReturnType<typeof useDocumentManager> | null;
const DocumentManagerContext = createContext<DocumentManagerContextType>(null);

export const useSharedDocumentManager = () => {
  const context = useContext(DocumentManagerContext);
  if (!context) {
    throw new Error(
      "useSharedDocumentManager must be used within a DocumentController"
    );
  }
  return context;
};

// Define the component's props to accept the journalManager
interface DocumentControllerProps {
  children: React.ReactNode;
  journalManager: ReturnType<typeof useJournalManager>;
}

export const DocumentController: React.FC<DocumentControllerProps> = ({
  children,
  journalManager,
}) => {
  // The controller passes the received manager instance into its own hook
  const documentManager = useDocumentManager({ journalManager });

  return (
    <DocumentManagerContext.Provider value={documentManager}>
      {children}

      {documentManager.isDocumentCreationMode && (
        <DocumentCreationToolbar
          onFinish={documentManager.handleFinishDocument}
        />
      )}

      <AnimatePresence>
        {documentManager.isConfirmationModalOpen && (
          <DocumentConfirmationModal
            isOpen={documentManager.isConfirmationModalOpen}
            onClose={documentManager.closeConfirmationModal}
            onValidate={documentManager.handleValidateDocument}
            partner={documentManager.lockedPartnerDetails}
            goods={documentManager.selectedGoodsForDocument}
          />
        )}
      </AnimatePresence>

      {/* The +doc button is now rendered by this controller */}
      <div className={styles.fixedControlsContainer}>
        <AnimatePresence>
          {documentManager.isTerminalJournalActive &&
            !documentManager.isDocumentCreationMode && (
              <motion.button
                className={styles.addDocButton}
                onClick={documentManager.handleEnterJournalCreationMode}
                initial={{ scale: 0, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0, y: 50 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                title="Create a new document for the selected journal"
              >
                <IoAddCircleOutline /> +doc
              </motion.button>
            )}
        </AnimatePresence>
      </div>
    </DocumentManagerContext.Provider>
  );
};
