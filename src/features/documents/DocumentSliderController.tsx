// src/features/documents/DocumentSliderController.tsx
"use client";

import React, { forwardRef, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/appStore";
import DynamicSlider from "@/features/shared/components/DynamicSlider";
import DocumentConfirmationModal from "./components/DocumentConfirmationModal";
import SingleItemQuantityModal from "./components/SingleItemQuantityModal";
import DocumentDetailsModal from "./components/DocumentDetailsModal";
import { SLIDER_TYPES } from "@/lib/constants";
import styles from "@/app/page.module.css";
import { IoAddCircleOutline, IoOptionsOutline, IoOpenOutline } from "react-icons/io5";
import type { useDocumentManager } from "./useDocumentManager";
import DocumentsOptionsMenu from "./components/DocumentsOptionsMenu";
import { getDocumentById } from "@/services/clientDocumentService";

// ✅ NEW: Import client model
import type { DocumentClient } from "@/lib/types/models.client";
import type { DocumentItem } from "@/lib/types/ui";

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
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedDocumentDetails, setSelectedDocumentDetails] = useState<DocumentClient | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    const handleOpenDocMenu = (event: React.MouseEvent<HTMLElement>) => {
      setDocMenuAnchorEl(event.currentTarget);
      setDocMenuOpen(true);
    };
    const handleCloseDocMenu = () => {
      setDocMenuOpen(false);
      setDocMenuAnchorEl(null);
    };

    const handleViewDocument = async () => {
      if (!activeDocumentId) return;
      
      setIsLoadingDetails(true);
      setIsDetailsModalOpen(true);
      
      try {
        const documentDetails = await getDocumentById(activeDocumentId);
        setSelectedDocumentDetails(documentDetails);
      } catch (error) {
        console.error('Failed to fetch document details:', error);
        setSelectedDocumentDetails(null);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    const handleCloseDetailsModal = () => {
      setIsDetailsModalOpen(false);
      setSelectedDocumentDetails(null);
      setIsLoadingDetails(false);
    };

    const handleEditDocument = () => {
      // TODO: Implement edit functionality
      alert(`Edit functionality for document ${activeDocumentId} will be implemented`);
    };

    const handleDeleteDocument = () => {
      // TODO: Implement delete functionality with confirmation
      if (confirm(`Are you sure you want to delete document ${activeDocumentId}?`)) {
        alert(`Delete functionality for document ${activeDocumentId} will be implemented`);
      }
    };

    // ✅ REFACTORED: Use DocumentClient type with enhanced display information
    const sliderData = useMemo(
      () =>
        manager.documentsForSlider.map((doc: DocumentClient) => {
          const itemCount = doc._count?.lines || 0;
          const partnerName = doc.partner?.name || 'Unknown Partner';
          const journalName = doc.journal?.name || 'Unknown Journal';
          
          return {
            id: doc.id,
            label: doc.refDoc || `Document #${doc.id}`,
            code: `${partnerName} • ${itemCount} item${itemCount !== 1 ? 's' : ''} • ${journalName}`,
            // Include all document fields for the details modal
            ...doc,
          };
        }),
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
              <div className={styles.controlsLeftGroup}>
                <div className={styles.optionsButtonContainer}>
                  <button
                    onClick={handleOpenDocMenu}
                    className={`${styles.controlButton} ${styles.editButton}`}
                    aria-label="Options for selected Document"
                    title="Document Options"
                  >
                    <IoOptionsOutline />
                  </button>
                  <DocumentsOptionsMenu
                    isOpen={isDocMenuOpen}
                    onClose={handleCloseDocMenu}
                    anchorEl={docMenuAnchorEl}
                    selectedDocumentId={activeDocumentId}
                    onView={handleViewDocument}
                    onEdit={handleEditDocument}
                    onDelete={handleDeleteDocument}
                  />
                </div>
                {activeDocumentId && (
                  <button
                    onClick={handleViewDocument}
                    className={styles.controlButton}
                    aria-label="View document details"
                    title="View document details"
                  >
                    <IoOpenOutline />
                  </button>
                )}
                {isCreationEnabled ? (
                  <button
                    onClick={manager.handleStartCreation}
                    className={styles.primaryActionButton}
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
        </div>

        <DynamicSlider
          sliderId={SLIDER_TYPES.DOCUMENT}
          title="Documents"
          data={manager.isCreating ? [] : sliderData}
          isLoading={manager.documentsQuery.isLoading}
          isError={manager.documentsQuery.isError}
          activeItemId={activeDocumentId}
          onSlideChange={(id) => setSelection("document", id)}
          placeholderMessage={
            manager.isCreating
              ? `Building document in '${manager.mode}' mode... Use the toolbar at the bottom to proceed.`
              : "No documents matching the current filters."
          }
        />
        <SingleItemQuantityModal
          isOpen={manager.quantityModalState.isOpen}
          onClose={() => manager.handleCancelCreation()}
          onSubmit={manager.handleSingleItemSubmit}
          good={manager.quantityModalState.good}
        />

        {/* ✅ REFACTORED: `manager.items` is now typed as DocumentItem[] */}
        <AnimatePresence>
          {manager.isFinalizeModalOpen && (
            <DocumentConfirmationModal
                isOpen={manager.isFinalizeModalOpen}
                onClose={() => {
                  manager.setFinalizeModalOpen(false);
                  manager.handleCancelCreation();
                }}
                onValidate={manager.handleSubmit}
                title="Finalize Document Creation"
                goods={manager.items.map((item: DocumentItem) => ({
                  id: item.goodId,
                  name: item.goodLabel,
                  quantity: item.quantity,
                  price: item.unitPrice,
                  amount: item.quantity * item.unitPrice,
                }))}
                isLoading={manager.createDocumentMutation.isPending}
              />
          )}
        </AnimatePresence>
        
        <DocumentDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={handleCloseDetailsModal}
          document={selectedDocumentDetails}
          isLoading={isLoadingDetails}
        />
      </div>
    );
  }
);

DocumentSliderController.displayName = "DocumentSliderController";
