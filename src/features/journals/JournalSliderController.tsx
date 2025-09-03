//src/features/journals/JournalSliderController.tsx
"use client";

import React, {
  useMemo,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
// Import motion components
import { motion, AnimatePresence } from "framer-motion";
import { IoOptionsOutline } from "react-icons/io5";
import { IoChevronDown } from "react-icons/io5";
import styles from "@/app/page.module.css";

// Store & Hooks
import { useAppStore } from "@/store/appStore";
import { useJournalManager } from "./useJournalManager";
import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import { findNodeById } from "@/lib/helpers";

// UI Components
import JournalHierarchySlider from "@/features/journals/components/JournalHierarchySlider";
import DynamicSlider from "@/features/shared/components/DynamicSlider";
import JournalModal from "@/features/journals/components/JournalModal";
import AddJournalModal from "@/features/journals/components/AddJournalModal";
import {
  DropdownMenu,
  type DropdownAction,
} from "@/components/layout/DropdownMenu";

// Types
import type { AccountNodeData, PartnerGoodFilterStatus } from "@/lib/types/ui";

// Helper function to capitalize only the first letter
const capitalizeFirstLetter = (text: string): string => {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// --- ANIMATION VARIANTS ---
const textVariants = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

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

  // ... (rest of the component up to the return statement is unchanged)
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [onSelectForLinkingCallback, setOnSelectForLinkingCallback] = useState<
    ((node: AccountNodeData) => void) | null
  >(null);
  const [isGpgContextModalOpen, setIsGpgContextModalOpen] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);

  const topLevelContextNode = useMemo(() => {
    if (
      !journalManager.isJournalSliderPrimary ||
      !journalManager.selectedTopLevelId
    ) {
      return null;
    }
    if (journalManager.selectedTopLevelId === ROOT_JOURNAL_ID) {
      return { id: ROOT_JOURNAL_ID, code: "ROOT", name: "All Accounts" };
    }
    return findNodeById(
      journalManager.hierarchyData,
      journalManager.selectedTopLevelId
    );
  }, [
    journalManager.isJournalSliderPrimary,
    journalManager.selectedTopLevelId,
    journalManager.hierarchyData,
  ]);

  useImperativeHandle(ref, () => ({
    openJournalSelector: (callback) => {
      setOnSelectForLinkingCallback(() => callback);
      setIsLinkingModalOpen(true);
    },
    openJournalSelectorForGPG: () => setIsGpgContextModalOpen(true),
  }));

  const renderSlider = () => {
    if (journalManager.isHierarchyMode) {
      return (
        <JournalHierarchySlider
          isLocked={isCreating}
          sliderId={SLIDER_TYPES.JOURNAL}
          hierarchyData={journalManager.hierarchyData} // ✅ Pass full hierarchy for multi-level navigation
          fullHierarchyData={journalManager.hierarchyData}
          selectedLevel2Ids={journalManager.selectedLevel2Ids}
          selectedLevel3Ids={journalManager.selectedLevel3Ids}
          visibleChildrenMap={journalManager.visibleChildrenMap}
          onL1ItemInteract={journalManager.handleL1Interaction}
          onL2ItemInteract={journalManager.handleL2Interaction}
          isLoading={journalManager.isJournalDataLoading}
          onToggleFilter={journalManager.handleToggleJournalRootFilter}
          activeFilters={
            journalManager.activeJournalRootFilters as PartnerGoodFilterStatus[]
          }
          effectiveJournalIds={journalManager.effectiveSelectedJournalIds}
          topLevelId={journalManager.selectedTopLevelId}
          onNavigateToLevel={(nodeId) => journalManager.handleSelectTopLevelJournal(nodeId)}
          updateJournalSelections={journalManager.updateJournalSelections}
        />
      );
    }
    return (
      <DynamicSlider
        isLocked={isCreating}
        sliderId={SLIDER_TYPES.JOURNAL}
        title="Journal (Filtered)"
        data={(journalManager.flatJournalData || []).map((j) => ({
          id: String(j.id),
          name: j.name,
          code: String(j.id),
          label: j.name,
        }))}
        isLoading={journalManager.isJournalDataLoading}
        isError={journalManager.isJournalDataError}
        error={journalManager.journalDataError}
        activeItemId={journalManager.selectedFlatJournalId}
        onSlideChange={journalManager.setSelectedFlatJournalId}
        isAccordionOpen={false}
        onToggleAccordion={() => {}}
      />
    );
  };

  const dropdownActions = useMemo((): DropdownAction[] => {
    const actions: DropdownAction[] = [];

    if (journalManager.hasSavedSelection) {
      actions.push({
        label: "Restore Last Selection",
        onClick: journalManager.handleRestoreLastSelection,
        disabled: isCreating,
      });
    } else {
      actions.push({
        label: "(No saved selection)",
        onClick: () => {},
        disabled: true,
      });
    }

    actions.push(
      {
        label: "Select All Visible",
        onClick: journalManager.handleSelectAllVisible,
        disabled: isCreating,
      },
      {
        label: "Select Parents Only",
        onClick: journalManager.handleSelectParentsOnly,
        disabled: isCreating,
      },
      {
        label: "Clear All Selections",
        onClick: journalManager.handleClearAllSelections,
        disabled: isCreating,
      }
    );

    return actions;
  }, [
    journalManager.hasSavedSelection,
    journalManager.handleRestoreLastSelection,
    journalManager.handleSelectAllVisible,
    journalManager.handleSelectParentsOnly,
    journalManager.handleClearAllSelections,
    isCreating,
  ]);

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

          {/* ✅ 2. START: Update the classNames to use the global `styles` object */}
          {topLevelContextNode && (
            <div className={styles.splitButtonContainer}>
              <motion.div
                layout
                transition={{
                  layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                }}
                className={`${styles.splitButtonMain} ${
                  isCreating ? styles.disabled : ""
                }`}
                onClick={() => setIsTitleExpanded(!isTitleExpanded)}
                onDoubleClick={
                  !isCreating
                    ? journalManager.handleNavigateUpOneLevel
                    : undefined
                }
                title={`${topLevelContextNode.code} - ${capitalizeFirstLetter(topLevelContextNode.name)}. Double-click to navigate up.`}
              >
                <div className={styles.animatedTextWrapper}>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={topLevelContextNode.id}
                      variants={textVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      style={{ whiteSpace: isTitleExpanded ? "normal" : "nowrap" }}
                    >
                      {topLevelContextNode.code} - {capitalizeFirstLetter(topLevelContextNode.name)}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </motion.div>

              <DropdownMenu
                actions={dropdownActions}
                trigger={<IoChevronDown />}
                // Pass the global class to the trigger for styling
                isCreating={isCreating}
              />
            </div>
          )}
          {/* ✅ END: Update complete */}
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

      {/* ... (All modals remain unchanged) ... */}
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
          journalManager.isJournalDataLoading
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
        isLoading={journalManager.isJournalDataLoading}
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
