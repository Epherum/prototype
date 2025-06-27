//src/features/documents/DocumentController.tsx
"use client";

import React, { useState } from "react";
// REMOVED: No longer uses the hook directly
// import { useDocumentManager } from "./useDocumentManager";
import { useAppStore } from "@/store/appStore";

import DynamicSlider from "@/features/shared/components/DynamicSlider";
import DocumentCreationToolbar from "./components/DocumentCreationToolbar";
import DocumentConfirmationModal from "./components/DocumentConfirmationModal";
import { SLIDER_TYPES } from "@/lib/constants";

import styles from "@/app/page.module.css";
import { IoAddCircleOutline } from "react-icons/io5";

import type { Document, DocumentLineClientData, Good } from "@/lib/types";

// The props this component now receives from page.tsx
interface DocumentControllerProps {
  isCreating: boolean;
  canCreateDocument: boolean;
  lines: DocumentLineClientData[];
  documentsForSlider: Document[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  handleStartCreation: () => void;
  handleCancelCreation: () => void;
  handleSubmit: (headerData: {
    refDoc: string;
    date: Date;
    type: Document["type"];
  }) => void;
  // Layout props are still passed through
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoveDisabled: boolean;
}

export const DocumentController: React.FC<DocumentControllerProps> = ({
  // Destructure all the props from the parent
  isCreating,
  canCreateDocument,
  lines,
  documentsForSlider,
  isLoading,
  isFetching,
  isError,
  error,
  handleStartCreation,
  handleCancelCreation,
  handleSubmit,
  // Layout props
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  isMoveDisabled,
}) => {
  // Local state for modal visibility and form data remains here, which is correct.
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [headerData, setHeaderData] = useState({
    refDoc: `DOC-${Date.now()}`,
    date: new Date(),
    type: "INVOICE" as Document["type"],
  });

  const selectedPartnerId = useAppStore((state) => state.selections.partner);

  const handleOpenFinalizeModal = () => {
    if (lines.length === 0) {
      alert("Please add at least one item to the document.");
      return;
    }
    setIsFinalizeModalOpen(true);
  };

  const handleModalSubmit = () => {
    // Call the handleSubmit function passed down from the page
    handleSubmit(headerData);
    setIsFinalizeModalOpen(false); // Close the modal on submit
  };

  const sliderData = (documentsForSlider || []).map((doc) => ({
    id: String(doc.id), // Ensure id is a string for DynamicSlider
    label: doc.refDoc, // Use label to match DynamicSlider's expectation
    code: `Date: ${new Date(doc.date).toLocaleDateString()} | Total: ${
      doc.totalTTC
    }`,
  }));

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.controlsLeftGroup}>
          {!isCreating && canCreateDocument && (
            <button
              onClick={handleStartCreation}
              className={`${styles.controlButton} ${styles.createDocumentButton}`}
              title="Create a new document"
            >
              <IoAddCircleOutline /> New Doc
            </button>
          )}

          {!isCreating && !canCreateDocument && (
            <div className={styles.disabledControlText}>
              Select a terminal journal & partner to create a doc.
            </div>
          )}

          {isCreating && (
            <DocumentCreationToolbar
              onFinish={handleOpenFinalizeModal}
              onCancel={handleCancelCreation}
            />
          )}
        </div>
        <div className={styles.moveButtonGroup}>
          {canMoveUp && (
            <button
              onClick={onMoveUp}
              className={styles.controlButton}
              disabled={isMoveDisabled}
            >
              ▲ Up
            </button>
          )}
          {canMoveDown && (
            <button
              onClick={onMoveDown}
              className={styles.controlButton}
              disabled={isMoveDisabled}
            >
              ▼ Down
            </button>
          )}
        </div>
      </div>

      <DynamicSlider
        sliderId={SLIDER_TYPES.DOCUMENT}
        title="Documents"
        data={isCreating ? [] : sliderData}
        isLoading={isLoading || isFetching}
        isError={isError}
        error={error}
        activeItemId={null}
        onSlideChange={() => {}}
        isAccordionOpen={false}
        onToggleAccordion={() => {}}
        placeholderMessage={
          isCreating
            ? "Add items from the Goods slider to build your document."
            : "No documents found for the selected partner."
        }
      />

      <DocumentConfirmationModal
        isOpen={isFinalizeModalOpen}
        onClose={() => setIsFinalizeModalOpen(false)}
        onValidate={handleModalSubmit}
        partner={{ id: selectedPartnerId || "", name: "Selected Partner" }}
        goods={lines.map((line) => ({
          id: line.journalPartnerGoodLinkId,
          name: line.designation,
          quantity: line.quantity,
          price: line.unitPrice,
          amount: line.quantity * line.unitPrice,
        }))}
      />
    </>
  );
};
