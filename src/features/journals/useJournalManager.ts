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

  const l2ClickInteractionRef = useRef<{
    id: string | null;
    timeout: NodeJS.Timeout | null;
  }>({ id: null, timeout: null });
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
  /** Rule A: Single-Clicking a 1st Row Button (with new logic) */
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

        // ✅ FIX: Check if the node has children to decide which logic path to take.
        const hasChildren = l1Node.children && l1Node.children.length > 0;

        if (!hasChildren) {
          // --- NEW LOGIC: Simple Toggle for items without children ---
          const isSelected = level2Ids.includes(l1ItemId);
          const newL2s = isSelected
            ? level2Ids.filter((id) => id !== l1ItemId)
            : [...level2Ids, l1ItemId];

          setSelection("journal", { level2Ids: newL2s });

          // Per Rule D, any interaction should reset the Top Button cycle and save state
          topButtonClickCycleState.current = 0;
          savedL2SelectionsForTopButton.current = newL2s;
          savedL3SelectionsForTopButton.current = level3Ids; // L3s are unchanged
        } else {
          // --- EXISTING LOGIC: 3-State Cycle for items WITH children ---
          const cycle = l1ClickCycleState.current[l1ItemId] || 0;
          const childrenIds = (l1Node.children || []).map((c) => c.id);
          const childrenIdSet = new Set(childrenIds);

          let newL2s = [...level2Ids];
          let newL3s = level3Ids.filter((id) => !childrenIdSet.has(id));

          switch (cycle) {
            case 0: // Click 1: Select All Children
              if (!newL2s.includes(l1ItemId)) newL2s.push(l1ItemId);
              newL3s.push(...childrenIds);
              break;
            case 1: // Click 2: Select None (and unselect L1 item)
              newL2s = newL2s.filter((id) => id !== l1ItemId);
              break;
            case 2: // Click 3: Restore Custom
              if (!newL2s.includes(l1ItemId)) newL2s.push(l1ItemId);
              const savedSelection =
                savedL3SelectionsByL1.current[l1ItemId] || [];
              newL3s.push(...savedSelection);
              break;
          }

          l1ClickCycleState.current[l1ItemId] = (cycle + 1) % 3;

          const finalL2s = [...new Set(newL2s)];
          const finalL3s = [...new Set(newL3s)];
          setSelection("journal", { level2Ids: finalL2s, level3Ids: finalL3s });

          topButtonClickCycleState.current = 0;
          savedL2SelectionsForTopButton.current = finalL2s;
          savedL3SelectionsForTopButton.current = finalL3s;
        }

        // Cleanup for the click detector
        clickInteractionRef.current = { id: null, timeout: null };
      }, DOUBLE_CLICK_DELAY);

      clickInteractionRef.current = { id: l1ItemId, timeout: newTimeout };
    },
    [hierarchyData, setSelection, handleSelectTopLevelJournal]
  );

  /** Rule D: The Critical Reset Condition */
  // ✅ NEW: The logic from the old handleL2ManualToggle is now the single-click action.
  const handleL2SingleClickToggle = useCallback(
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
        l1ClickCycleState.current[parentL1.id] = 0;
        savedL3SelectionsByL1.current[parentL1.id] = newL3s.filter((id) =>
          parentL1.children?.some((c) => c.id === id)
        );
      }

      topButtonClickCycleState.current = 0;
      savedL2SelectionsForTopButton.current = [...level2Ids];
      savedL3SelectionsForTopButton.current = newL3s;
    },
    [hierarchyData, setSelection]
  );

  // ✅ NEW: Unified handler for L2 items to distinguish single/double clicks
  const handleL2Interaction = useCallback(
    (l2ItemId: string) => {
      // Check for double-click
      if (l2ClickInteractionRef.current.timeout) {
        clearTimeout(l2ClickInteractionRef.current.timeout);
      }
      if (l2ClickInteractionRef.current.id === l2ItemId) {
        // --- DOUBLE-CLICK LOGIC ---
        const parent = findParentOfNode(l2ItemId, hierarchyData);
        if (parent) {
          // Navigate to the parent, and pre-select the item we just double-clicked.
          handleSelectTopLevelJournal(parent.id, l2ItemId);
        }
        l2ClickInteractionRef.current = { id: null, timeout: null };
        return;
      }

      // Set timeout for single-click
      const newTimeout = setTimeout(() => {
        // --- SINGLE-CLICK LOGIC ---
        handleL2SingleClickToggle(l2ItemId);
        l2ClickInteractionRef.current = { id: null, timeout: null };
      }, DOUBLE_CLICK_DELAY);

      l2ClickInteractionRef.current = { id: l2ItemId, timeout: newTimeout };
    },
    [hierarchyData, handleSelectTopLevelJournal, handleL2SingleClickToggle]
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
    handleL2Interaction,
    handleTopButtonClick,
  };
};
