"use client";

import React, { useMemo, useCallback, forwardRef } from "react";
import { findNodeById } from "@/lib/helpers";
import { IoOptionsOutline } from "react-icons/io5";
import styles from "@/app/page.module.css";
import { useAppStore } from "@/store/appStore";
import { useGoodManager } from "./useGoodManager";
import { useGoodJournalLinking } from "@/features/linking/useGoodJournalLinking";
import { fetchJournalLinksForGood } from "@/services/clientJournalGoodLinkService";

import DynamicSlider from "@/features/shared/components/DynamicSlider";
import GoodsOptionsMenu from "@/features/goods/components/GoodsOptionsMenu";
import AddEditGoodModal from "@/features/goods/components/AddEditGoodModal";
import LinkGoodToJournalsModal from "@/features/linking/components/LinkGoodToJournalsModal";
import UnlinkGoodFromJournalsModal from "@/features/linking/components/UnlinkGoodFromJournalsModal";
import { SLIDER_TYPES } from "@/lib/constants";
import type {
  AccountNodeData,
  Good,
  DocumentLineClientData,
} from "@/lib/types";

interface LayoutControlProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoveDisabled: boolean;
}
export interface GoodsSliderControllerProps extends LayoutControlProps {
  onOpenJournalSelectorForLinking: (
    onSelectCallback: (journalNode: AccountNodeData) => void
  ) => void;
  onOpenJournalSelectorForGPGContext: () => void;
  fullJournalHierarchy: AccountNodeData[];
  onOpenLinkGoodToPartnersModal?: () => void;
  onOpenUnlinkGoodFromPartnersModal?: () => void;

  // --- PROPS FOR DOCUMENT CREATION ---
  documentLines?: DocumentLineClientData[];
  onToggleGoodForDocument?: (good: Good) => void;
  isGoodInDocument?: (good: Good) => boolean;
  onUpdateLineForDocument?: (
    jpqLinkId: string,
    details: { quantity?: number; unitPrice?: number }
  ) => void;
}

export interface GoodsSliderControllerRef {
  openDetailsAccordion: () => void;
}

export const GoodsSliderController = forwardRef<
  GoodsSliderControllerRef,
  GoodsSliderControllerProps
>(
  (
    {
      onOpenJournalSelectorForLinking,
      onOpenJournalSelectorForGPGContext,
      fullJournalHierarchy,
      onOpenLinkGoodToPartnersModal,
      onOpenUnlinkGoodFromPartnersModal,
      canMoveUp,
      canMoveDown,
      onMoveUp,
      onMoveDown,
      isMoveDisabled,
      // Destructure the props directly
      documentLines,
      onToggleGoodForDocument,
      isGoodInDocument,
      onUpdateLineForDocument,
    },
    ref
  ) => {
    const goodManager = useGoodManager();
    const goodJournalLinking = useGoodJournalLinking();

    const { isCreating } = useAppStore(
      (state) => state.ui.documentCreationState
    );

    const isDetailsAccordionOpen = useAppStore(
      (state) => !!state.ui.accordionState[SLIDER_TYPES.GOODS]
    );
    const toggleAccordion = useAppStore((state) => state.toggleAccordion);

    const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
    const visibility = useAppStore((state) => state.ui.visibility);
    const selections = useAppStore((state) => state.selections);

    const { journal: journalSelections, gpgContextJournalId } = selections;

    const canLinkGoodToPartnersViaJournal = useMemo(() => {
      const journalIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
      const goodsIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);
      const effectiveJournalIds = [
        journalSelections.topLevelId,
        ...journalSelections.level2Ids,
        ...journalSelections.level3Ids,
      ].filter(Boolean);

      return (
        visibility[SLIDER_TYPES.JOURNAL] &&
        visibility[SLIDER_TYPES.GOODS] &&
        journalIndex === 0 &&
        goodsIndex === 1 &&
        effectiveJournalIds.length > 0 &&
        !!goodManager.selectedGoodsId
      );
    }, [
      sliderOrder,
      visibility,
      journalSelections,
      goodManager.selectedGoodsId,
    ]);

    const canUnlinkGoodFromPartnersViaJournal = useMemo(() => {
      const journalIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
      const goodsIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);
      const effectiveJournalIds = [
        journalSelections.topLevelId,
        ...journalSelections.level2Ids,
        ...journalSelections.level3Ids,
      ].filter(Boolean);

      let journalContextAvailable = false;
      if (journalIndex === 0) {
        journalContextAvailable = effectiveJournalIds.length > 0;
      } else {
        journalContextAvailable = !!journalSelections.flatId;
      }

      return (
        visibility[SLIDER_TYPES.GOODS] &&
        goodsIndex !== -1 &&
        journalContextAvailable &&
        !!goodManager.selectedGoodsId
      );
    }, [
      sliderOrder,
      visibility,
      journalSelections,
      goodManager.selectedGoodsId,
    ]);

    const isGPStartOrder = useMemo(() => {
      const visibleSliders = sliderOrder.filter((id) => visibility[id]);
      return (
        visibleSliders.length >= 2 &&
        visibleSliders[0] === SLIDER_TYPES.GOODS &&
        visibleSliders[1] === SLIDER_TYPES.PARTNER
      );
    }, [sliderOrder, visibility]);

    const gpgContextJournalName = useMemo(() => {
      if (
        isGPStartOrder &&
        gpgContextJournalId &&
        fullJournalHierarchy.length > 0
      ) {
        const foundNode = findNodeById(
          fullJournalHierarchy,
          gpgContextJournalId
        );
        return foundNode?.name;
      }
      return undefined;
    }, [isGPStartOrder, gpgContextJournalId, fullJournalHierarchy]);

    const handleSlideClick = useCallback(
      (id: string | null) => {
        if (id) {
          goodManager.setSelectedGoodsId(id);
        }
      },
      [goodManager.setSelectedGoodsId]
    );

    return (
      <>
        <div className={styles.controls}>
          <div className={styles.controlsLeftGroup}>
            <button
              onClick={goodManager.handleOpenGoodsOptionsMenu}
              className={`${styles.controlButton} ${styles.editButton}`}
              aria-label="Options for Goods"
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
          sliderId={SLIDER_TYPES.GOODS}
          title="Goods"
          data={goodManager.goodsForSlider}
          isLoading={
            goodManager.goodsQueryState.isLoading ||
            goodManager.goodsQueryState.isFetching
          }
          isError={goodManager.goodsQueryState.isError}
          error={goodManager.goodsQueryState.error}
          activeItemId={goodManager.selectedGoodsId}
          onSlideChange={handleSlideClick}
          isAccordionOpen={isDetailsAccordionOpen}
          onToggleAccordion={() => toggleAccordion(SLIDER_TYPES.GOODS)}
          isDocumentCreationMode={isCreating}
          documentLines={documentLines}
          onToggleGoodForDoc={onToggleGoodForDocument}
          isGoodInDocument={isGoodInDocument}
          onUpdateLineForDocument={onUpdateLineForDocument}
          showContextJournalFilterButton={
            isGPStartOrder && !gpgContextJournalId
          }
          onOpenContextJournalFilterModal={onOpenJournalSelectorForGPGContext}
          gpgContextJournalInfo={
            isGPStartOrder && gpgContextJournalId
              ? {
                  id: gpgContextJournalId,
                  name: gpgContextJournalName,
                  onClear: () => {},
                }
              : undefined
          }
        />

        <GoodsOptionsMenu
          isOpen={goodManager.isGoodsOptionsMenuOpen}
          onClose={goodManager.handleCloseGoodsOptionsMenu}
          anchorEl={goodManager.goodsOptionsMenuAnchorEl}
          selectedGoodsId={goodManager.selectedGoodsId}
          onAdd={goodManager.handleOpenAddGoodModal}
          onEdit={goodManager.handleOpenEditGoodModal}
          onDelete={goodManager.handleDeleteCurrentGood}
          onLinkToJournals={goodJournalLinking.openLinkModal}
          onUnlinkFromJournals={goodJournalLinking.openUnlinkModal}
          onOpenLinkGoodToPartnersModal={onOpenLinkGoodToPartnersModal}
          canOpenLinkGoodToPartnersModal={canLinkGoodToPartnersViaJournal}
          onOpenUnlinkGoodFromPartnersModal={onOpenUnlinkGoodFromPartnersModal}
          canOpenUnlinkGoodFromPartnersModal={
            canUnlinkGoodFromPartnersViaJournal
          }
        />
        <AddEditGoodModal
          isOpen={goodManager.isAddEditGoodModalOpen}
          onClose={goodManager.handleCloseAddEditGoodModal}
          onSubmit={goodManager.handleAddOrUpdateGoodSubmit}
          initialData={goodManager.editingGoodData}
          isSubmitting={
            goodManager.createGoodMutation.isPending ||
            goodManager.updateGoodMutation.isPending
          }
        />
        {goodJournalLinking.isLinkModalOpen && (
          <LinkGoodToJournalsModal
            isOpen={goodJournalLinking.isLinkModalOpen}
            onClose={goodJournalLinking.closeLinkModal}
            onSubmitLinks={goodJournalLinking.submitLinks}
            goodToLink={goodJournalLinking.goodForLinking}
            isSubmitting={goodJournalLinking.isSubmittingLinks}
            onOpenJournalSelector={onOpenJournalSelectorForLinking}
          />
        )}
        {goodJournalLinking.isUnlinkModalOpen &&
          goodJournalLinking.goodForUnlinking && (
            <UnlinkGoodFromJournalsModal
              isOpen={goodJournalLinking.isUnlinkModalOpen}
              onClose={goodJournalLinking.closeUnlinkModal}
              good={goodJournalLinking.goodForUnlinking}
              onUnlink={goodJournalLinking.submitUnlink}
              fetchLinksFn={() =>
                fetchJournalLinksForGood(
                  goodJournalLinking.goodForUnlinking!.id
                )
              }
              isUnlinking={goodJournalLinking.isSubmittingUnlink}
            />
          )}
      </>
    );
  }
);

GoodsSliderController.displayName = "GoodsSliderController";
