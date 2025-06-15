//src/features/partners/PartnerSliderController.tsx
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
  openJournalSelector: (
    onSelectCallback: (node: AccountNodeData) => void
  ) => void;
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
  const restrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );

  // Store selections
  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const selectedPartnerId = useAppStore((state) => state.selections.partner);
  const selectedGoodsId = useAppStore((state) => state.selections.goods);
  const setSelection = useAppStore((state) => state.setSelection);

  // Modal state
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [onSelectForLinkingCallback, setOnSelectForLinkingCallback] = useState<
    ((node: AccountNodeData) => void) | null
  >(null);
  const [isGpgContextModalOpen, setIsGpgContextModalOpen] = useState(false);

  const selectedL1Journal = useMemo(() => {
    if (
      !journalManager.isJournalSliderPrimary ||
      !journalManager.selectedTopLevelJournalId
    ) {
      return null;
    }
    return findNodeById(
      journalManager.hierarchyData,
      journalManager.selectedTopLevelJournalId
    );
  }, [
    journalManager.isJournalSliderPrimary,
    journalManager.selectedTopLevelJournalId,
    journalManager.hierarchyData,
  ]);

  // --- Callback to handle navigating up the hierarchy one level at a time ---
  const handleNavigateUpOneLevel = useCallback(() => {
    const currentTopLevelId = journalManager.selectedTopLevelJournalId;
    const effectiveRootId = restrictedJournalId || ROOT_JOURNAL_ID;

    if (!currentTopLevelId || currentTopLevelId === effectiveRootId) {
      return; // Already at root, do nothing.
    }

    const parent = findParentOfNode(
      currentTopLevelId,
      journalManager.hierarchyData
    );
    const newTopLevelId = parent ? parent.id : effectiveRootId;

    // Pre-select the journal we just navigated up from for better UX
    journalManager.handleSelectTopLevelJournal(
      newTopLevelId,
      undefined,
      currentTopLevelId
    );
  }, [journalManager, restrictedJournalId]);

  useImperativeHandle(ref, () => ({
    openJournalSelector: (callback) => {
      setOnSelectForLinkingCallback(() => callback);
      setIsLinkingModalOpen(true);
    },
    openJournalSelectorForGPG: () => {
      setIsGpgContextModalOpen(true);
    },
  }));

  const handleToggleJournalRootFilter = useCallback(
    (filter: PartnerGoodFilterStatus) => {
      setSelection("journal.rootFilter", filter);
    },
    [setSelection]
  );

  // Queries for flat view
  const isJournalAfterPartner = useMemo(
    () =>
      sliderOrder.indexOf(SLIDER_TYPES.PARTNER) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1,
    [sliderOrder]
  );
  const isJournalAfterGood = useMemo(
    () =>
      sliderOrder.indexOf(SLIDER_TYPES.GOODS) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1,
    [sliderOrder]
  );

  const flatJournalsByPartnerQuery = useQuery<Journal[], Error>({
    queryKey: journalKeys.flatListByPartner(selectedPartnerId),
    queryFn: () => fetchJournalsLinkedToPartner(selectedPartnerId!),
    enabled: isJournalAfterPartner && !!selectedPartnerId,
  });

  const flatJournalsByGoodQuery = useQuery<Journal[], Error>({
    queryKey: journalKeys.flatListByGood(selectedGoodsId),
    queryFn: () => fetchJournalsLinkedToGood(selectedGoodsId!),
    enabled: isJournalAfterGood && !!selectedGoodsId,
  });

  // --- MODAL HANDLERS ---

  const handleCloseLinkingModal = useCallback(() => {
    setIsLinkingModalOpen(false);
    setOnSelectForLinkingCallback(null);
  }, []);

  const handleJournalNodeSelectedForLinking = useCallback(
    (selectedNode: AccountNodeData) => {
      if (onSelectForLinkingCallback) {
        onSelectForLinkingCallback(selectedNode);
      }
    },
    [onSelectForLinkingCallback]
  );

  const handleGpgContextJournalSelected = useCallback(
    (node: AccountNodeData) => {
      if (node && !node.isConceptualRoot && node.id !== ROOT_JOURNAL_ID) {
        useAppStore.getState().setSelection("gpgContextJournalId", node.id);
      } else {
        alert(
          "Please select a specific journal account for the G-P-G context."
        );
      }
      setIsGpgContextModalOpen(false);
    },
    []
  );

  // --- RENDER LOGIC ---

  const renderSlider = () => {
    if (journalManager.isJournalSliderPrimary) {
      return (
        <JournalHierarchySlider
          sliderId={SLIDER_TYPES.JOURNAL}
          hierarchyData={journalManager.currentHierarchy}
          fullHierarchyData={journalManager.hierarchyData}
          selectedTopLevelId={journalManager.selectedTopLevelJournalId}
          selectedLevel2Ids={journalManager.selectedLevel2JournalIds}
          selectedLevel3Ids={journalManager.selectedLevel3JournalIds}
          onSelectTopLevel={(id: string, childId?: string) =>
            journalManager.handleSelectTopLevelJournal(id, undefined, childId)
          }
          onToggleLevel2Id={journalManager.handleToggleLevel2JournalId}
          onToggleLevel3Id={journalManager.handleToggleLevel3JournalId}
          rootJournalIdConst={ROOT_JOURNAL_ID}
          restrictedJournalId={
            useAppStore.getState().auth.effectiveRestrictedJournalId
          }
          isLoading={journalManager.isHierarchyLoading}
          isError={journalManager.isHierarchyError}
          isRootView={
            journalManager.selectedTopLevelJournalId ===
            (useAppStore.getState().auth.effectiveRestrictedJournalId ||
              ROOT_JOURNAL_ID)
          }
          onToggleFilter={handleToggleJournalRootFilter}
          activeFilters={
            journalManager.activeJournalRootFilters as PartnerGoodFilterStatus[]
          }
        />
      );
    }

    // Logic for Flat View
    let queryToUse = null;
    if (isJournalAfterPartner) queryToUse = flatJournalsByPartnerQuery;
    else if (isJournalAfterGood) queryToUse = flatJournalsByGoodQuery;

    if (queryToUse) {
      return (
        <DynamicSlider
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
    }

    return (
      <DynamicSlider
        sliderId={SLIDER_TYPES.JOURNAL}
        title="Journal"
        data={[]}
        isLoading={false}
        placeholderMessage="Journal context determined by preceding slider."
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
            aria-label="Options for Journal"
          >
            <IoOptionsOutline />
          </button>

          {journalManager.isJournalSliderPrimary && selectedL1Journal && (
            <div
              className={styles.journalParentInfo}
              onDoubleClick={handleNavigateUpOneLevel}
              title="Double-click to navigate up one level"
            >
              {selectedL1Journal.code} - {selectedL1Journal.name}
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

      {/* --- MODALS RENDERED BY THIS CONTROLLER --- */}
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
          if (isLinkingModalOpen) handleCloseLinkingModal();
          if (isGpgContextModalOpen) setIsGpgContextModalOpen(false);
        }}
        modalTitle={
          isLinkingModalOpen
            ? "Select Journal(s) to Link"
            : isGpgContextModalOpen
            ? "Select Context Journal for G-P-G View"
            : "Manage & Select Journals"
        }
        onConfirmSelection={
          isLinkingModalOpen
            ? undefined
            : isGpgContextModalOpen
            ? handleGpgContextJournalSelected
            : journalManager.handleSelectTopLevelJournal
        }
        onSetShowRoot={
          isLinkingModalOpen || isGpgContextModalOpen
            ? undefined
            : () => journalManager.handleSelectTopLevelJournal(ROOT_JOURNAL_ID)
        }
        onSelectForLinking={
          isLinkingModalOpen
            ? handleJournalNodeSelectedForLinking
            : isGpgContextModalOpen
            ? handleGpgContextJournalSelected
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
          const parentNode =
            parentId === "__MODAL_ROOT_NODE__"
              ? null
              : findNodeById(journalManager.hierarchyData, parentId);
          journalManager.openAddJournalModal({
            level: parentNode ? "child" : "top",
            parentId: parentNode ? parentId : null,
            parentCode: parentCode,
            parentName: parentNode?.name || "",
          });
        }}
        onDeleteAccount={journalManager.deleteJournal}
      />
    </>
  );
});

JournalSliderController.displayName = "JournalSliderController";
