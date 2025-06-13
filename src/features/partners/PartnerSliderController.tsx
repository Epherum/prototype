// File: src/features/partners/PartnerSliderController.tsx
"use client";

import React, { useMemo, useCallback } from "react";
import {
  IoOptionsOutline,
  IoAddCircleOutline,
  IoTrashBinOutline,
} from "react-icons/io5";
import styles from "@/app/page.module.css";

// Store & Hooks
import { useAppStore } from "@/store/appStore";
import { usePartnerManager } from "./usePartnerManager";
import { usePartnerJournalLinking } from "@/features/linking/usePartnerJournalLinking";
import { useDocumentCreation } from "@/hooks/useDocumentCreation"; // For Document Mode props
import { useJournalPartnerGoodLinking } from "@/features/linking/useJournalPartnerGoodLinking"; // For G-P-G linking
import { fetchJournalLinksForPartner } from "@/services/clientJournalPartnerLinkService"; // For Unlink Modal

// UI Components
import DynamicSlider from "@/features/shared/components/DynamicSlider";
import PartnerOptionsMenu from "@/features/partners/components/PartnerOptionsMenu";
import AddEditPartnerModal from "@/features/partners/components/AddEditPartnerModal";
import LinkPartnerToJournalsModal from "@/features/linking/components/LinkPartnerToJournalsModal";
import UnlinkPartnerFromJournalsModal from "@/features/linking/components/UnlinkPartnerFromJournalsModal";

// Libs & Types
import { SLIDER_TYPES } from "@/lib/constants";
import type {
  AccountNodeData,
  CreateJournalPartnerGoodLinkClientData,
} from "@/lib/types";

// --- NEW: Props for layout controls, passed from page.tsx ---
interface LayoutControlProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoveDisabled: boolean;
}

export interface PartnerSliderControllerProps extends LayoutControlProps {
  onOpenJournalSelector: (
    onSelectCallback: (journalNode: AccountNodeData) => void
  ) => void;
  fullJournalHierarchy: AccountNodeData[];
}

export const PartnerSliderController: React.FC<
  PartnerSliderControllerProps
> = ({
  onOpenJournalSelector,
  fullJournalHierarchy,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  isMoveDisabled,
}) => {
  const partnerManager = usePartnerManager();
  const partnerJournalLinking = usePartnerJournalLinking();
  const documentCreation = useDocumentCreation();
  const jpqlLinking = useJournalPartnerGoodLinking();

  // 2. Select any additional state needed from the store for UI logic.
  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const gpgContextJournalId = useAppStore(
    (state) => state.selections.gpgContextJournalId
  );
  const selectedGoodsId = useAppStore((state) => state.selections.goods);

  // 3. Re-create logic that was previously in page.tsx, but now self-contained.
  const isGPStartOrder = useMemo(() => {
    const visibleSliders = sliderOrder.filter((id) => visibility[id]);
    return (
      visibleSliders.length >= 2 &&
      visibleSliders[0] === SLIDER_TYPES.GOODS &&
      visibleSliders[1] === SLIDER_TYPES.PARTNER
    );
  }, [sliderOrder, visibility]);

  // Handler for creating a G-P-G link, previously in page.tsx
  const handleCreateGPGLink = useCallback(() => {
    if (!gpgContextJournalId) {
      alert("G-P Link: Context journal not selected.");
      return;
    }
    if (!selectedGoodsId) {
      alert("G-P Link: Good from first slider not selected.");
      return;
    }
    if (!partnerManager.selectedPartnerId) {
      alert("G-P Link: Partner from second slider not selected.");
      return;
    }
    const linkData: CreateJournalPartnerGoodLinkClientData = {
      journalId: gpgContextJournalId,
      partnerId: partnerManager.selectedPartnerId,
      goodId: selectedGoodsId,
    };
    // **FIXED HERE**
    jpqlLinking.createSimpleJPGL(linkData);
  }, [
    gpgContextJournalId,
    selectedGoodsId,
    partnerManager.selectedPartnerId,
    // **AND FIXED HERE**
    jpqlLinking.createSimpleJPGL,
  ]);

  const canCreateGPGLink = useMemo(() => {
    return (
      isGPStartOrder &&
      !!gpgContextJournalId &&
      !!selectedGoodsId &&
      !!partnerManager.selectedPartnerId
    );
  }, [
    isGPStartOrder,
    gpgContextJournalId,
    selectedGoodsId,
    partnerManager.selectedPartnerId,
  ]);

  // Fetching the terminal journal selection from the store
  const isTerminalJournalActive = useAppStore(
    (state) => !!state.selections.journal.level3Ids.length
  );

  // 4. Render all UI for this feature, wiring props from hooks to components.
  return (
    <>
      {/* --- NEW: The controller now renders the entire, correctly structured control bar --- */}
      <div className={styles.controls}>
        <div className={styles.controlsLeftGroup}>
          <button
            onClick={partnerManager.handleOpenPartnerOptionsMenu}
            className={`${styles.controlButton} ${styles.editButton}`}
            aria-label="Options for Partner"
            disabled={
              documentCreation.isDocumentCreationMode &&
              documentCreation.lockedPartnerId !== null
            }
          >
            <IoOptionsOutline />
          </button>

          {isTerminalJournalActive &&
            !documentCreation.isDocumentCreationMode &&
            partnerManager.selectedPartnerId && (
              <button
                onClick={() =>
                  documentCreation.handleStartDocumentCreation(
                    partnerManager.selectedPartnerId!
                  )
                }
                className={`${styles.controlButton} ${styles.createDocumentButton}`}
                title="Create Document with this Partner"
              >
                <IoAddCircleOutline /> Doc
              </button>
            )}

          {documentCreation.isDocumentCreationMode &&
            documentCreation.lockedPartnerId ===
              partnerManager.selectedPartnerId && (
              <button
                onClick={documentCreation.handleCancelDocumentCreation}
                className={`${styles.controlButton} ${styles.cancelDocumentButton}`}
                title="Cancel Document Creation"
              >
                <IoTrashBinOutline /> Cancel Doc
              </button>
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

      {/* === Presentational Slider Component === */}
      <DynamicSlider
        sliderId={SLIDER_TYPES.PARTNER}
        title="Partner"
        data={(partnerManager.partnersForSlider || []).map((p) => ({
          ...p,
          id: String(p.id),
          name: p.name,
          code: String(p.registrationNumber || p.id),
        }))}
        isLoading={
          partnerManager.partnerQuery.isLoading ||
          partnerManager.partnerQuery.isFetching
        }
        isError={partnerManager.partnerQuery.isError}
        error={partnerManager.partnerQuery.error}
        activeItemId={partnerManager.selectedPartnerId}
        onSlideChange={partnerManager.setSelectedPartnerId}
        isAccordionOpen={false} // This state will be moved into the controller if needed
        onToggleAccordion={() => {}} // Placeholder, implement if details accordion is needed
        isLocked={
          documentCreation.isDocumentCreationMode &&
          documentCreation.lockedPartnerId !== null
        }
        isDocumentCreationMode={documentCreation.isDocumentCreationMode}
      />

      {/* === Options Menu and its Modals === */}
      <PartnerOptionsMenu
        isOpen={partnerManager.isPartnerOptionsMenuOpen}
        onClose={partnerManager.handleClosePartnerOptionsMenu}
        anchorEl={partnerManager.partnerOptionsMenuAnchorEl}
        selectedPartnerId={partnerManager.selectedPartnerId}
        onAdd={partnerManager.handleOpenAddPartnerModal}
        onEdit={partnerManager.handleOpenEditPartnerModal}
        onDelete={partnerManager.handleDeleteCurrentPartner}
        onLinkToJournals={partnerJournalLinking.openLinkModal}
        onUnlinkFromJournals={partnerJournalLinking.openUnlinkModal}
        onCreateGPGLink={canCreateGPGLink ? handleCreateGPGLink : undefined}
      />

      {/* --- Modals Rendered by This Controller --- */}
      <AddEditPartnerModal
        isOpen={partnerManager.isAddEditPartnerModalOpen}
        onClose={partnerManager.handleCloseAddEditPartnerModal}
        onSubmit={partnerManager.handleAddOrUpdatePartnerSubmit}
        initialData={partnerManager.editingPartnerData}
        isSubmitting={
          partnerManager.createPartnerMutation.isPending ||
          partnerManager.updatePartnerMutation.isPending
        }
      />

      {partnerJournalLinking.isLinkModalOpen && (
        <LinkPartnerToJournalsModal
          isOpen={partnerJournalLinking.isLinkModalOpen}
          onClose={partnerJournalLinking.closeLinkModal}
          onSubmitLinks={partnerJournalLinking.submitLinks}
          partnerToLink={partnerJournalLinking.partnerForLinking}
          isSubmitting={partnerJournalLinking.isSubmittingLinks}
          onOpenJournalSelector={onOpenJournalSelector}
          fullJournalHierarchy={fullJournalHierarchy}
        />
      )}

      {partnerJournalLinking.isUnlinkModalOpen &&
        partnerJournalLinking.partnerForUnlinking && (
          <UnlinkPartnerFromJournalsModal
            isOpen={partnerJournalLinking.isUnlinkModalOpen}
            onClose={partnerJournalLinking.closeUnlinkModal}
            partner={partnerJournalLinking.partnerForUnlinking}
            onUnlink={partnerJournalLinking.submitUnlink}
            fetchLinksFn={() =>
              fetchJournalLinksForPartner(
                partnerJournalLinking.partnerForUnlinking!.id
              )
            }
            isUnlinking={partnerJournalLinking.isSubmittingUnlink}
          />
        )}
    </>
  );
};
