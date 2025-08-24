// src/features/goods/GoodsSliderController.tsx
"use client";

import React, { useMemo, useCallback, forwardRef } from "react";
import { findNodeById } from "@/lib/helpers";
import { IoOptionsOutline } from "react-icons/io5";
import styles from "@/app/page.module.css";
import { useAppStore } from "@/store/appStore";
import { useGoodManager } from "./useGoodManager";
import { useConfirmation } from "@/hooks/useConfirmation";
import { ConfirmationModal } from "@/components/notifications/ConfirmationModal";
import { useGoodJournalLinking } from "@/features/linking/useGoodJournalLinking";
import { getJournalGoodLinks } from "@/services/clientJournalGoodLinkService";
import DynamicSlider from "@/features/shared/components/DynamicSlider";
import GoodsOptionsMenu from "./components/GoodsOptionsMenu";
import AddEditGoodModal from "./components/AddEditGoodModal";
import LinkGoodToJournalsModal from "@/features/linking/components/LinkGoodToJournalsModal";
import UnlinkGoodFromJournalsModal from "@/features/linking/components/UnlinkGoodFromJournalsModal";
import JournalPartnerGoodLinkModal from "@/features/linking/components/JournalPartnerGoodLinkModal";
import { useJournalPartnerGoodLinkManager } from "@/features/linking/useJournalPartnerGoodLinkManager";
import { SLIDER_TYPES } from "@/lib/constants";
import type { AccountNodeData } from "@/lib/types/ui";

export interface GoodsSliderControllerProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoveDisabled: boolean;
  onOpenJournalSelectorForLinking: (
    cb: (node: AccountNodeData) => void
  ) => void;
  onOpenJournalSelectorForGPGContext: () => void;
  fullJournalHierarchy: AccountNodeData[];
  onOpenLinkGoodToPartnersModal?: () => void;
  onOpenUnlinkGoodFromPartnersModal?: () => void;
  isLocked: boolean;
  isMultiSelect: boolean;
  selectedGoodIdsForDoc: string[];
  onToggleGoodForDoc: (goodId: string) => void;
}

export const GoodsSliderController = forwardRef<
  any,
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
      isLocked,
      isMultiSelect,
      selectedGoodIdsForDoc,
      onToggleGoodForDoc,
    },
    ref
  ) => {
    const goodManager = useGoodManager();
    const { confirmation, hideConfirmation, confirmDelete } = useConfirmation();
    const goodJournalLinking = useGoodJournalLinking();
    const { isCreating, mode, items: documentItems } = useAppStore(
      (state) => state.ui.documentCreationState
    );

    const handleDeleteWithConfirmation = useCallback(() => {
      confirmDelete("goods/service", goodManager.deleteCurrentGood);
    }, [confirmDelete, goodManager.deleteCurrentGood]);
    const updateDocumentItem = useAppStore((state) => state.updateDocumentItem);
    const isDetailsAccordionOpen = useAppStore(
      (state) => !!state.accordionState[SLIDER_TYPES.GOODS]
    );
    const toggleAccordion = useAppStore((state) => state.toggleAccordion);
    const sliderOrder = useAppStore((state) => state.sliderOrder);
    const visibility = useAppStore((state) => state.visibility);
    const { journal: journalSelections, gpgContextJournalId, effectiveJournalIds } = useAppStore(
      (state) => state.selections
    );

    // Get selected good for the new link management modal
    const selectedGood = useMemo(() => {
      if (!goodManager.selectedGoodsId) return null;
      return goodManager.goodsForSlider.find(g => g.id === goodManager.selectedGoodsId) || null;
    }, [goodManager.selectedGoodsId, goodManager.goodsForSlider]);

    // New Journal-Partner-Good link management
    const jpgLinkManager = useJournalPartnerGoodLinkManager({
      selectedJournalIds: effectiveJournalIds,
      selectedEntity: selectedGood,
      mode: "good-to-partners",
    });

    // Check if journal slider comes before goods slider for filter color coding
    const shouldShowFilterColors = useMemo(() => {
      const visibleSliders = sliderOrder.filter((id) => visibility[id]);
      const journalIndex = visibleSliders.indexOf(SLIDER_TYPES.JOURNAL);
      const goodsIndex = visibleSliders.indexOf(SLIDER_TYPES.GOODS);
      return journalIndex !== -1 && goodsIndex !== -1 && journalIndex < goodsIndex;
    }, [sliderOrder, visibility]);

    const handleItemClick = (id: string) => {
      if (isMultiSelect) {
        onToggleGoodForDoc(id);
        // Update the document item label when a good is selected
        const selectedGood = goodManager.goodsForSlider.find(g => g.id === id);
        if (selectedGood) {
          setTimeout(() => {
            updateDocumentItem(id, { goodLabel: selectedGood.label });
          }, 0);
        }
      } else {
        goodManager.setSelectedGoodsId(id);
      }
    };

    // Prepare document items with updated labels for display
    const documentItemsWithLabels = React.useMemo(() => {
      return documentItems.map(item => {
        const goodData = goodManager.goodsForSlider.find(g => g.id === item.goodId);
        return {
          ...item,
          goodLabel: goodData?.label || item.goodLabel
        };
      });
    }, [documentItems, goodManager.goodsForSlider]);

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
      let journalContextAvailable =
        journalIndex === 0
          ? effectiveJournalIds.length > 0
          : !!journalSelections.flatId;
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

    return (
      <>
        <div className={styles.controls}>
          <div className={styles.controlsLeftGroup}>
            {/* --- FIX: STEP 1 - CREATE THE WRAPPER DIV --- */}
            {/* This div becomes the positioning context for the menu. */}
            <div className={styles.optionsButtonContainer}>
              <button
                onClick={goodManager.handleOpenGoodsOptionsMenu}
                className={`${styles.controlButton} ${styles.editButton}`}
                aria-label="Options for Goods"
                disabled={isCreating}
              >
                <IoOptionsOutline />
              </button>

              {/* --- FIX: STEP 2 - MOVE THE MENU INSIDE THE WRAPPER --- */}
              {/* Now the menu is a direct child of its positioning context. */}
              <GoodsOptionsMenu
                isOpen={goodManager.isGoodsOptionsMenuOpen}
                onClose={goodManager.handleCloseGoodsOptionsMenu}
                // The anchorEl is still useful to determine if the menu should be open
                anchorEl={goodManager.goodsOptionsMenuAnchorEl}
                selectedGoodsId={goodManager.selectedGoodsId}
                onAdd={goodManager.handleOpenAddGoodModal}
                onEdit={goodManager.handleOpenEditGoodModal}
                onDelete={handleDeleteWithConfirmation}
                onLinkToJournals={goodJournalLinking.openLinkModal}
                onUnlinkFromJournals={goodJournalLinking.openUnlinkModal}
                onOpenLinkGoodToPartnersModal={onOpenLinkGoodToPartnersModal}
                canOpenLinkGoodToPartnersModal={canLinkGoodToPartnersViaJournal}
                onOpenUnlinkGoodFromPartnersModal={
                  onOpenUnlinkGoodFromPartnersModal
                }
                canOpenUnlinkGoodFromPartnersModal={
                  canUnlinkGoodFromPartnersViaJournal
                }
                onManagePartnerLinks={effectiveJournalIds.length > 0 ? jpgLinkManager.openModal : undefined}
              />
            </div>
            <div className={styles.countDisplay}>
              {goodManager.goodsQueryState.isLoading ? (
                "Loading..."
              ) : goodManager.goodsQueryState.isError ? (
                "Error"
              ) : (
                `${goodManager.goodsQueryState.data?.totalCount || 0} goods`
              )}
            </div>
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
          data={goodManager.goodsForSlider.map((g: any) => ({
            ...g,
            // Add formatted journal information for display with ID and name
            journalNames: g.journalGoodLinks?.map((link: any) => 
              link.journal ? `${link.journal.id} - ${link.journal.name}` : null
            ).filter(Boolean).join(", ") || "No journals",
          }))}
          isLoading={
            goodManager.goodsQueryState.isLoading ||
            goodManager.goodsQueryState.isFetching
          }
          isError={goodManager.goodsQueryState.isError}
          error={goodManager.goodsQueryState.error}
          activeItemId={goodManager.selectedGoodsId}
          onSlideChange={goodManager.setSelectedGoodsId}
          onItemClick={handleItemClick}
          isItemSelected={(item) => selectedGoodIdsForDoc.includes(item.id)}
          isLocked={isLocked}
          isMultiSelect={isMultiSelect}
          placeholderMessage={
            isCreating
              ? "Select goods for document creation."
              : "No goods match criteria."
          }
          isAccordionOpen={isDetailsAccordionOpen}
          onToggleAccordion={() => toggleAccordion(SLIDER_TYPES.GOODS)}
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
          showDocumentItemInputs={isCreating && isMultiSelect && !isLocked}
          documentItems={documentItemsWithLabels}
          onUpdateDocumentItem={updateDocumentItem}
          currentFilter={shouldShowFilterColors ? journalSelections.rootFilter[0] : undefined}
          activeFilters={shouldShowFilterColors ? journalSelections.rootFilter : []}
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
          onOpenJournalSelector={onOpenJournalSelectorForLinking}
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
                getJournalGoodLinks({
                  goodId: goodJournalLinking.goodForUnlinking!.id,
                })
              }
              isUnlinking={goodJournalLinking.isSubmittingUnlink}
            />
          )}

        {/* New Journal-Partner-Good Link Management Modal */}
        <JournalPartnerGoodLinkModal
          isOpen={jpgLinkManager.isModalOpen}
          onClose={jpgLinkManager.closeModal}
          mode="good-to-partners"
          selectedJournalIds={effectiveJournalIds}
          selectedEntity={selectedGood}
          availableItems={jpgLinkManager.availableItems}
          existingLinks={jpgLinkManager.existingLinks}
          onCreateLinks={jpgLinkManager.handleCreateLinks}
          onDeleteLinks={jpgLinkManager.handleDeleteLinks}
          isSubmitting={jpgLinkManager.isSubmitting}
        />

        <ConfirmationModal
          isOpen={confirmation.isOpen}
          onClose={hideConfirmation}
          onConfirm={confirmation.onConfirm}
          title={confirmation.title}
          message={confirmation.message}
          confirmText={confirmation.confirmText}
          cancelText={confirmation.cancelText}
          type={confirmation.type}
        />
      </>
    );
  }
);
GoodsSliderController.displayName = "GoodsSliderController";
