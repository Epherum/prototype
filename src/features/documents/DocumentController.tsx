"use client";

import { AnimatePresence } from "framer-motion";
import { useDocumentManager } from "./useDocumentManager";
import DocumentConfirmationModal from "./components/DocumentConfirmationModal";
import DocumentCreationToolbar from "./components/DocumentCreationToolbar";

// Create a React Context to provide the document manager instance to children
import React, { createContext, useContext } from "react";

type DocumentManagerContextType = ReturnType<typeof useDocumentManager> | null;
const DocumentManagerContext = createContext<DocumentManagerContextType>(null);

// Custom hook to easily access the context
export const useSharedDocumentManager = () => {
  const context = useContext(DocumentManagerContext);
  if (!context) {
    throw new Error(
      "useSharedDocumentManager must be used within a DocumentController"
    );
  }
  return context;
};

export const DocumentController: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const documentManager = useDocumentManager();

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
    </DocumentManagerContext.Provider>
  );
};
