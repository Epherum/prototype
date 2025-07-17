//src/features/journals/JournalSliderController.tsx
"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { journalKeys } from "@/lib/queryKeys";
import { IoOptionsOutline } from "react-icons/io5";
import styles from "@/app/page.module.css";

// Store & Hooks
import { useAppStore } from "@/store/appStore";
import { useJournalManager } from "./useJournalManager";

// Services & Libs
import {
  fetchJournalsLinkedToGood,
  fetchJournalsLinkedToPartner,
} from "@/services/clientJournalService";
import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import { findNodeById, findParentOfNode } from "@/lib/helpers";

// UI Components
import JournalHierarchySlider from "@/features/journals/components/JournalHierarchySlider";
import DynamicSlider from "@/features/shared/components/DynamicSlider";
import JournalModal from "@/features/journals/components/JournalModal";
import AddJournalModal from "@/features/journals/components/AddJournalModal";

// Types
import type {
  AccountNodeData,
  Journal,
  PartnerGoodFilterStatus,
} from "@/lib/types";

export interface JournalSliderControllerRef {
  openJournalSelector: (cb: (node: AccountNodeData) => void) => void;
  openJournalSelectorForGPG: () => void;
}
interface LayoutControlProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoveDisabled: boolean;
}
export interface JournalSliderControllerProps extends LayoutControlProps {}

export const JournalSliderController = forwardRef<
  JournalSliderControllerRef,
  JournalSliderControllerProps
>(({ canMoveUp, canMoveDown, onMoveUp, onMoveDown, isMoveDisabled }, ref) => {
  const journalManager = useJournalManager();
  const { isCreating } = useAppStore((state) => state.ui.documentCreationState);
  const restrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );
  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const selectedPartnerId = useAppStore((state) => state.selections.partner);
  const selectedGoodsId = useAppStore((state) => state.selections.goods);
  const setSelection = useAppStore((state) => state.setSelection);

  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [onSelectForLinkingCallback, setOnSelectForLinkingCallback] = useState<
    ((node: AccountNodeData) => void) | null
  >(null);
  const [isGpgContextModalOpen, setIsGpgContextModalOpen] = useState(false);

  const topLevelContextNode = useMemo(() => {
    if (
      !journalManager.isJournalSliderPrimary ||
      !journalManager.selectedTopLevelId
    )
      return null;
    const isAtRoot =
      journalManager.selectedTopLevelId ===
      (restrictedJournalId || ROOT_JOURNAL_ID);
    if (isAtRoot) return null; // Don't show top button in Admin View
    return findNodeById(
      journalManager.hierarchyData,
      journalManager.selectedTopLevelId
    );
  }, [
    journalManager.isJournalSliderPrimary,
    journalManager.selectedTopLevelId,
    journalManager.hierarchyData,
    restrictedJournalId,
  ]);

  useImperativeHandle(ref, () => ({
    openJournalSelector: (callback) => {
      setOnSelectForLinkingCallback(() => callback);
      setIsLinkingModalOpen(true);
    },
    openJournalSelectorForGPG: () => setIsGpgContextModalOpen(true),
  }));

  const flatJournalsByPartnerQuery = useQuery<Journal[], Error>({
    queryKey: journalKeys.flatListByPartner(selectedPartnerId),
    queryFn: () => fetchJournalsLinkedToPartner(selectedPartnerId!),
    enabled:
      sliderOrder.indexOf(SLIDER_TYPES.PARTNER) <
        sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) && !!selectedPartnerId,
  });
  const flatJournalsByGoodQuery = useQuery<Journal[], Error>({
    queryKey: journalKeys.flatListByGood(selectedGoodsId),
    queryFn: () => fetchJournalsLinkedToGood(selectedGoodsId!),
    enabled:
      sliderOrder.indexOf(SLIDER_TYPES.GOODS) <
        sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) && !!selectedGoodsId,
  });

  const renderSlider = () => {
    if (journalManager.isJournalSliderPrimary) {
      return (
        <JournalHierarchySlider
          isLocked={isCreating}
          sliderId={SLIDER_TYPES.JOURNAL}
          hierarchyData={journalManager.currentHierarchy}
          fullHierarchyData={journalManager.hierarchyData}
          selectedLevel2Ids={journalManager.selectedLevel2Ids}
          selectedLevel3Ids={journalManager.selectedLevel3Ids}
          // ✅ PASS THE CORRECTED HANDLERS
          onL1ItemInteract={journalManager.handleL1Interaction}
          onL2ItemToggle={journalManager.handleL2ManualToggle}
          isLoading={journalManager.isHierarchyLoading}
          onToggleFilter={journalManager.handleToggleJournalRootFilter}
          activeFilters={
            journalManager.activeJournalRootFilters as PartnerGoodFilterStatus[]
          }
        />
      );
    }
    // ... (rest of the rendering logic is unchanged)
    let queryToUse = null;
    if (
      sliderOrder.indexOf(SLIDER_TYPES.PARTNER) <
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL)
    )
      queryToUse = flatJournalsByPartnerQuery;
    else if (
      sliderOrder.indexOf(SLIDER_TYPES.GOODS) <
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL)
    )
      queryToUse = flatJournalsByGoodQuery;
    if (queryToUse)
      return (
        <DynamicSlider
          isLocked={isCreating}
          sliderId={SLIDER_TYPES.JOURNAL}
          title="Journal (Filtered)"
          data={(queryToUse.data || []).map((j) => ({
            id: String(j.id),
            name: j.name,
            code: String(j.id),
          }))}
          isLoading={queryToUse.isLoading}
          isError={queryToUse.isError}
          error={queryToUse.error}
          activeItemId={journalManager.selectedFlatJournalId}
          onSlideChange={journalManager.setSelectedFlatJournalId}
          isAccordionOpen={false}
          onToggleAccordion={() => {}}
        />
      );
    return (
      <DynamicSlider
        isLocked={false}
        sliderId={SLIDER_TYPES.JOURNAL}
        title="Journal"
        data={[]}
        isLoading={false}
        placeholderMessage="Context determined by preceding slider."
        activeItemId={null}
        onSlideChange={() => {}}
        isAccordionOpen={false}
        onToggleAccordion={() => {}}
      />
    );
  };

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.controlsLeftGroup}>
          <button
            onClick={journalManager.openJournalNavModal}
            className={`${styles.controlButton} ${styles.editButton}`}
            aria-label="Options"
            disabled={isCreating}
          >
            <IoOptionsOutline />
          </button>
          {topLevelContextNode && (
            <div
              className={`${styles.journalParentInfo} ${
                isCreating ? styles.locked : ""
              }`}
              // ✅ FIX: Use the single, unified click handler.
              // This now correctly handles both single and double clicks.
              onClick={journalManager.handleTopButtonClick}
              title={`${topLevelContextNode.code} - ${topLevelContextNode.name}. Single-click to cycle selections. Double-click to navigate up.`}
            >
              {topLevelContextNode.code} - {topLevelContextNode.name}
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
      </div>
      {renderSlider()}
      {/* Modals are unchanged */}
      <AddJournalModal
        isOpen={journalManager.isAddJournalModalOpen}
        onClose={journalManager.closeAddJournalModal}
        onSubmit={journalManager.createJournal}
        context={journalManager.addJournalContext}
      />
      <JournalModal
        isOpen={
          journalManager.isJournalNavModalOpen ||
          isLinkingModalOpen ||
          isGpgContextModalOpen
        }
        onClose={() => {
          if (journalManager.isJournalNavModalOpen)
            journalManager.closeJournalNavModal();
          if (isLinkingModalOpen) setIsLinkingModalOpen(false);
          if (isGpgContextModalOpen) setIsGpgContextModalOpen(false);
        }}
        modalTitle={
          isLinkingModalOpen ? "Select Journal" : "Manage & Select Journals"
        }
        onConfirmSelection={(nodeId, childId) =>
          journalManager.handleSelectTopLevelJournal(nodeId, childId)
        }
        onSetShowRoot={() =>
          journalManager.handleSelectTopLevelJournal(ROOT_JOURNAL_ID)
        }
        onSelectForLinking={
          isLinkingModalOpen
            ? (node) => {
                if (onSelectForLinkingCallback)
                  onSelectForLinkingCallback(node);
              }
            : isGpgContextModalOpen
            ? (node) => {
                useAppStore
                  .getState()
                  .setSelection("gpgContextJournalId", node.id);
                setIsGpgContextModalOpen(false);
              }
            : undefined
        }
        hierarchy={
          journalManager.isHierarchyLoading
            ? []
            : [
                {
                  id: "__MODAL_ROOT_NODE__",
                  name: "Chart of Accounts",
                  code: "ROOT",
                  children: journalManager.hierarchyData,
                  isConceptualRoot: true,
                },
              ]
        }
        isLoading={journalManager.isHierarchyLoading}
        onTriggerAddChild={(parentId, parentCode) => {
          const pNode = findNodeById(journalManager.hierarchyData, parentId);
          journalManager.openAddJournalModal({
            level: pNode ? "child" : "top",
            parentId: pNode ? parentId : null,
            parentCode,
            parentName: pNode?.name,
          });
        }}
        onDeleteAccount={journalManager.deleteJournal}
      />
    </>
  );
});
JournalSliderController.displayName = "JournalSliderController";
