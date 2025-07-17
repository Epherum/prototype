// src/features/journals/useJournalManager.ts
"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { journalKeys } from "@/lib/queryKeys";

import {
  fetchJournalHierarchy,
  createJournalEntry as serverCreateJournalEntry,
  deleteJournalEntry as serverDeleteJournalEntry,
} from "@/services/clientJournalService";
import { findNodeById, findParentOfNode } from "@/lib/helpers";
import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import { useAppStore } from "@/store/appStore";

import type { CreateJournalData as ServerCreateJournalData } from "@/app/services/journalService";
import type {
  AccountNodeData,
  PartnerGoodFilterStatus,
  Journal,
} from "@/lib/types";

const DOUBLE_CLICK_DELAY = 200;

export const useJournalManager = () => {
  const queryClient = useQueryClient();

  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const restrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );
  const selections = useAppStore((state) => state.selections);
  const setSelection = useAppStore((state) => state.setSelection);

  const {
    topLevelId: selectedTopLevelId,
    level2Ids: selectedLevel2Ids,
    level3Ids: selectedLevel3Ids,
    flatId: selectedFlatJournalId,
    rootFilter: activeJournalRootFilters,
  } = selections.journal;

  const [isAddJournalModalOpen, setIsAddJournalModalOpen] = useState(false);
  const [addJournalContext, setAddJournalContext] = useState<any>(null);
  const [isJournalNavModalOpen, setIsJournalNavModalOpen] = useState(false);

  const topButtonClickCycleState = useRef(0);
  const savedL2SelectionsForTopButton = useRef<string[]>([]);
  const savedL3SelectionsForTopButton = useRef<string[]>([]);

  const l1ClickCycleState = useRef<Record<string, number>>({});
  const savedL3SelectionsByL1 = useRef<Record<string, string[]>>({});

  // ✅ FIX: Refs for managing single/double click distinction

  const clickInteractionRef = useRef<{
    id: string | null;
    timeout: NodeJS.Timeout | null;
  }>({ id: null, timeout: null });

  const topButtonInteractionRef = useRef<{ timeout: NodeJS.Timeout | null }>({
    timeout: null,
  });
  // --- Queries and Memos (Unchanged) ---
  const isJournalSliderPrimary = useMemo(
    () =>
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 0 &&
      visibility[SLIDER_TYPES.JOURNAL],
    [sliderOrder, visibility]
  );
  const journalHierarchyQuery = useQuery<AccountNodeData[], Error>({
    queryKey: journalKeys.hierarchy(restrictedJournalId),
    queryFn: () => fetchJournalHierarchy(restrictedJournalId),
    staleTime: 5 * 60 * 1000,
    enabled: visibility[SLIDER_TYPES.JOURNAL],
  });
  const hierarchyData = useMemo(
    () => journalHierarchyQuery.data || [],
    [journalHierarchyQuery.data]
  );
  const currentHierarchy = useMemo(() => {
    if (!hierarchyData.length) return [];
    if (selectedTopLevelId === (restrictedJournalId || ROOT_JOURNAL_ID))
      return hierarchyData;
    const topNode = findNodeById(hierarchyData, selectedTopLevelId);
    return topNode?.children || [];
  }, [selectedTopLevelId, hierarchyData, restrictedJournalId]);

  const isTerminal = useMemo((): boolean => {
    const { selections } = useAppStore.getState();
    const { level2Ids, level3Ids, flatId } = selections.journal;
    const singleSelectedId =
      level3Ids.length === 1
        ? level3Ids[0]
        : level2Ids.length === 1 && level3Ids.length === 0
        ? level2Ids[0]
        : flatId;
    if (!singleSelectedId) return false;
    const node = findNodeById(hierarchyData, singleSelectedId);
    return !!node && (!node.children || node.children.length === 0);
  }, [selections.journal, hierarchyData]);

  const selectedJournalId = useMemo((): string | null => {
    if (!isJournalSliderPrimary) return selectedFlatJournalId;
    if (selectedLevel3Ids.length === 1) return selectedLevel3Ids[0];
    if (selectedLevel2Ids.length === 1 && selectedLevel3Ids.length === 0)
      return selectedLevel2Ids[0];
    const effectiveRoot = restrictedJournalId || ROOT_JOURNAL_ID;
    if (
      selectedTopLevelId &&
      selectedTopLevelId !== effectiveRoot &&
      selectedLevel2Ids.length === 0 &&
      selectedLevel3Ids.length === 0
    )
      return selectedTopLevelId;
    return null;
  }, [
    isJournalSliderPrimary,
    selectedFlatJournalId,
    selectedLevel2Ids,
    selectedLevel3Ids,
    selectedTopLevelId,
    restrictedJournalId,
  ]);

  // --- Core State Management Actions (Unchanged) ---
  const handleToggleJournalRootFilter = useCallback(
    (filter: PartnerGoodFilterStatus) =>
      setSelection("journal.rootFilter", filter),
    [setSelection]
  );
  const setSelectedFlatJournalId = useCallback(
    (id: string | null) => setSelection("journal", { flatId: id }),
    [setSelection]
  );
  const resetJournalSelections = useCallback(() => {
    setSelection("journal", {
      topLevelId: restrictedJournalId || ROOT_JOURNAL_ID,
      level2Ids: [],
      level3Ids: [],
      flatId: null,
    });
    topButtonClickCycleState.current = 0;
    l1ClickCycleState.current = {};
  }, [setSelection, restrictedJournalId]);
  const handleSelectTopLevelJournal = useCallback(
    (newTopLevelId: string, childToSelectInL2: string | null = null) => {
      setSelection("journal", {
        topLevelId: newTopLevelId,
        level2Ids: childToSelectInL2 ? [childToSelectInL2] : [],
        level3Ids: [],
      });
      topButtonClickCycleState.current = 0;
      l1ClickCycleState.current = {};
    },
    [setSelection]
  );

  // --- AUTHORITATIVE INTERACTION HANDLERS ---

  /** Rule B: Single-Clicking the Top Button */

  const handleNavigateUpOneLevel = useCallback(() => {
    const currentTopLevelId =
      useAppStore.getState().selections.journal.topLevelId;
    const effectiveRootId = restrictedJournalId || ROOT_JOURNAL_ID;
    if (!currentTopLevelId || currentTopLevelId === effectiveRootId) return;

    const parent = findParentOfNode(currentTopLevelId, hierarchyData);
    const newTopLevelId = parent ? parent.id : effectiveRootId;
    handleSelectTopLevelJournal(newTopLevelId, currentTopLevelId);
  }, [hierarchyData, restrictedJournalId, handleSelectTopLevelJournal]);

  const handleTopButtonInteraction = useCallback(() => {
    const topLevelNode = findNodeById(hierarchyData, selectedTopLevelId);
    if (!topLevelNode) return;

    const cycle = topButtonClickCycleState.current;
    let newL2Ids: string[] = [];
    let newL3Ids: string[] = [];

    switch (cycle) {
      case 0: // Click 1: Select All Descendants
        newL2Ids = (topLevelNode.children || []).map((c) => c.id);
        newL3Ids = (topLevelNode.children || [])
          .flatMap((c) => c.children || [])
          .map((gc) => gc.id);
        break;
      case 1: // Click 2: Select None
        // State is already empty []
        break;
      case 2: // Click 3: Restore Custom
        newL2Ids = savedL2SelectionsForTopButton.current;
        newL3Ids = savedL3SelectionsForTopButton.current;
        break;
    }

    topButtonClickCycleState.current = (cycle + 1) % 3;
    setSelection("journal", { level2Ids: newL2Ids, level3Ids: newL3Ids });
  }, [hierarchyData, selectedTopLevelId, setSelection]);

  const handleTopButtonClick = useCallback(() => {
    // If a timeout is pending, it means this is a double-click
    if (topButtonInteractionRef.current.timeout) {
      clearTimeout(topButtonInteractionRef.current.timeout);
      topButtonInteractionRef.current.timeout = null;
      handleNavigateUpOneLevel(); // Execute double-click action
      return;
    }

    // Otherwise, set a timeout for the single-click action
    const newTimeout = setTimeout(() => {
      handleTopButtonInteraction(); // Execute single-click action
      topButtonInteractionRef.current.timeout = null;
    }, DOUBLE_CLICK_DELAY);

    topButtonInteractionRef.current.timeout = newTimeout;
  }, [handleNavigateUpOneLevel, handleTopButtonInteraction]);

  /** Rule A: Single-Clicking a 1st Row Button */
  const handleL1Interaction = useCallback(
    (l1ItemId: string) => {
      // Standard double-click detection logic
      if (clickInteractionRef.current.timeout) {
        clearTimeout(clickInteractionRef.current.timeout);
      }
      if (clickInteractionRef.current.id === l1ItemId) {
        handleSelectTopLevelJournal(l1ItemId);
        clickInteractionRef.current = { id: null, timeout: null };
        return;
      }

      // Single-click logic
      const newTimeout = setTimeout(() => {
        const { level2Ids, level3Ids } =
          useAppStore.getState().selections.journal;
        const l1Node = findNodeById(hierarchyData, l1ItemId);
        if (!l1Node) return;

        const cycle = l1ClickCycleState.current[l1ItemId] || 0;
        const childrenIds = (l1Node.children || []).map((c) => c.id);
        const childrenIdSet = new Set(childrenIds);

        let newL2s = [...level2Ids];
        // Start by removing this L1 item's children from the L3 list. This cleans the slate for the new state.
        let newL3s = level3Ids.filter((id) => !childrenIdSet.has(id));

        // FIX: The logic for modifying L2 and L3 selections is now correctly implemented per the 3-state cycle rule.
        switch (cycle) {
          case 0: // Click 1: Select All Children
            if (!newL2s.includes(l1ItemId)) newL2s.push(l1ItemId);
            newL3s.push(...childrenIds);
            break;
          case 1: // Click 2: Select None (and unselect L1 item)
            // This is the fix for Bug 1: removing the item from the L2 list.
            newL2s = newL2s.filter((id) => id !== l1ItemId);
            // L3 children are already filtered out.
            break;
          case 2: // Click 3: Restore Custom
            if (!newL2s.includes(l1ItemId)) newL2s.push(l1ItemId);
            const savedSelection =
              savedL3SelectionsByL1.current[l1ItemId] || [];
            newL3s.push(...savedSelection);
            break;
        }

        l1ClickCycleState.current[l1ItemId] = (cycle + 1) % 3;

        // Ensure uniqueness and update global state
        const finalL2s = [...new Set(newL2s)];
        const finalL3s = [...new Set(newL3s)];
        setSelection("journal", { level2Ids: finalL2s, level3Ids: finalL3s });

        // FIX: Per Rule D, any manual L1 click resets the Top Button cycle and saves the new state as its "custom" state.
        topButtonClickCycleState.current = 0;
        savedL2SelectionsForTopButton.current = finalL2s;
        savedL3SelectionsForTopButton.current = finalL3s;

        clickInteractionRef.current = { id: null, timeout: null };
      }, DOUBLE_CLICK_DELAY);

      clickInteractionRef.current = { id: l1ItemId, timeout: newTimeout };
    },
    [hierarchyData, setSelection, handleSelectTopLevelJournal]
  );

  /** Rule D: The Critical Reset Condition */
  const handleL2ManualToggle = useCallback(
    (l2ItemId: string) => {
      const { level2Ids, level3Ids } =
        useAppStore.getState().selections.journal;
      const isSelected = level3Ids.includes(l2ItemId);
      const newL3s = isSelected
        ? level3Ids.filter((id) => id !== l2ItemId)
        : [...level3Ids, l2ItemId];

      setSelection("journal", { level3Ids: newL3s });

      const parentL1 = findParentOfNode(l2ItemId, hierarchyData);
      if (parentL1) {
        l1ClickCycleState.current[parentL1.id] = 0; // Reset parent's cycle
        // Save the new custom selection specifically for the parent L1 button's "restore" state.
        savedL3SelectionsByL1.current[parentL1.id] = newL3s.filter((id) =>
          parentL1.children?.some((c) => c.id === id)
        );
      }

      // Also reset Top Button cycle
      topButtonClickCycleState.current = 0;
      // FIX: This is the fix for Bug 2. It now saves the *entire* current L2 selection, not just a single parent.
      savedL2SelectionsForTopButton.current = [...level2Ids];
      savedL3SelectionsForTopButton.current = newL3s;
    },
    [hierarchyData, setSelection]
  );

  // --- Mutations and Modal handlers (Unchanged) ---
  const createJournalMutation = useMutation<
    Journal,
    Error,
    ServerCreateJournalData
  >({
    mutationFn: serverCreateJournalEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: journalKeys.hierarchy(restrictedJournalId),
      });
      closeAddJournalModal();
    },
  });
  const deleteJournalMutation = useMutation<{ message: string }, Error, string>(
    {
      mutationFn: serverDeleteJournalEntry,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: journalKeys.hierarchy(restrictedJournalId),
        });
        resetJournalSelections();
      },
    }
  );
  const openAddJournalModal = useCallback((context: any) => {
    setAddJournalContext(context);
    setIsAddJournalModalOpen(true);
  }, []);
  const closeAddJournalModal = useCallback(
    () => setIsAddJournalModalOpen(false),
    []
  );
  const openJournalNavModal = useCallback(
    () => setIsJournalNavModalOpen(true),
    []
  );
  const closeJournalNavModal = useCallback(
    () => setIsJournalNavModalOpen(false),
    []
  );
  const createJournal = useCallback(
    (formData: any) => {
      createJournalMutation.mutate({
        id: formData.code,
        name: formData.name,
        parentId: addJournalContext?.parentId,
      });
    },
    [addJournalContext, createJournalMutation]
  );
  const deleteJournal = useCallback(
    (journalId: string) => deleteJournalMutation.mutate(journalId),
    [deleteJournalMutation]
  );

  return {
    // Data and State
    hierarchyData,
    currentHierarchy,
    isHierarchyLoading: journalHierarchyQuery.isLoading,
    isHierarchyError: journalHierarchyQuery.isError,
    hierarchyError: journalHierarchyQuery.error,
    selectedTopLevelId,
    selectedLevel2Ids,
    selectedLevel3Ids,
    selectedFlatJournalId,
    activeJournalRootFilters,
    isJournalSliderPrimary,
    selectedJournalId,
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
    isCreatingJournal: createJournalMutation.isPending,
    deleteJournal,
    isDeletingJournal: deleteJournalMutation.isPending,

    // Core Interaction Handlers
    handleSelectTopLevelJournal,
    resetJournalSelections,
    setSelectedFlatJournalId,
    handleToggleJournalRootFilter,
    handleTopButtonInteraction,
    handleL1Interaction,
    handleL2ManualToggle,
    handleTopButtonClick,
  };
};
