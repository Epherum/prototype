// src/features/documents/DocumentSliderController.tsx
"use client";

import React, { forwardRef, useMemo, useState } from "react";
import { useAppStore } from "@/store/appStore";
import DynamicSlider from "@/features/shared/components/DynamicSlider";
import DocumentConfirmationModal from "./components/DocumentConfirmationModal";
import SingleItemQuantityModal from "./components/SingleItemQuantityModal";
import { SLIDER_TYPES } from "@/lib/constants";
import styles from "@/app/page.module.css";
import { IoAddCircleOutline, IoOptionsOutline } from "react-icons/io5";
import type { useDocumentManager } from "./useDocumentManager";
import DocumentsOptionsMenu from "./components/DocumentsOptionsMenu";

interface DocumentSliderControllerProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoveDisabled: boolean;
  manager: ReturnType<typeof useDocumentManager>;
  isCreationEnabled: boolean;
}

export const DocumentSliderController = forwardRef<
  HTMLDivElement,
  DocumentSliderControllerProps
>(
  (
    {
      manager,
      onMoveUp,
      onMoveDown,
      canMoveUp,
      canMoveDown,
      isMoveDisabled,
      isCreationEnabled,
    },
    ref
  ) => {
    const setSelection = useAppStore((state) => state.setSelection);
    const activeDocumentId = useAppStore((state) => state.selections.document);

    const [isDocMenuOpen, setDocMenuOpen] = useState(false);
    const [docMenuAnchorEl, setDocMenuAnchorEl] = useState<HTMLElement | null>(
      null
    );

    const handleOpenDocMenu = (event: React.MouseEvent<HTMLElement>) => {
      setDocMenuAnchorEl(event.currentTarget);
      setDocMenuOpen(true);
    };
    const handleCloseDocMenu = () => setDocMenuOpen(false);
    const sliderData = useMemo(
      () =>
        (manager.documentsForSlider || []).map((doc: any) => ({
          id: String(doc.id),
          label: doc.refDoc,
          code: `Date: ${new Date(doc.date).toLocaleDateString()}`,
        })),
      [manager.documentsForSlider]
    );

    const disabledMessage = useMemo(() => {
      if (!manager.isJournalFirst) {
        return "Journal must be first to create a document.";
      }
      return "Select a single, terminal journal to create a document.";
    }, [manager.isJournalFirst]);

    return (
      <div ref={ref}>
        <div className={styles.controls}>
          {!manager.isCreating && (
            <>
              {/* --- FIX: Standardize on controlsLeftGroup for layout --- */}
              <div className={styles.controlsLeftGroup}>
                <div className={styles.optionsButtonContainer}>
                  <button
                    onClick={handleOpenDocMenu}
                    className={`${styles.controlButton} ${styles.editButton}`}
                    aria-label="Options for selected Document"
                    // FIX: Button is now always enabled.
                    title="Document Options"
                  >
                    <IoOptionsOutline />
                  </button>
                  <DocumentsOptionsMenu
                    isOpen={isDocMenuOpen}
                    onClose={handleCloseDocMenu}
                    anchorEl={docMenuAnchorEl}
                    // FIX: Pass the selected ID to the menu component
                    selectedDocumentId={activeDocumentId}
                    // FIX: Use correct prop names (onView, onEdit)
                    onView={() =>
                      alert(`Viewing details for doc ${activeDocumentId}`)
                    }
                    onEdit={() => alert(`Editing doc ${activeDocumentId}`)}
                    onDelete={() => alert(`Deleting doc ${activeDocumentId}`)}
                  />
                </div>
                {isCreationEnabled ? (
                  <button
                    onClick={manager.handleStartCreation}
                    className={`${styles.controlButton} ${styles.createDocumentButton}`}
                    title="Create a new document based on current slider order"
                  >
                    <IoAddCircleOutline /> Create Document
                  </button>
                ) : (
                  <div className={styles.disabledControlText}>
                    {disabledMessage}
                  </div>
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
            </>
          )}
          {/* If we are creating, this area is now intentionally blank. */}
        </div>

        <DynamicSlider
          sliderId={SLIDER_TYPES.DOCUMENT}
          title="Documents"
          data={manager.isCreating ? [] : sliderData}
          isLoading={manager.documentsQuery.isLoading}
          isError={manager.documentsQuery.isError}
          activeItemId={activeDocumentId}
          onSlideChange={(id) => setSelection("document", id)}
          isAccordionOpen={false}
          onToggleAccordion={() => {}}
          placeholderMessage={
            manager.isCreating
              ? `Building document in '${manager.mode}' mode... Use the toolbar at the bottom to proceed.`
              : "No documents for selected partner."
          }
        />
        <SingleItemQuantityModal
          isOpen={manager.quantityModalState.isOpen}
          onClose={() => manager.handleCancelCreation()}
          onSubmit={manager.handleSingleItemSubmit}
          goodId={manager.quantityModalState.goodId}
        />

        <DocumentConfirmationModal
          isOpen={manager.isFinalizeModalOpen}
          onClose={() => manager.setIsFinalizeModalOpen(false)}
          onValidate={manager.handleSubmit} // Pass the correct handler
          title="Finalize Document Creation"
          goods={manager.items.map((item: any) => ({
            id: item.goodId,
            name: item.goodLabel,
            quantity: item.quantity,
            price: item.unitPrice,
            amount: item.quantity * item.unitPrice,
          }))}
          isLoading={manager.createDocumentMutation.isPending}
        />
      </div>
    );
  }
);

DocumentSliderController.displayName = "DocumentSliderController";
