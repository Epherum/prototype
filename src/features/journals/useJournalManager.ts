// src/features/journals/useJournalManager.ts
"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchJournalHierarchy,
  createJournalEntry as serverCreateJournalEntry,
  deleteJournalEntry as serverDeleteJournalEntry,
} from "@/services/clientJournalService";
import { findNodeById } from "@/lib/helpers";
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

  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const restrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );
  const restrictedJournalCompanyId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalCompanyId
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
    queryKey: [
      "journalHierarchy",
      restrictedJournalId,
      restrictedJournalCompanyId,
    ],
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

  const effectiveSelectedJournalIds = useMemo(() => {
    if (!isJournalSliderPrimary) {
      return selectedFlatJournalId ? [selectedFlatJournalId] : [];
    }

    const finalIds = new Set<string>();
    selectedLevel3JournalIds.forEach((id) => finalIds.add(id));

    const parentsOfSelectedL3s = new Set<string>();
    if (selectedLevel3JournalIds.length > 0) {
      const sourceForL2s =
        selectedTopLevelJournalId === (restrictedJournalId || ROOT_JOURNAL_ID)
          ? hierarchyData
          : findNodeById(hierarchyData, selectedTopLevelJournalId)?.children ||
            [];

      sourceForL2s.forEach((l2Node) => {
        if (
          (l2Node.children || []).some((l3Child) =>
            selectedLevel3JournalIds.includes(l3Child.id)
          )
        ) {
          parentsOfSelectedL3s.add(l2Node.id);
        }
      });
    }

    selectedLevel2JournalIds.forEach((l2Id) => {
      if (!parentsOfSelectedL3s.has(l2Id)) {
        finalIds.add(l2Id);
      }
    });

    const effectiveRoot = restrictedJournalId || ROOT_JOURNAL_ID;
    if (finalIds.size === 0 && selectedTopLevelJournalId !== effectiveRoot) {
      finalIds.add(selectedTopLevelJournalId);
    }

    return Array.from(finalIds);
  }, [
    isJournalSliderPrimary,
    selectedFlatJournalId,
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    hierarchyData,
    restrictedJournalId,
  ]);

  const isTerminalJournalActive = useMemo(() => {
    if (!isJournalSliderPrimary || effectiveSelectedJournalIds.length !== 1)
      return false;

    const singleSelectedId = effectiveSelectedJournalIds[0];
    const node = findNodeById(hierarchyData, singleSelectedId);
    return !!node?.isTerminal;
  }, [isJournalSliderPrimary, effectiveSelectedJournalIds, hierarchyData]);

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
      if (options?.keepRootFilter) {
        // <<-- FIX: Use `useAppStore.getState()` instead of `get()`.
        resetPayload.rootFilter =
          useAppStore.getState().selections.journal.rootFilter;
      } else {
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
    [setSelection, hierarchyData]
  );

  const handleToggleLevel3JournalId = useCallback(
    (level3IdToToggle: string) => {
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

  // <<-- FIX: The mutation now expects to return AccountNodeData
  const createJournalMutation = useMutation<
    AccountNodeData,
    Error,
    ServerCreateJournalData
  >({
    // <<-- FIX: Map the `Journal` response from the server to the `AccountNodeData` type.
    mutationFn: async (
      data: ServerCreateJournalData
    ): Promise<AccountNodeData> => {
      const newJournal: Journal = await serverCreateJournalEntry(data);
      return {
        id: newJournal.id,
        name: newJournal.name,
        code: newJournal.id, // The 'code' property is required by AccountNodeData
        isTerminal: newJournal.isTerminal,
        children: [],
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "journalHierarchy",
          restrictedJournalId,
          restrictedJournalCompanyId,
        ],
      });
      closeAddJournalModal();
    },
  });

  const deleteJournalMutation = useMutation<{ message: string }, Error, string>(
    {
      mutationFn: (journalId) => serverDeleteJournalEntry(journalId),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            "journalHierarchy",
            restrictedJournalId,
            restrictedJournalCompanyId,
          ],
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
