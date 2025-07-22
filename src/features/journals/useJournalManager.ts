// src/features/journals/useJournalManager.ts
"use client";

import { useMemo, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants"; // 1. Import ROOT_JOURNAL_ID
import { findNodeById } from "@/lib/helpers";

// Import our new, focused hooks
import { useJournalData } from "./hooks/useJournalData";
import { useJournalSelection } from "./hooks/useJournalSelection";
import { useJournalInteraction } from "./hooks/useJournalInteraction";
import { useJournalMutations } from "./hooks/useJournalMutations";

export const useJournalManager = () => {
  // Determine primary status first, as it drives data fetching
  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const restrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );

  const isJournalSliderPrimary = useMemo(
    () => sliderOrder.filter((s) => visibility[s])[0] === SLIDER_TYPES.JOURNAL,
    [sliderOrder, visibility]
  );

  // 1. Data Fetching Hook
  const {
    isHierarchyMode,
    hierarchyData,
    flatJournalData,
    isLoading,
    isError,
    error,
  } = useJournalData(isJournalSliderPrimary);

  // 2. Selection Logic Hook (depends on data)
  const {
    topLevelId,
    level2Ids,
    level3Ids,
    flatId,
    rootFilter,
    effectiveJournalIds,
    selectedJournalId,
    updateJournalSelections,
    resetJournalSelections,
    setSelectedFlatJournalId,
    setSelection,
  } = useJournalSelection(isHierarchyMode, hierarchyData);

  // 2. ✅ FIX: Correctly calculate the hierarchy to be displayed.
  const currentHierarchy = useMemo(() => {
    if (!isHierarchyMode) {
      return [];
    }
    // If the top-level selection is the conceptual root, the current hierarchy
    // is the entire set of top-level nodes.
    if (topLevelId === ROOT_JOURNAL_ID) {
      return hierarchyData;
    }
    // Otherwise, find the selected node and display its children.
    const topNode = findNodeById(hierarchyData, topLevelId);
    return topNode?.children || [];
  }, [isHierarchyMode, hierarchyData, topLevelId]);

  // 3. UI Interaction Hook (depends on data and selection updaters)
  const {
    visibleChildrenMap,
    handleSelectTopLevelJournal,
    handleL1Interaction,
    handleL2Interaction,
    handleTopButtonClick,
  } = useJournalInteraction({
    hierarchyData,
    topLevelId,
    level2Ids,
    level3Ids,
    updateJournalSelections,
    restrictedJournalId,
  });

  // 4. Mutations and Modals Hook (depends on selection reset)
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

  // The final return object remains consistent for the controller,
  // but its values are now composed from our smaller hooks.

  // --- Add isTerminal logic ---
  const isTerminal = useMemo(() => {
    if (!selectedJournalId || !hierarchyData) return false;
    const node = findNodeById(hierarchyData, selectedJournalId);
    return !!node && (!node.children || node.children.length === 0);
  }, [selectedJournalId, hierarchyData]);

  return {
    // Data and State
    hierarchyData,
    currentHierarchy, // This is now correctly calculated
    selectedTopLevelId: topLevelId,
    selectedLevel2Ids: level2Ids,
    selectedLevel3Ids: level3Ids,
    selectedFlatJournalId: flatId,
    activeJournalRootFilters: rootFilter,
    isJournalSliderPrimary,
    selectedJournalId,
    effectiveSelectedJournalIds: effectiveJournalIds,
    visibleChildrenMap,
    isHierarchyMode,
    flatJournalData,
    isJournalDataLoading: isLoading,
    isJournalDataError: isError,
    journalDataError: error,
    // --- Add isTerminal to return ---
    isTerminal,
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
    handleTopButtonClick,
  };
};
