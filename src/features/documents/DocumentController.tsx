// src/features/documents/DocumentController.tsx
"use client";

import React, { forwardRef, useMemo } from "react";
import { useAppStore } from "@/store/appStore";
import DynamicSlider from "@/features/shared/components/DynamicSlider";
import DocumentCreationToolbar from "./components/DocumentCreationToolbar";
import DocumentConfirmationModal from "./components/DocumentConfirmationModal";
import SingleItemQuantityModal from "./components/SingleItemQuantityModal";
import { SLIDER_TYPES } from "@/lib/constants";
import styles from "@/app/page.module.css";
import { IoAddCircleOutline } from "react-icons/io5";
import type { useDocumentManager } from "./useDocumentManager";

interface DocumentControllerProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoveDisabled: boolean;
  manager: ReturnType<typeof useDocumentManager>;
  onPrepareFinalization: () => void; // <-- Add this prop
}

export const DocumentController = forwardRef<
  HTMLDivElement,
  DocumentControllerProps
>(
  (
    {
      manager,
      onMoveUp,
      onMoveDown,
      canMoveUp,
      canMoveDown,
      isMoveDisabled,
      onPrepareFinalization,
    },
    ref
  ) => {
    const setSelection = useAppStore((state) => state.setSelection);
    const activeDocumentId = useAppStore((state) => state.selections.document);

    const sliderData = useMemo(
      () =>
        (manager.documentsForSlider || []).map((doc: any) => ({
          id: String(doc.id),
          label: doc.refDoc,
          code: `Date: ${new Date(doc.date).toLocaleDateString()}`,
        })),
      [manager.documentsForSlider]
    );

    return (
      <div ref={ref}>
        <div className={styles.controls}>
          {!manager.isCreating ? (
            <>
              <div
                style={{ flexGrow: 1, display: "flex", alignItems: "center" }}
              >
                {manager.isJournalFirst ? (
                  <button
                    onClick={manager.handleStartCreation}
                    className={`${styles.controlButton} ${styles.createDocumentButton}`}
                    title="Create a new document based on current slider order"
                  >
                    <IoAddCircleOutline /> Create Document
                  </button>
                ) : (
                  <div className={styles.disabledControlText}>
                    Journal must be first to create a document.
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
                    ▲
                  </button>
                )}
                {canMoveDown && (
                  <button
                    onClick={onMoveDown}
                    className={styles.controlButton}
                    disabled={isMoveDisabled}
                  >
                    ▼
                  </button>
                )}
              </div>
            </>
          ) : (
            <DocumentCreationToolbar
              onFinish={onPrepareFinalization}
              onCancel={manager.handleCancelCreation}
            />
          )}
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
              ? `Building document in '${manager.mode}' mode...`
              : "No documents for selected partner."
          }
        />
        <SingleItemQuantityModal
          isOpen={manager.quantityModalState.isOpen}
          onClose={() => manager.handleCancelCreation()} // <-- Changed to cancel instead of just closing
          onSubmit={manager.handleSingleItemSubmit}
          goodId={manager.quantityModalState.goodId}
        />

        <DocumentConfirmationModal
          isOpen={manager.isFinalizeModalOpen}
          onClose={() => manager.setIsFinalizeModalOpen(false)}
          onValidate={manager.handleSubmit}
          title="Finalize Document"
          confirmButtonText="Validate Document"
          isDestructive={false}
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

DocumentController.displayName = "DocumentController";
