"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchJournalHierarchy, // This function in clientJournalService.ts will return AccountNodeData[]
  createJournalEntry, // This function in clientJournalService.ts will take CreateJournalData (from journalService.ts)
  deleteJournalEntry, // This function in clientJournalService.ts will take journalId (string)
  fetchJournalsLinkedToPartner,
  fetchJournalsLinkedToGood,
} from "@/services/clientJournalService"; // Ensure these are correctly implemented

// Import types from your lib/types.ts
import type {
  AccountNodeData, // For UI tree and selection
  Journal, // For flat list data from API
} from "@/lib/types";

// Import CreateJournalData from where your backend service DTO is defined
// This is what createJournalEntry client service will likely expect to send to the API
import type { CreateJournalData as ServerApiCreateJournalData } from "@/app/services/journalService";

import {
  findNodeById,
  getDescendantIds,
  getParentPathIds,
} from "@/lib/helpers"; // Keep findNodeById
// We'll use simpler deletion logic for now, or you can implement getDescendantIds/getParentPathIds
import { ROOT_JOURNAL_ID, SLIDER_TYPES } from "@/lib/constants";

export interface UseJournalManagerProps {
  sliderOrder: string[];
  visibility: { [key: string]: boolean };
  selectedPartnerIdForFlatJournals: string | null;
  selectedGoodsIdForFlatJournals: string | null;
}

export const useJournalManager = ({
  sliderOrder,
  visibility,
  selectedPartnerIdForFlatJournals,
  selectedGoodsIdForFlatJournals,
}: UseJournalManagerProps) => {
  const queryClient = useQueryClient();

  const [selectedTopLevelJournalId, setSelectedTopLevelJournalId] =
    useState<string>(ROOT_JOURNAL_ID);
  const [selectedLevel2JournalIds, setSelectedLevel2JournalIds] = useState<
    string[]
  >([]);
  const [selectedLevel3JournalIds, setSelectedLevel3JournalIds] = useState<
    string[]
  >([]);
  const [journalRootFilterStatus, setJournalRootFilterStatus] = useState<
    "affected" | "unaffected" | "all" | null
  >("affected");

  const [selectedFlatJournalIdForPjg, setSelectedFlatJournalIdForPjg] =
    useState<string | null>(null);
  const [selectedFlatJournalIdForGjp, setSelectedFlatJournalIdForGjp] =
    useState<string | null>(null);

  const journalHierarchyQuery = useQuery<AccountNodeData[], Error>({
    queryKey: ["journalHierarchy"],
    queryFn: fetchJournalHierarchy, // Assumes this returns AccountNodeData[]
    staleTime: 1000 * 60 * 5,
  });
  const currentHierarchy = useMemo(
    () => journalHierarchyQuery.data || [],
    [journalHierarchyQuery.data]
  );

  const effectiveSelectedHierarchicalJournalIds = useMemo(() => {
    if (sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) !== 0) return [];
    const effectiveIds = new Set<string>();
    const getParentContextForL2s = () =>
      selectedTopLevelJournalId && selectedTopLevelJournalId !== ROOT_JOURNAL_ID
        ? findNodeById(currentHierarchy, selectedTopLevelJournalId)
        : null;
    const parentContextNode = getParentContextForL2s();
    const sourceForL2s = parentContextNode
      ? parentContextNode.children
      : currentHierarchy;

    selectedLevel3JournalIds.forEach((l3Id) => effectiveIds.add(l3Id));
    selectedLevel2JournalIds.forEach((l2Id) => {
      const l2Node = findNodeById(sourceForL2s || [], l2Id);
      if (l2Node) {
        const anyOfItsL3ChildrenSelected = (l2Node.children || []).some(
          (l3Child) => selectedLevel3JournalIds.includes(l3Child.id)
        );
        if (!anyOfItsL3ChildrenSelected) effectiveIds.add(l2Id);
      }
    });
    if (
      effectiveIds.size === 0 &&
      selectedTopLevelJournalId &&
      selectedTopLevelJournalId !== ROOT_JOURNAL_ID
    ) {
      const l1Node = findNodeById(currentHierarchy, selectedTopLevelJournalId);
      if (l1Node && (l1Node.children || []).length === 0)
        effectiveIds.add(selectedTopLevelJournalId);
    }
    return Array.from(effectiveIds);
  }, [
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    currentHierarchy,
    sliderOrder,
  ]);

  const flatJournalsQueryForPartnerContext = useQuery<Journal[], Error>({
    // Returns Journal[]
    queryKey: [
      "flatJournalsFilteredByPartner",
      selectedPartnerIdForFlatJournals,
    ],
    queryFn: async () =>
      !selectedPartnerIdForFlatJournals
        ? []
        : fetchJournalsLinkedToPartner(selectedPartnerIdForFlatJournals),
    enabled:
      visibility[SLIDER_TYPES.JOURNAL] &&
      sliderOrder.indexOf(SLIDER_TYPES.PARTNER) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1 &&
      !!selectedPartnerIdForFlatJournals,
  });

  const flatJournalsQueryForGoodContext = useQuery<Journal[], Error>({
    // Returns Journal[]
    queryKey: ["flatJournalsFilteredByGood", selectedGoodsIdForFlatJournals],
    queryFn: async () =>
      !selectedGoodsIdForFlatJournals
        ? []
        : fetchJournalsLinkedToGood(selectedGoodsIdForFlatJournals),
    enabled:
      visibility[SLIDER_TYPES.JOURNAL] &&
      sliderOrder.indexOf(SLIDER_TYPES.GOODS) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1 &&
      !!selectedGoodsIdForFlatJournals,
  });

  const handleSelectTopLevelJournal = useCallback(
    (newTopLevelId: string, childToSelectInL2: string | null = null) => {
      setSelectedTopLevelJournalId(newTopLevelId);
      setSelectedLevel2JournalIds(childToSelectInL2 ? [childToSelectInL2] : []);
      setSelectedLevel3JournalIds([]);
    },
    []
  );

  const handleToggleLevel2JournalId = useCallback(
    (level2IdToToggle: string) => {
      const l1Node = findNodeById(currentHierarchy, selectedTopLevelJournalId);
      const sourceForL2s = l1Node?.children || currentHierarchy;

      setSelectedLevel2JournalIds((prev) => {
        const isCurrentlySelected = prev.includes(level2IdToToggle);
        if (isCurrentlySelected) {
          // Deselecting L2
          const l2Node = findNodeById(sourceForL2s, level2IdToToggle);
          if (l2Node && l2Node.children) {
            const l3ChildrenIds = l2Node.children.map((c) => c.id);
            setSelectedLevel3JournalIds((prevL3) =>
              prevL3.filter((id) => !l3ChildrenIds.includes(id))
            );
          }
          return prev.filter((id) => id !== level2IdToToggle);
        } else {
          // Selecting L2
          return [...prev, level2IdToToggle];
        }
      });
    },
    [currentHierarchy, selectedTopLevelJournalId]
  );

  const handleToggleLevel3JournalId = useCallback(
    (level3IdToToggle: string) => {
      setSelectedLevel3JournalIds((prev) =>
        prev.includes(level3IdToToggle)
          ? prev.filter((id) => id !== level3IdToToggle)
          : [...prev, level3IdToToggle]
      );
    },
    []
  );

  const handleL3DoubleClick = useCallback(
    (l3ItemId: string, isSelected: boolean) => {
      let l2ParentId: string | null = null;
      const l1Node = findNodeById(currentHierarchy, selectedTopLevelJournalId);
      const sourceForL2s = l1Node?.children || currentHierarchy;

      for (const l2Node of sourceForL2s) {
        if (l2Node.children?.some((l3Child) => l3Child.id === l3ItemId)) {
          l2ParentId = l2Node.id;
          break;
        }
      }
      if (l2ParentId) {
        setSelectedLevel2JournalIds([l2ParentId]);
        setSelectedLevel3JournalIds([l3ItemId]);
      }
    },
    [currentHierarchy, selectedTopLevelJournalId]
  );

  const handleNavigateContextDown = useCallback(
    (args: {
      currentL1ToBecomeL2: string;
      longPressedL2ToBecomeL3?: string;
    }) => {
      const { currentL1ToBecomeL2, longPressedL2ToBecomeL3 } = args;
      const newTopLevelNode = findNodeById(
        currentHierarchy,
        currentL1ToBecomeL2
      );
      if (newTopLevelNode) {
        setSelectedTopLevelJournalId(newTopLevelNode.id);
        setSelectedLevel2JournalIds(
          longPressedL2ToBecomeL3 ? [longPressedL2ToBecomeL3] : []
        );
        setSelectedLevel3JournalIds([]);
      }
    },
    [currentHierarchy]
  );

  const resetJournalSelections = useCallback(() => {
    setSelectedTopLevelJournalId(ROOT_JOURNAL_ID);
    setSelectedLevel2JournalIds([]);
    setSelectedLevel3JournalIds([]);
    setJournalRootFilterStatus("affected");
    setSelectedFlatJournalIdForPjg(null);
    setSelectedFlatJournalIdForGjp(null);
  }, []);

  // Use ServerApiCreateJournalData (which is CreateJournalData from journalService.ts)
  // The 'createJournalEntry' client service should return the created Journal (which might be mapped to AccountNodeData by it or here)
  const createJournalMutation = useMutation<
    Journal,
    Error,
    ServerApiCreateJournalData
  >({
    mutationFn: createJournalEntry, // This client service takes ServerApiCreateJournalData
    onSuccess: (newJournal) => {
      // newJournal is of type Journal (from Prisma via client service)
      queryClient.invalidateQueries({ queryKey: ["journalHierarchy"] });
      alert(`Journal '${newJournal.name}' created successfully!`);
      // Potentially close AddJournalModal here if it's not closed by its own onSubmit success
    },
    onError: (error: Error) => {
      console.error("Failed to create journal:", error);
      alert(`Error creating journal: ${error.message}`);
    },
  });

  // deleteJournalEntry client service takes journalId (string) and returns { message: string } or similar
  const deleteJournalMutation = useMutation<{ message: string }, Error, string>(
    {
      mutationFn: deleteJournalEntry,
      onSuccess: (data, deletedJournalId) => {
        queryClient.invalidateQueries({ queryKey: ["journalHierarchy"] });
        alert(
          data?.message || `Journal ${deletedJournalId} deleted successfully!`
        );

        // --- Robust Deletion Logic ---
        const deletedNodeParentPath = getParentPathIds(
          currentHierarchy,
          deletedJournalId
        );
        const deletedNodeDescendants = getDescendantIds(
          currentHierarchy,
          deletedJournalId
        );

        // Case 1: The currently selected L1 node itself was deleted, or an ancestor of it was.
        // Or, if we are at ROOT, and a direct child of ROOT was deleted.
        if (
          selectedTopLevelJournalId === deletedJournalId ||
          (selectedTopLevelJournalId !== ROOT_JOURNAL_ID &&
            deletedNodeParentPath.includes(selectedTopLevelJournalId)) ||
          (selectedTopLevelJournalId === ROOT_JOURNAL_ID &&
            deletedNodeParentPath.length === 0 &&
            findNodeById(currentHierarchy, deletedJournalId))
        ) {
          handleSelectTopLevelJournal(ROOT_JOURNAL_ID); // Reset to root
        }
        // Case 2: An L2 node was deleted, or one of its L3 children, or an ancestor of a selected L2 node
        else if (
          selectedLevel2JournalIds.some(
            (id) =>
              id === deletedJournalId ||
              deletedNodeDescendants.includes(id) ||
              deletedNodeParentPath.includes(id)
          )
        ) {
          // Filter out the deleted ID and all its descendants from L2 and L3 selections
          const newL2 = selectedLevel2JournalIds.filter(
            (id) =>
              id !== deletedJournalId && !deletedNodeDescendants.includes(id)
          );
          setSelectedLevel2JournalIds(newL2);

          const newL3 = selectedLevel3JournalIds.filter(
            (id) =>
              id !== deletedJournalId && !deletedNodeDescendants.includes(id)
          );
          setSelectedLevel3JournalIds(newL3);

          // If all L2 selections were removed as a result, and L1 is not ROOT, consider resetting L1 or re-evaluating.
          // For simplicity, if L2 becomes empty and L1 is not root, we might not need to do anything further here,
          // as the user can still see the L1 context.
          // If newL2 is empty and selectedTopLevelJournalId !== ROOT_JOURNAL_ID, it means the user is looking at an L1 with no selected L2s.
        }
        // Case 3: Only an L3 node was deleted (and it wasn't covered by L2 descendant logic)
        else if (
          selectedLevel3JournalIds.some((id) => id === deletedJournalId)
        ) {
          setSelectedLevel3JournalIds((ids) =>
            ids.filter((id) => id !== deletedJournalId)
          );
        }
        // If no selected items were directly affected or were descendants/ancestors,
        // the UI should naturally update when the hierarchy re-fetches and re-renders.
      },
      onError: (error: Error, deletedJournalId) => {
        console.error(`Failed to delete journal ${deletedJournalId}:`, error);
        alert(`Error deleting journal: ${error.message}`);
      },
    }
  );

  const handleJournalRootFilterChange = useCallback(
    (status: "affected" | "unaffected" | "all" | null) => {
      setJournalRootFilterStatus(status);
    },
    []
  );

  useEffect(() => {
    if (sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) !== 1) {
      setSelectedFlatJournalIdForPjg(null);
      setSelectedFlatJournalIdForGjp(null);
    }
  }, [sliderOrder]);

  useEffect(() => {
    if (effectiveSelectedHierarchicalJournalIds.length > 0) {
      setSelectedFlatJournalIdForPjg(null);
      setSelectedFlatJournalIdForGjp(null);
    }
  }, [effectiveSelectedHierarchicalJournalIds]);

  return {
    currentHierarchy,
    journalHierarchyQuery,
    effectiveSelectedHierarchicalJournalIds,
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    handleSelectTopLevelJournal,
    handleToggleLevel2JournalId,
    handleToggleLevel3JournalId,
    handleL3DoubleClick,
    handleNavigateContextDown,
    resetJournalSelections,
    journalRootFilterStatus,
    handleJournalRootFilterChange,
    flatJournalsForPartnerContext:
      flatJournalsQueryForPartnerContext.data || [],
    isFlatJournalsForPartnerLoading:
      flatJournalsQueryForPartnerContext.isLoading,
    flatJournalsForGoodContext: flatJournalsQueryForGoodContext.data || [],
    isFlatJournalsForGoodLoading: flatJournalsQueryForGoodContext.isLoading,
    selectedFlatJournalIdForPjg,
    setSelectedFlatJournalIdForPjg,
    selectedFlatJournalIdForGjp,
    setSelectedFlatJournalIdForGjp,
    createJournalMutation,
    deleteJournalMutation,
  };
};
