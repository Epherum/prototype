// src/features/journals/useJournalManager.ts
"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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
    queryKey: ["journalHierarchy", restrictedJournalId],
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

  // ==================================================================
  // --- FINAL, REVISED LOGIC ---
  // This version correctly handles the initial state and per-branch drill-down.
  // ==================================================================
  const effectiveSelectedJournalIds = useMemo(() => {
    // Guard Clause 1: If journal slider isn't primary, it's a flat list.
    if (!isJournalSliderPrimary) {
      return selectedFlatJournalId ? [selectedFlatJournalId] : [];
    }

    // Guard Clause 2: If no root filter (e.g., "Affected") is active, drill-down is disabled.
    // Return empty array so subsequent queries do not filter by journal.
    if (activeJournalRootFilters.length === 0) {
      return [];
    }

    // *** THE CRITICAL FIX IS HERE ***
    // Guard Clause 3: If a root filter IS active, but the user has not yet selected
    // any L2 or L3 items, the context should be empty. This prevents the top-level
    // ID from being used as a filter by default, fulfilling the user story.
    if (
      selectedLevel2JournalIds.length === 0 &&
      selectedLevel3JournalIds.length === 0
    ) {
      return [];
    }

    // --- Begin Per-Branch Replacement Algorithm ---
    const finalIds = new Set<string>();

    // Step 1: Add all L3 Selections. These are the most specific and always take precedence.
    selectedLevel3JournalIds.forEach((id) => finalIds.add(id));

    // Step 2: Identify the L2 parents of the L3 selections.
    const l2ParentsOfSelectedL3s = new Set<string>();
    if (selectedLevel3JournalIds.length > 0) {
      selectedLevel3JournalIds.forEach((l3Id) => {
        const parent = findParentOfNode(l3Id, hierarchyData);
        if (parent) {
          l2ParentsOfSelectedL3s.add(parent.id);
        }
      });
    }

    // Step 3: Add L2 Selections conditionally.
    selectedLevel2JournalIds.forEach((l2Id) => {
      // Add the L2 ID to the final set ONLY IF it is NOT already "represented" by a selected L3 child.
      if (!l2ParentsOfSelectedL3s.has(l2Id)) {
        finalIds.add(l2Id);
      }
    });

    return Array.from(finalIds);
  }, [
    isJournalSliderPrimary,
    selectedFlatJournalId,
    activeJournalRootFilters,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    hierarchyData,
  ]);

  const isTerminalJournalActive = useMemo(() => {
    if (!isJournalSliderPrimary || effectiveSelectedJournalIds.length !== 1)
      return false;
    const singleSelectedId = effectiveSelectedJournalIds[0];
    const node = findNodeById(hierarchyData, singleSelectedId);
    return !!node?.isTerminal;
  }, [isJournalSliderPrimary, effectiveSelectedJournalIds, hierarchyData]);

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
        alert("Please select a filter like 'Affected' to enable drill-down.");
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
        alert("Please select a filter like 'Affected' to enable drill-down.");
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

  // ... rest of the file is unchanged ...

  const createJournalMutation = useMutation<
    Journal,
    Error,
    ServerCreateJournalData
  >({
    mutationFn: (data) => serverCreateJournalEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["journalHierarchy", restrictedJournalId],
      });
      closeAddJournalModal();
    },
  });

  const deleteJournalMutation = useMutation<{ message: string }, Error, string>(
    {
      mutationFn: (journalId) => serverDeleteJournalEntry(journalId),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["journalHierarchy", restrictedJournalId],
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
  };
};
