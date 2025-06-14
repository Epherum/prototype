//src/features/goods/GoodsSliderController.tsx
"use client";

import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { findNodeById } from "@/lib/helpers";
import { IoOptionsOutline } from "react-icons/io5";
import styles from "@/app/page.module.css";
import { useAppStore } from "@/store/appStore";
import { useGoodManager } from "./useGoodManager";
import { useGoodJournalLinking } from "@/features/linking/useGoodJournalLinking";
import { fetchJournalLinksForGood } from "@/services/clientJournalGoodLinkService";
import { useSharedDocumentManager } from "@/features/documents/documentController";

import DynamicSlider from "@/features/shared/components/DynamicSlider";
import GoodsOptionsMenu from "@/features/goods/components/GoodsOptionsMenu";
import AddEditGoodModal from "@/features/goods/components/AddEditGoodModal";
import LinkGoodToJournalsModal from "@/features/linking/components/LinkGoodToJournalsModal";
import UnlinkGoodFromJournalsModal from "@/features/linking/components/UnlinkGoodFromJournalsModal";
import { SLIDER_TYPES } from "@/lib/constants";
import type { AccountNodeData, Good } from "@/lib/types";

interface DynamicSliderItem {
  id: string;
  name: string;
  code?: string;
  unit_code?: string;
  [key: string]: any;
}
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
    },
    ref
  ) => {
    const goodManager = useGoodManager();
    const goodJournalLinking = useGoodJournalLinking();
    const documentCreation = useSharedDocumentManager();

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

    const selectedGoodsForDocAdapter = useMemo(() => {
      return documentCreation.selectedGoodsForDocument.map((good) => ({
        ...good,
        id: String(good.id),
        name: good.label || good.name || "Unnamed Good",
      }));
    }, [documentCreation.selectedGoodsForDocument]);

    const handleToggleGoodForDocAdapter = useCallback(
      (item: DynamicSliderItem) => {
        const goodData = goodManager.goodsForSlider;
        if (!Array.isArray(goodData)) return;

        const goodToToggle =
          documentCreation.selectedGoodsForDocument.find(
            (g) => String(g.id) === item.id
          ) || goodData.find((g) => String(g.id) === item.id);

        if (goodToToggle) {
          documentCreation.handleToggleGoodForDocument(goodToToggle as Good);
        }
      },
      [documentCreation, goodManager.goodsForSlider]
    );

    const handleUpdateGoodDetailForDocAdapter = useCallback(
      (itemId: string, detail: { quantity?: number; price?: number }) => {
        if (detail.quantity !== undefined) {
          documentCreation.handleUpdateGoodDetailForDocument(
            itemId,
            "quantity",
            detail.quantity
          );
        }
        if (detail.price !== undefined) {
          documentCreation.handleUpdateGoodDetailForDocument(
            itemId,
            "price",
            detail.price
          );
        }
      },
      [documentCreation.handleUpdateGoodDetailForDocument]
    );

    const goodsForSliderData = useMemo(() => {
      const data = goodManager.goodsForSlider;
      if (!Array.isArray(data)) return [];

      return data.map((g) => ({
        ...g,
        id: String(g.id),
        name: g.label,
        code: g.referenceCode || String(g.id),
        unit_code: g.unitOfMeasure?.code || (g as any).unit || "N/A",
      }));
    }, [goodManager.goodsForSlider]);

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
          data={goodsForSliderData}
          isLoading={
            goodManager.goodsQueryState.isLoading ||
            goodManager.goodsQueryState.isFetching
          }
          isError={goodManager.goodsQueryState.isError}
          error={goodManager.goodsQueryState.error}
          activeItemId={goodManager.selectedGoodsId}
          onSlideChange={goodManager.setSelectedGoodsId}
          isAccordionOpen={isDetailsAccordionOpen}
          onToggleAccordion={() => toggleAccordion(SLIDER_TYPES.GOODS)}
          isDocumentCreationMode={documentCreation.isDocumentCreationMode}
          selectedGoodsForDoc={selectedGoodsForDocAdapter}
          onToggleGoodForDoc={handleToggleGoodForDocAdapter}
          onUpdateGoodDetailForDoc={handleUpdateGoodDetailForDocAdapter}
          showContextJournalFilterButton={
            isGPStartOrder && !gpgContextJournalId
          }
          onOpenContextJournalFilterModal={onOpenJournalSelectorForGPGContext}
          gpgContextJournalInfo={
            isGPStartOrder && gpgContextJournalId
              ? {
                  id: gpgContextJournalId,
                  name: gpgContextJournalName,
                  onClear: () =>
                    useAppStore
                      .getState()
                      .setSelection("gpgContextJournalId", null),
                }
              : undefined
          }
        />

        {/* Modals remain unchanged */}
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
