"use client";

import React, { useMemo, useCallback } from "react";
import { IoOptionsOutline } from "react-icons/io5";
import styles from "@/app/page.module.css";
import { useAppStore } from "@/store/appStore";
import { usePartnerManager } from "./usePartnerManager";
import { usePartnerJournalLinking } from "@/features/linking/usePartnerJournalLinking";
import { useJournalPartnerGoodLinking } from "@/features/linking/useJournalPartnerGoodLinking";
import { fetchJournalLinksForPartner } from "@/services/clientJournalPartnerLinkService";

import DynamicSlider from "@/features/shared/components/DynamicSlider";
import PartnerOptionsMenu from "@/features/partners/components/PartnerOptionsMenu";
import AddEditPartnerModal from "@/features/partners/components/AddEditPartnerModal";
import LinkPartnerToJournalsModal from "@/features/linking/components/LinkPartnerToJournalsModal";
import UnlinkPartnerFromJournalsModal from "@/features/linking/components/UnlinkPartnerFromJournalsModal";
import { SLIDER_TYPES } from "@/lib/constants";
import type {
  AccountNodeData,
  CreateJournalPartnerGoodLinkClientData,
} from "@/lib/types";

// Props remain the same
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
  const jpqlLinking = useJournalPartnerGoodLinking();

  const { isCreating } = useAppStore((state) => state.ui.documentCreationState);
  const isDetailsAccordionOpen = useAppStore(
    (state) => !!state.ui.accordionState[SLIDER_TYPES.PARTNER]
  );
  const toggleAccordion = useAppStore((state) => state.toggleAccordion);

  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const gpgContextJournalId = useAppStore(
    (state) => state.selections.gpgContextJournalId
  );
  const selectedGoodsId = useAppStore((state) => state.selections.goods);

  // The logic for GPG linking remains unchanged
  const isGPStartOrder = useMemo(() => {
    const visibleSliders = sliderOrder.filter((id) => visibility[id]);
    return (
      visibleSliders.length >= 2 &&
      visibleSliders[0] === SLIDER_TYPES.GOODS &&
      visibleSliders[1] === SLIDER_TYPES.PARTNER
    );
  }, [sliderOrder, visibility]);

  const handleCreateGPGLink = useCallback(() => {
    if (
      !gpgContextJournalId ||
      !selectedGoodsId ||
      !partnerManager.selectedPartnerId
    )
      return;
    const linkData: CreateJournalPartnerGoodLinkClientData = {
      journalId: gpgContextJournalId,
      partnerId: partnerManager.selectedPartnerId,
      goodId: selectedGoodsId,
    };
    jpqlLinking.createSimpleJPGL(linkData);
  }, [
    gpgContextJournalId,
    selectedGoodsId,
    partnerManager.selectedPartnerId,
    jpqlLinking,
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

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.controlsLeftGroup}>
          <button
            onClick={partnerManager.handleOpenPartnerOptionsMenu}
            className={`${styles.controlButton} ${styles.editButton}`}
            aria-label="Options for Partner"
            disabled={isCreating}
          >
            <IoOptionsOutline />
          </button>
        </div>

        <div className={styles.moveButtonGroup}>
          {canMoveUp && (
            <button
              onClick={onMoveUp}
              className={styles.controlButton}
              disabled={isMoveDisabled || isCreating}
            >
              ▲ Up
            </button>
          )}
          {canMoveDown && (
            <button
              onClick={onMoveDown}
              className={styles.controlButton}
              disabled={isMoveDisabled || isCreating}
            >
              ▼ Down
            </button>
          )}
        </div>
      </div>

      <DynamicSlider
        sliderId={SLIDER_TYPES.PARTNER}
        title="Partner"
        // --- THIS IS THE FIX ---
        data={(partnerManager.partnersForSlider || []).map((p) => ({
          ...p,
          id: String(p.id),
          label: p.name, // Use 'label' for the display name, not 'name'.
          code: p.registrationNumber, // Use registrationNumber for the sub-text, and it will be empty if not present.
        }))}
        isLoading={
          partnerManager.partnerQuery.isLoading ||
          partnerManager.partnerQuery.isFetching
        }
        isError={partnerManager.partnerQuery.isError}
        error={partnerManager.partnerQuery.error}
        activeItemId={partnerManager.selectedPartnerId}
        onSlideChange={partnerManager.setSelectedPartnerId}
        isAccordionOpen={isDetailsAccordionOpen}
        onToggleAccordion={() => toggleAccordion(SLIDER_TYPES.PARTNER)}
        isLocked={isCreating}
      />

      {/* All modals remain unchanged and correctly wired */}
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
