//src/features/journals/useJournalManager.ts
"use client";

import { useMemo, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import { findNodeById } from "@/lib/helpers";

// Import our new, focused hooks
import { useJournalData } from "./hooks/useJournalData";
import { useJournalSelection } from "./hooks/useJournalSelection";
import { useJournalInteraction } from "./hooks/useJournalInteraction";
import { useJournalMutations } from "./hooks/useJournalMutations";

export const useJournalManager = () => {
  const sliderOrder = useAppStore((state) => state.sliderOrder);
  const visibility = useAppStore((state) => state.visibility);
  const restrictedJournalId = useAppStore(
    (state) => state.effectiveRestrictedJournalId
  );

  const isJournalSliderPrimary = useMemo(
    () => sliderOrder.filter((s) => visibility[s])[0] === SLIDER_TYPES.JOURNAL,
    [sliderOrder, visibility]
  );

  const {
    isHierarchyMode,
    hierarchyData,
    flatJournalData,
    isLoading,
    isError,
    error,
  } = useJournalData(isJournalSliderPrimary);

  const {
    topLevelId,
    level2Ids,
    level3Ids,
    flatId,
    rootFilter,
    effectiveJournalIds,
    selectedJournalId, // This is now correctly calculated by the selection hook
    updateJournalSelections,
    resetJournalSelections,
    setSelectedFlatJournalId,
    setSelection,
  } = useJournalSelection(isHierarchyMode, hierarchyData);

  const currentHierarchy = useMemo(() => {
    if (!isHierarchyMode) {
      return [];
    }
    if (topLevelId === ROOT_JOURNAL_ID) {
      return hierarchyData;
    }
    const topNode = findNodeById(hierarchyData, topLevelId);
    return topNode?.children || [];
  }, [isHierarchyMode, hierarchyData, topLevelId]);

  const {
    visibleChildrenMap,
    handleSelectTopLevelJournal,
    handleL1Interaction,
    handleL2Interaction,
    handleNavigateUpOneLevel,
    handleRestoreLastSelection,
    handleSelectAllVisible,
    handleSelectParentsOnly,
    handleClearAllSelections,
    hasSavedSelection,
  } = useJournalInteraction({
    hierarchyData,
    topLevelId,
    level2Ids,
    level3Ids,
    updateJournalSelections,
    restrictedJournalId,
  });

  const {
    isAddJournalModalOpen,
    addJournalContext,
    openAddJournalModal,
    closeAddJournalModal,
    isJournalNavModalOpen,
    openJournalNavModal,
    closeJournalNavModal,
    createJournal,
    isCreatingJournal,
    deleteJournal,
    isDeletingJournal,
  } = useJournalMutations({ restrictedJournalId, resetJournalSelections });

  const handleToggleJournalRootFilter = useCallback(
    (filter) => setSelection("journal.rootFilter", filter),
    [setSelection]
  );

  // --- ✅ FIX: REMOVED the flawed `isTerminal` logic ---
  // The concept of a "terminal selection" is now fully encapsulated by `selectedJournalId` being non-null.

  return {
    // Data and State
    hierarchyData,
    currentHierarchy,
    selectedTopLevelId: topLevelId,
    selectedLevel2Ids: level2Ids,
    selectedLevel3Ids: level3Ids,
    selectedFlatJournalId: flatId,
    activeJournalRootFilters: rootFilter,
    isJournalSliderPrimary,
    selectedJournalId, // This is the single source of truth for the terminal selection.
    effectiveSelectedJournalIds: effectiveJournalIds,
    visibleChildrenMap,
    isHierarchyMode,
    flatJournalData,
    isJournalDataLoading: isLoading,
    isJournalDataError: isError,
    journalDataError: error,
    // Modal State & Handlers
    isAddJournalModalOpen,
    addJournalContext,
    openAddJournalModal,
    closeAddJournalModal,
    isJournalNavModalOpen,
    openJournalNavModal,
    closeJournalNavModal,
    createJournal,
    isCreatingJournal,
    deleteJournal,
    isDeletingJournal,
    // Core Interaction Handlers
    handleSelectTopLevelJournal,
    resetJournalSelections,
    setSelectedFlatJournalId,
    handleToggleJournalRootFilter,
    handleL1Interaction,
    handleL2Interaction,
    // --- NEW EXPLICIT HANDLERS ---
    handleNavigateUpOneLevel,
    handleRestoreLastSelection,
    handleSelectAllVisible,
    handleSelectParentsOnly,
    handleClearAllSelections,
    hasSavedSelection,
  };
};
