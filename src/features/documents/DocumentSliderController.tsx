// src/features/documents/DocumentSliderController.tsx
"use client";

import React, { forwardRef, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/appStore";
import DynamicSlider from "@/features/shared/components/DynamicSlider";
import DocumentConfirmationModal from "./components/DocumentConfirmationModal";
import SingleItemQuantityModal from "./components/SingleItemQuantityModal";
import DocumentDetailsModal from "./components/DocumentDetailsModal";
import { ManageDocumentModal } from "./components/ManageDocumentModal";
import { SLIDER_TYPES } from "@/lib/constants";
import styles from "@/app/page.module.css";
import { IoAddCircleOutline, IoOptionsOutline, IoOpenOutline } from "react-icons/io5";
import type { useDocumentManager } from "./useDocumentManager";
import DocumentsOptionsMenu from "./components/DocumentsOptionsMenu";
import { getDocumentById, deleteDocument, updateDocument } from "@/services/clientDocumentService";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { documentKeys } from "@/lib/queryKeys";
import type { UpdateDocumentPayload } from "@/lib/schemas/document.schema";

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
    const queryClient = useQueryClient();

    const [isDocMenuOpen, setDocMenuOpen] = useState(false);
    const [docMenuAnchorEl, setDocMenuAnchorEl] = useState<HTMLElement | null>(
      null
    );
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedDocumentDetails, setSelectedDocumentDetails] = useState<DocumentClient | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Delete mutation
    const deleteMutation = useMutation({
      mutationFn: deleteDocument,
      onSuccess: () => {
        // Invalidate and refetch document queries
        queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
        // Clear selection if the deleted document was selected
        if (activeDocumentId) {
          setSelection("document", null);
        }
        alert("Document deleted successfully!");
      },
      onError: (error: Error) => {
        alert(`Failed to delete document: ${error.message}`);
      },
    });

    // Update mutation
    const updateMutation = useMutation({
      mutationFn: ({ id, data }: { id: string; data: UpdateDocumentPayload }) =>
        updateDocument(id, data),
      onSuccess: (updatedDocument) => {
        // Invalidate and refetch document queries
        queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
        queryClient.invalidateQueries({ queryKey: documentKeys.detail(updatedDocument.id) });
        // Update the selectedDocumentDetails if it matches the updated document
        if (selectedDocumentDetails?.id === updatedDocument.id) {
          setSelectedDocumentDetails(updatedDocument);
        }
        setIsEditModalOpen(false);
        alert("Document updated successfully!");
      },
      onError: (error: Error) => {
        alert(`Failed to update document: ${error.message}`);
      },
    });

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

    const handleEditDocument = async () => {
      if (!activeDocumentId) return;
      
      // If we don't have document details loaded, fetch them first
      if (!selectedDocumentDetails || selectedDocumentDetails.id !== activeDocumentId) {
        setIsLoadingDetails(true);
        try {
          const documentDetails = await getDocumentById(activeDocumentId);
          setSelectedDocumentDetails(documentDetails);
        } catch (error) {
          console.error('Failed to fetch document details for editing:', error);
          alert('Failed to load document details for editing');
          setIsLoadingDetails(false);
          return;
        } finally {
          setIsLoadingDetails(false);
        }
      }
      
      setIsEditModalOpen(true);
    };

    const handleSaveDocument = (data: UpdateDocumentPayload) => {
      if (!activeDocumentId) return;
      updateMutation.mutate({ id: activeDocumentId, data });
    };

    const handleDeleteDocument = () => {
      if (!activeDocumentId) return;
      
      // Show confirmation dialog
      const documentName = selectedDocumentDetails?.refDoc || `Document ${activeDocumentId}`;
      const confirmed = confirm(
        `Are you sure you want to delete "${documentName}"?\n\nThis action cannot be undone. The document will be marked as deleted and will no longer appear in the system.`
      );
      
      if (confirmed) {
        deleteMutation.mutate(activeDocumentId);
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
                    isDeleting={deleteMutation.isPending}
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
                    <IoAddCircleOutline /> 
                    <span className={styles.buttonText}>
                      <span className={styles.fullText}>Create Document</span>
                      <span className={styles.shortText}>Create</span>
                    </span>
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
              ? null
              : "No documents matching the current filters."
          }
          isCreating={manager.isCreating}
          creationMode={manager.mode}
        />
        <SingleItemQuantityModal
          isOpen={manager.quantityModalState.isOpen}
          onClose={() => manager.handleCancelCreation()}
          onSubmit={manager.handleSingleItemSubmit}
          good={manager.quantityModalState.good}
        />


        {/* ✅ REFACTORED: Handle both single and multiple document creation modals */}
        <AnimatePresence>
          {/* Single document creation modal - only show if NOT in multi-partner/multi-goods modes */}
          {manager.isFinalizeModalOpen && manager.mode !== "GOODS_LOCKED" && manager.mode !== "MULTIPLE_PARTNERS" && manager.mode !== "MULTIPLE_GOODS" && (
            <DocumentConfirmationModal
                isOpen={manager.isFinalizeModalOpen}
                onClose={() => {
                  manager.setFinalizeModalOpen(false);
                  manager.handleCancelCreation();
                }}
                onValidate={manager.handleSubmit}
                title="Finalize Document Creation"
                currentPartner={manager.singleDocumentPartner}
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
          
          {/* Multiple document creation workflow modal - for GOODS_LOCKED, MULTIPLE_PARTNERS, and MULTIPLE_GOODS modes */}
          {manager.multiDocumentState.isProcessing && (
            <DocumentConfirmationModal
                isOpen={manager.multiDocumentState.isProcessing}
                onClose={manager.cancelMultipleDocumentCreation}
                onValidate={manager.processNextDocument}
                title={`Multiple Document Creation`}
                confirmButtonText={
                  manager.multiDocumentState.currentPartnerIndex === manager.multiDocumentState.totalPartners - 1
                    ? "Create Final Document"
                    : "Create Document & Continue"
                }
                currentPartner={manager.multiDocumentState.partnerData[manager.multiDocumentState.currentPartnerIndex]}
                totalDocuments={manager.multiDocumentState.totalPartners}
                currentDocumentIndex={manager.multiDocumentState.currentPartnerIndex}
                allPartners={manager.multiDocumentState.partnerData}
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
        
        <ManageDocumentModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveDocument}
          document={selectedDocumentDetails}
          isLoading={isLoadingDetails}
          isSaving={updateMutation.isPending}
          isViewOnly={false}
        />
      </div>
    );
  }
);

DocumentSliderController.displayName = "DocumentSliderController";
