// src/features/journals/useJournalManager.ts
"use client";

import { useState, useCallback, useMemo } from "react";
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

const MAX_L2_SELECTIONS = 10;
const MAX_L3_SELECTIONS = 20;

export const useJournalManager = () => {
  const queryClient = useQueryClient();

  // State from Zustand Store
  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const restrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );
  const selections = useAppStore((state) => state.selections);
  const setSelection = useAppStore((state) => state.setSelection);

  const {
    topLevelId: selectedTopLevelJournalId,
    level2Ids: selectedLevel2JournalIds,
    level3Ids: selectedLevel3JournalIds,
    flatId: selectedFlatJournalId,
    rootFilter: activeJournalRootFilters,
  } = selections.journal;

  // Local component state
  const [isAddJournalModalOpen, setIsAddJournalModalOpen] = useState(false);
  const [addJournalContext, setAddJournalContext] = useState<{
    level: "top" | "child";
    parentId: string | null;
    parentCode?: string;
    parentName?: string;
  } | null>(null);
  const [isJournalNavModalOpen, setIsJournalNavModalOpen] = useState(false);

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
    if (!hierarchyData || hierarchyData.length === 0) return [];
    if (
      selectedTopLevelJournalId === (restrictedJournalId || ROOT_JOURNAL_ID)
    ) {
      return hierarchyData;
    }
    const topLevelNode = findNodeById(hierarchyData, selectedTopLevelJournalId);
    return topLevelNode ? topLevelNode.children || [] : [];
  }, [selectedTopLevelJournalId, hierarchyData, restrictedJournalId]);

  const selectedJournalId = useMemo((): string | null => {
    // If the journal slider is not primary, the flat selection is the only possibility.
    if (!isJournalSliderPrimary) {
      return selectedFlatJournalId;
    }

    // --- HIERARCHICAL SELECTION LOGIC ---
    // The user has selected exactly one L3 item. This is the most specific context.
    if (
      selectedLevel3JournalIds.length === 1 &&
      selectedLevel2JournalIds.length === 0
    ) {
      return selectedLevel3JournalIds[0];
    }

    // The user has selected exactly one L2 item and no L3 items.
    if (
      selectedLevel2JournalIds.length === 1 &&
      selectedLevel3JournalIds.length === 0
    ) {
      return selectedLevel2JournalIds[0];
    }

    // The user has drilled down into an L1 item and has not selected any children.
    // This is only a valid single selection if they are NOT at the root.
    if (
      selectedLevel2JournalIds.length === 0 &&
      selectedLevel3JournalIds.length === 0
    ) {
      const effectiveRootId = restrictedJournalId || ROOT_JOURNAL_ID;
      if (
        selectedTopLevelJournalId &&
        selectedTopLevelJournalId !== effectiveRootId
      ) {
        return selectedTopLevelJournalId;
      }
    }

    // In all other cases (multiple selections, no selection), there is no single context.
    return null;
  }, [
    isJournalSliderPrimary,
    selectedFlatJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    selectedTopLevelJournalId,
    restrictedJournalId,
  ]);

  const isTerminal = useMemo((): boolean => {
    // If no single journal is selected, it can't be terminal.
    if (!selectedJournalId) {
      return false;
    }

    // Find the selected node in the full hierarchy.
    const node = findNodeById(hierarchyData, selectedJournalId);

    // A node is terminal if it exists and either has no `children` property
    // or its `children` array is empty.
    return !!node && (!node.children || node.children.length === 0);
  }, [selectedJournalId, hierarchyData]);

  const effectiveSelectedJournalIds = useMemo(() => {
    if (!isJournalSliderPrimary) {
      return selectedFlatJournalId ? [selectedFlatJournalId] : [];
    }

    // Per-branch multi-select logic (if any L2 or L3 items are checked)
    if (
      selectedLevel2JournalIds.length > 0 ||
      selectedLevel3JournalIds.length > 0
    ) {
      const finalIds = new Set<string>();
      selectedLevel3JournalIds.forEach((id) => finalIds.add(id));

      const l2ParentsOfSelectedL3s = new Set<string>();
      if (selectedLevel3JournalIds.length > 0) {
        selectedLevel3JournalIds.forEach((l3Id) => {
          const parent = findParentOfNode(l3Id, hierarchyData);
          if (parent) {
            l2ParentsOfSelectedL3s.add(parent.id);
          }
        });
      }

      selectedLevel2JournalIds.forEach((l2Id) => {
        if (!l2ParentsOfSelectedL3s.has(l2Id)) {
          finalIds.add(l2Id);
        }
      });
      return Array.from(finalIds);
    }

    // NEW "Drilled-Down" Logic: If no L2/L3 are selected, the context IS the
    // currently viewed top-level journal, as long as it's not the user's root.
    const effectiveRootId = restrictedJournalId || ROOT_JOURNAL_ID;
    if (
      selectedTopLevelJournalId &&
      selectedTopLevelJournalId !== effectiveRootId
    ) {
      return [selectedTopLevelJournalId];
    }

    // Fallback: If we're at the root view with no selections, the context is empty.
    return [];
  }, [
    isJournalSliderPrimary,
    selectedFlatJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    selectedTopLevelJournalId,
    restrictedJournalId,
    hierarchyData,
  ]);

  // The logic for what constitutes a "terminal" node for document creation is updated.
  const isTerminalJournalActive = useMemo(() => {
    // The button should appear if and only if the user has "drilled down" into a
    // specific L1-level journal context, and that journal has no children.

    // Condition 1: Journal slider must be in the primary position.
    if (!isJournalSliderPrimary) {
      return false;
    }

    // Condition 2: The user must be drilled-down into a specific journal, not at the root.
    const effectiveRootId = restrictedJournalId || ROOT_JOURNAL_ID;
    if (
      !selectedTopLevelJournalId ||
      selectedTopLevelJournalId === effectiveRootId
    ) {
      return false;
    }

    // Condition 3: No L2 or L3 items can be selected. The context is the L1 container itself.
    if (
      selectedLevel2JournalIds.length > 0 ||
      selectedLevel3JournalIds.length > 0
    ) {
      return false;
    }

    // Condition 4: Find the node for the drilled-down journal.
    const focusedNode = findNodeById(hierarchyData, selectedTopLevelJournalId);

    // Condition 5: The node must exist and be terminal (no children).
    return (
      !!focusedNode &&
      (!focusedNode.children || focusedNode.children.length === 0)
    );
  }, [
    isJournalSliderPrimary,
    hierarchyData,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    selectedTopLevelJournalId,
    restrictedJournalId,
  ]);

  // --- Handlers ---
  const handleToggleJournalRootFilter = useCallback(
    (filterToToggle: PartnerGoodFilterStatus) => {
      setSelection("journal.rootFilter", filterToToggle);
    },
    [setSelection]
  );

  const setSelectedFlatJournalId = useCallback(
    (id: string | null) => {
      setSelection("journal", { flatId: id });
    },
    [setSelection]
  );

  const resetJournalSelections = useCallback(
    (options?: { keepRootFilter?: boolean }) => {
      const resetPayload: any = {
        topLevelId: restrictedJournalId || ROOT_JOURNAL_ID,
        level2Ids: [],
        level3Ids: [],
        flatId: null,
      };
      if (!options?.keepRootFilter) {
        resetPayload.rootFilter = [];
      }
      setSelection("journal", resetPayload);
    },
    [setSelection, restrictedJournalId]
  );

  const handleSelectTopLevelJournal = useCallback(
    (
      newTopLevelId: string,
      _fullHierarchy?: AccountNodeData[],
      childToSelectInL2: string | null = null
    ) => {
      setSelection("journal", {
        topLevelId: newTopLevelId,
        level2Ids: childToSelectInL2 ? [childToSelectInL2] : [],
        level3Ids: [],
      });
    },
    [setSelection]
  );

  const handleToggleLevel2JournalId = useCallback(
    (level2IdToToggle: string) => {
      if (useAppStore.getState().selections.journal.rootFilter.length === 0) {
        return;
      }

      const currentL2s = useAppStore.getState().selections.journal.level2Ids;
      const isSelected = currentL2s.includes(level2IdToToggle);
      let newL2s;
      let newL3s = useAppStore.getState().selections.journal.level3Ids;

      if (isSelected) {
        newL2s = currentL2s.filter((id) => id !== level2IdToToggle);
        const l2Node = findNodeById(hierarchyData, level2IdToToggle);
        if (l2Node?.children) {
          const childrenIds = l2Node.children.map((c) => c.id);
          newL3s = newL3s.filter((id) => !childrenIds.includes(id));
        }
      } else {
        newL2s = [...currentL2s, level2IdToToggle].slice(-MAX_L2_SELECTIONS);
      }

      setSelection("journal", { level2Ids: newL2s, level3Ids: newL3s });
    },
    [hierarchyData, setSelection]
  );

  const handleToggleLevel3JournalId = useCallback(
    (level3IdToToggle: string) => {
      if (useAppStore.getState().selections.journal.rootFilter.length === 0) {
        return;
      }

      const currentL3s = useAppStore.getState().selections.journal.level3Ids;
      const isSelected = currentL3s.includes(level3IdToToggle);
      let newL3s;
      if (isSelected) {
        newL3s = currentL3s.filter((id) => id !== level3IdToToggle);
      } else {
        newL3s = [...currentL3s, level3IdToToggle].slice(-MAX_L3_SELECTIONS);
      }
      setSelection("journal", { level3Ids: newL3s });
    },
    [setSelection]
  );

  const createJournalMutation = useMutation<
    Journal,
    Error,
    ServerCreateJournalData
  >({
    mutationFn: (data) => serverCreateJournalEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: journalKeys.hierarchy(restrictedJournalId),
      });
      closeAddJournalModal();
    },
  });

  const deleteJournalMutation = useMutation<{ message: string }, Error, string>(
    {
      mutationFn: (journalId) => serverDeleteJournalEntry(journalId),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: journalKeys.hierarchy(restrictedJournalId),
        });
        resetJournalSelections();
      },
    }
  );

  const openAddJournalModal = useCallback(
    (context: typeof addJournalContext) => {
      setAddJournalContext(context);
      setIsAddJournalModalOpen(true);
    },
    []
  );

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
    (
      formDataFromModal: Omit<AccountNodeData, "children" | "id"> & {
        id?: string;
        code?: string;
      }
    ) => {
      const journalToCreate: ServerCreateJournalData = {
        id: formDataFromModal.code || formDataFromModal.id || "",
        name: formDataFromModal.name,
        parentId: addJournalContext?.parentId || undefined,
      };
      createJournalMutation.mutate(journalToCreate);
    },
    [addJournalContext, createJournalMutation]
  );

  const deleteJournal = useCallback(
    (journalId: string) => {
      deleteJournalMutation.mutate(journalId);
    },
    [deleteJournalMutation]
  );

  return {
    hierarchyData,
    currentHierarchy,
    isHierarchyLoading: journalHierarchyQuery.isLoading,
    isHierarchyError: journalHierarchyQuery.isError,
    hierarchyError: journalHierarchyQuery.error,
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    selectedFlatJournalId,
    activeJournalRootFilters,
    effectiveSelectedJournalIds,
    isTerminalJournalActive,
    isJournalSliderPrimary,
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
    handleSelectTopLevelJournal,
    handleToggleLevel2JournalId,
    handleToggleLevel3JournalId,
    resetJournalSelections,
    setSelectedFlatJournalId,
    handleToggleJournalRootFilter,
    selectedJournalId, // The ID of the single selected journal, or null.
    isTerminal,
  };
};
