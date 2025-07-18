// src/features/partners/PartnerSliderController.tsx
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
import PartnerOptionsMenu from "./components/PartnerOptionsMenu";
import AddEditPartnerModal from "./components/AddEditPartnerModal";
import LinkPartnerToJournalsModal from "@/features/linking/components/LinkPartnerToJournalsModal";
import UnlinkPartnerFromJournalsModal from "@/features/linking/components/UnlinkPartnerFromJournalsModal";
import { SLIDER_TYPES } from "@/lib/constants";
import type {
  AccountNodeData,
  CreateJournalPartnerGoodLinkClientData,
  Partner,
} from "@/lib/types";

export interface PartnerSliderControllerProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoveDisabled: boolean;
  onOpenJournalSelector: (cb: (node: AccountNodeData) => void) => void;
  fullJournalHierarchy: AccountNodeData[];
  isLocked: boolean;
  isMultiSelect: boolean;
  selectedPartnerIdsForDoc: string[];
  onTogglePartnerForDoc: (partnerId: string) => void;
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
  isLocked,
  isMultiSelect,
  selectedPartnerIdsForDoc,
  onTogglePartnerForDoc,
}) => {
  const partnerManager = usePartnerManager();
  const partnerJournalLinking = usePartnerJournalLinking();
  const jpqlLinking = useJournalPartnerGoodLinking();
  const { isCreating } = useAppStore((state) => state.ui.documentCreationState);
  const isDetailsAccordionOpen = useAppStore(
    (state) => !!state.ui.accordionState[SLIDER_TYPES.PARTNER]
  );
  const toggleAccordion = useAppStore((state) => state.toggleAccordion);
  const { sliderOrder, visibility } = useAppStore((state) => state.ui);
  const { gpgContextJournalId, goods: selectedGoodsId } = useAppStore(
    (state) => state.selections
  );

  const handleItemClick = (id: string) => {
    if (isMultiSelect) {
      onTogglePartnerForDoc(id);
    } else {
      partnerManager.setSelectedPartnerId(id);
    }
  };

  const isGPStartOrder = useMemo(() => {
    const visibleSliders = sliderOrder.filter((id) => visibility[id]);
    return (
      visibleSliders[0] === SLIDER_TYPES.GOODS &&
      visibleSliders[1] === SLIDER_TYPES.PARTNER
    );
  }, [sliderOrder, visibility]);

  const canCreateGPGLink = useMemo(
    () =>
      isGPStartOrder &&
      !!gpgContextJournalId &&
      !!selectedGoodsId &&
      !!partnerManager.selectedPartnerId,
    [
      isGPStartOrder,
      gpgContextJournalId,
      selectedGoodsId,
      partnerManager.selectedPartnerId,
    ]
  );

  const handleCreateGPGLink = useCallback(() => {
    if (!canCreateGPGLink) return;
    const linkData: CreateJournalPartnerGoodLinkClientData = {
      journalId: gpgContextJournalId!,
      partnerId: partnerManager.selectedPartnerId!,
      goodId: selectedGoodsId!,
    };
    jpqlLinking.createSimpleJPGL(linkData);
  }, [
    canCreateGPGLink,
    gpgContextJournalId,
    selectedGoodsId,
    partnerManager.selectedPartnerId,
    jpqlLinking,
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
        sliderId={SLIDER_TYPES.PARTNER}
        title="Partner"
        data={(partnerManager.partnersForSlider || []).map((p: Partner) => ({
          id: String(p.id),
          label: p.name,
          code: p.registrationNumber,
        }))}
        isLoading={
          partnerManager.partnerQuery.isLoading ||
          partnerManager.partnerQuery.isFetching
        }
        isError={partnerManager.partnerQuery.isError}
        error={partnerManager.partnerQuery.error}
        activeItemId={partnerManager.selectedPartnerId}
        onSlideChange={
          isMultiSelect ? () => {} : partnerManager.setSelectedPartnerId
        }
        onItemClick={handleItemClick}
        isItemSelected={(item) => selectedPartnerIdsForDoc.includes(item.id)}
        isLocked={isLocked}
        isMultiSelect={isMultiSelect}
        placeholderMessage={
          isCreating
            ? "Select goods to see common partners."
            : "No partners match criteria."
        }
        isAccordionOpen={isDetailsAccordionOpen}
        onToggleAccordion={() => toggleAccordion(SLIDER_TYPES.PARTNER)}
      />
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
