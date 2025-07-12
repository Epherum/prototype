"use client";

import React, {
  useState,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from "react";
import { useDocumentManager } from "./useDocumentManager";
import { usePermissions } from "@/hooks/usePermissions";
import { useAppStore } from "@/store/appStore";

// Import UI Components
import DynamicSlider from "@/features/shared/components/DynamicSlider";
import DocumentCreationToolbar from "./components/DocumentCreationToolbar";
import DocumentConfirmationModal from "./components/DocumentConfirmationModal";
import { ManageDocumentModal } from "./components/ManageDocumentModal";
import DocumentsOptionsMenu from "./components/DocumentsOptionsMenu";

// Import Other Necessities
import { SLIDER_TYPES } from "@/lib/constants";
import styles from "@/app/page.module.css";
import { IoAddCircleOutline, IoEllipsisVertical } from "react-icons/io5";

interface DocumentControllerProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoveDisabled: boolean;
  manager: ReturnType<typeof useDocumentManager>;
}

export const DocumentController = forwardRef(
  (props: DocumentControllerProps, ref) => {
    const {
      onMoveUp,
      onMoveDown,
      canMoveUp,
      canMoveDown,
      isMoveDisabled,
      manager,
    } = props;

    const setSelection = useAppStore((state) => state.setSelection);
    const activeDocumentId = useAppStore((state) => state.selections.document);

    const canReadDocuments = true;
    const canManageDocuments = true;

    const [isAccordionOpen, setIsAccordionOpen] = useState(false);
    const toggleAccordion = () => setIsAccordionOpen((p) => !p);

    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

    useImperativeHandle(ref, () => ({
      openEditModal: (id: string) => manager.openEditModal(id),
      openDeleteModal: (id: string) => manager.openDeleteModal(id),
      openViewModal: (id: string) => manager.openViewModal(id),
    }));

    const handleOpenOptionsMenu = (
      event: React.MouseEvent<HTMLButtonElement>
    ) => {
      setMenuAnchorEl(event.currentTarget);
    };

    const handleCloseOptionsMenu = () => {
      setMenuAnchorEl(null);
    };

    const sliderData = useMemo(
      () =>
        (manager.documentsForSlider || []).map((doc) => ({
          id: String(doc.id),
          label: doc.refDoc,
          code: `Date: ${new Date(doc.date).toLocaleDateString()} | Total: ${
            doc.totalTTC
          }`,
          ...doc,
        })),
      [manager.documentsForSlider]
    );

    const hasDocuments = sliderData.length > 0;
    const documentIdForMenu =
      activeDocumentId || (hasDocuments ? sliderData[0].id : null);

    const isOptionsDisabled = !canReadDocuments || !hasDocuments;
    let optionsTitle = "Document Options";
    if (!canReadDocuments) {
      optionsTitle = "You do not have permission to view documents";
    } else if (!hasDocuments) {
      optionsTitle = "No documents available to select";
    }

    return (
      <>
        <div className={styles.controls}>
          {!manager.isCreating ? (
            <>
              {/* --- FIX: Elements are now in the correct order --- */}

              {/* Item 1: The Options Button (far left) */}
              <button
                disabled={isOptionsDisabled}
                onClick={handleOpenOptionsMenu}
                className={styles.controlButton}
                title={optionsTitle}
                aria-label="Options for documents"
              >
                <IoEllipsisVertical />
              </button>

              {/* Item 2: The Create Button or its placeholder text */}
              {manager.canCreateDocument ? (
                <button
                  onClick={manager.handleStartCreation}
                  className={`${styles.controlButton} ${styles.createDocumentButton}`}
                  title="Create a new document"
                >
                  <IoAddCircleOutline /> New Doc
                </button>
              ) : (
                <div className={styles.disabledControlText}>
                  Select one terminal journal & partner to create a doc.
                </div>
              )}

              {/* Item 3: The spacer that pushes the move buttons to the right */}
              <div style={{ flexGrow: 1 }}></div>

              {/* Item 4: The move buttons (far right) */}
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
            // Layout for creation mode
            <>
              <DocumentCreationToolbar
                onFinish={manager.handleOpenFinalizeModal}
                onCancel={manager.handleCancelCreation}
              />
              <div style={{ flexGrow: 1 }}></div>
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
          )}
        </div>

        {/* ...The rest of the component (DynamicSlider and Modals) remains unchanged... */}

        <DynamicSlider
          sliderId={SLIDER_TYPES.DOCUMENT}
          title="Documents"
          data={manager.isCreating ? [] : sliderData}
          isLoading={
            manager.documentsQuery.isLoading ||
            manager.documentsQuery.isFetching
          }
          isError={manager.documentsQuery.isError}
          error={manager.documentsQuery.error}
          activeItemId={activeDocumentId}
          onSlideChange={(id) => setSelection("document", id)}
          isAccordionOpen={isAccordionOpen}
          onToggleAccordion={toggleAccordion}
          onItemClick={(id) => manager.openViewModal(id)}
          placeholderMessage={
            manager.isCreating
              ? "Add items from the Goods slider to build your document."
              : "No documents found for the selected partner."
          }
        />

        <DocumentsOptionsMenu
          isOpen={!!menuAnchorEl}
          onClose={handleCloseOptionsMenu}
          anchorEl={menuAnchorEl}
          selectedDocumentId={documentIdForMenu}
          onView={() => {
            if (documentIdForMenu) manager.openViewModal(documentIdForMenu);
          }}
          onEdit={() => {
            if (documentIdForMenu) manager.openEditModal(documentIdForMenu);
          }}
          onDelete={() => {
            if (documentIdForMenu) manager.openDeleteModal(documentIdForMenu);
          }}
        />

        <ManageDocumentModal
          isOpen={
            manager.modalState.view === "edit" ||
            manager.modalState.view === "view"
          }
          onClose={manager.closeModal}
          onSave={(data) =>
            manager.updateDocumentMutation.mutate({
              id: manager.modalState.documentId!,
              data,
            })
          }
          document={manager.activeDocument}
          isLoading={manager.isLoadingActiveDocument}
          isSaving={manager.updateDocumentMutation.isPending}
          isViewOnly={manager.modalState.view === "view"}
        />

        <DocumentConfirmationModal
          isOpen={manager.modalState.view === "delete"}
          onClose={manager.closeModal}
          onValidate={manager.handleConfirmDelete}
          title="Confirm Deletion"
          confirmButtonText="Yes, Delete"
          isDestructive={true}
          message={`Are you sure you want to delete document ${
            manager.activeDocument?.refDoc || ""
          }? This action is permanent.`}
          isLoading={manager.deleteDocumentMutation.isPending}
          goods={[]}
        />

        <DocumentConfirmationModal
          isOpen={manager.isFinalizeModalOpen}
          onClose={() => manager.setIsFinalizeModalOpen(false)}
          onValidate={manager.handleSubmit}
          title="Finalize Document"
          confirmButtonText="Validate Document"
          isDestructive={false}
          goods={manager.lines.map((line) => ({
            id: line.journalPartnerGoodLinkId,
            name: line.designation,
            quantity: line.quantity,
            price: line.unitPrice,
            amount: line.quantity * line.unitPrice,
          }))}
          isLoading={manager.createDocumentMutation.isPending}
        />
      </>
    );
  }
);

DocumentController.displayName = "DocumentController";
