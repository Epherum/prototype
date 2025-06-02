// src/hooks/useJournalManager.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchJournalHierarchy,
  createJournalEntry as serverCreateJournalEntry,
  deleteJournalEntry as serverDeleteJournalEntry,
} from "@/services/clientJournalService";
import { findNodeById } from "@/lib/helpers";
import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import type { CreateJournalData as ServerCreateJournalData } from "@/app/services/journalService";
import type { AccountNodeData } from "@/lib/types";

export interface UseJournalManagerProps {
  sliderOrder: string[];
  visibility: Record<string, boolean>;
}

export interface UseJournalManagerReturn {
  // Data & Queries
  hierarchyData: AccountNodeData[]; // Raw data from query, for external use (e.g. linking modals)
  currentHierarchy: AccountNodeData[]; // Memoized hierarchyData for slider and internal logic
  isHierarchyLoading: boolean;
  isHierarchyError: boolean;
  hierarchyError: Error | null;

  // Hierarchical Selection State
  selectedTopLevelJournalId: string;
  selectedLevel2JournalIds: string[];
  selectedLevel3JournalIds: string[];

  // Flat List Selection State
  selectedFlatJournalId: string | null;

  // Derived State
  effectiveSelectedJournalIds: string[];
  isTerminalJournalActive: boolean; // True if a terminal journal account is effectively selected
  isJournalSliderPrimary: boolean;

  // CRUD State & Operations
  isAddJournalModalOpen: boolean;
  addJournalContext: {
    level: "top" | "child";
    parentId: string | null;
    parentCode?: string;
    parentName?: string;
  } | null;
  openAddJournalModal: (
    context: UseJournalManagerReturn["addJournalContext"]
  ) => void;
  closeAddJournalModal: () => void;
  createJournal: (
    formData: Omit<AccountNodeData, "children" | "id"> & {
      id?: string;
      code?: string;
    }
  ) => void;
  isCreatingJournal: boolean;
  deleteJournal: (journalId: string) => void;
  isDeletingJournal: boolean;

  // Navigation/Management Modal State & Operations
  isJournalNavModalOpen: boolean;
  openJournalNavModal: () => void;
  closeJournalNavModal: () => void;

  // Handlers (these now take currentHierarchyData as an argument from page.tsx)
  handleSelectTopLevelJournal: (
    newTopLevelId: string,
    currentHierarchyData: AccountNodeData[],
    childToSelectInL2?: string | null
  ) => void;
  handleToggleLevel2JournalId: (
    level2IdToToggle: string,
    currentHierarchyData: AccountNodeData[]
  ) => void;
  handleToggleLevel3JournalId: (
    level3IdToToggle: string,
    currentHierarchyData: AccountNodeData[]
  ) => void;
  handleL3DoubleClick: (
    l3ItemId: string,
    isSelected: boolean,
    currentHierarchyData: AccountNodeData[]
  ) => void;
  handleNavigateContextDown: (
    args: { currentL1ToBecomeL2: string; longPressedL2ToBecomeL3?: string },
    currentHierarchyData: AccountNodeData[]
  ) => void;
  resetJournalSelections: (options?: { keepRootFilter?: boolean }) => void;
  setSelectedFlatJournalId: (id: string | null) => void;

  // Journal Root Filter (when primary)
  journalRootFilterStatus: "affected" | "unaffected" | "all" | null;
  setJournalRootFilterStatus: (
    status: "affected" | "unaffected" | "all" | null
  ) => void;
}

const MAX_L2_SELECTIONS = 10;
const MAX_L3_SELECTIONS = 20;

export const useJournalManager = ({
  sliderOrder,
  visibility,
}: UseJournalManagerProps): UseJournalManagerReturn => {
  const queryClient = useQueryClient();

  const journalHierarchyQuery = useQuery<AccountNodeData[], Error>({
    queryKey: ["journalHierarchy"],
    queryFn: fetchJournalHierarchy,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const internalCurrentHierarchy = useMemo(
    () => journalHierarchyQuery.data || [],
    [journalHierarchyQuery.data]
  );

  const [selectedTopLevelJournalId, setSelectedTopLevelJournalId] =
    useState<string>(ROOT_JOURNAL_ID);
  const [selectedLevel2JournalIds, setSelectedLevel2JournalIds] = useState<
    string[]
  >([]);
  const [selectedLevel3JournalIds, setSelectedLevel3JournalIds] = useState<
    string[]
  >([]);
  const [selectedFlatJournalId, setSelectedFlatJournalIdState] = useState<
    string | null
  >(null);
  const [journalRootFilterStatus, setJournalRootFilterStatusState] = useState<
    "affected" | "unaffected" | "all" | null
  >("affected");

  const [isAddJournalModalOpen, setIsAddJournalModalOpen] = useState(false);
  const [addJournalContext, setAddJournalContext] =
    useState<UseJournalManagerReturn["addJournalContext"]>(null);
  const [isJournalNavModalOpen, setIsJournalNavModalOpen] = useState(false);

  const isJournalSliderPrimary = useMemo(
    () =>
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 0 &&
      visibility[SLIDER_TYPES.JOURNAL],
    [sliderOrder, visibility]
  );

  const effectiveSelectedJournalIds = useMemo(() => {
    if (!isJournalSliderPrimary) return [];

    const effectiveIds = new Set<string>();
    // Helper to get the correct list of children for L2 selection (either root or L1's children)
    const getSourceForL2s = () => {
      if (selectedTopLevelJournalId === ROOT_JOURNAL_ID)
        return internalCurrentHierarchy;
      const l1Node = findNodeById(
        internalCurrentHierarchy,
        selectedTopLevelJournalId
      );
      return l1Node?.children || [];
    };
    const sourceForL2s = getSourceForL2s();

    selectedLevel3JournalIds.forEach((l3Id) => effectiveIds.add(l3Id));

    selectedLevel2JournalIds.forEach((l2Id) => {
      const l2Node = findNodeById(sourceForL2s, l2Id); // Search within the correct context
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
      const l1Node = findNodeById(
        internalCurrentHierarchy,
        selectedTopLevelJournalId
      );
      // If L1 is selected, and it has no children (is terminal), OR no L2s are selected from it, then L1 itself is "effective"
      if (
        l1Node &&
        ((l1Node.children || []).length === 0 ||
          selectedLevel2JournalIds.length === 0)
      ) {
        effectiveIds.add(selectedTopLevelJournalId);
      }
    }

    return Array.from(effectiveIds);
  }, [
    isJournalSliderPrimary,
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    internalCurrentHierarchy,
  ]);

  const isTerminalJournalActive = useMemo(() => {
    if (
      !isJournalSliderPrimary ||
      !internalCurrentHierarchy ||
      internalCurrentHierarchy.length === 0
    )
      return false;

    let terminalNodeIdToCheck: string | null = null;
    let nodeSource = internalCurrentHierarchy; // Default source

    if (selectedLevel3JournalIds.length > 0) {
      terminalNodeIdToCheck = selectedLevel3JournalIds[0]; // Check first L3
      // Find L3's parent L2 to correctly locate L3 node
      for (const l1 of internalCurrentHierarchy) {
        if (
          l1.id === selectedTopLevelJournalId ||
          selectedTopLevelJournalId === ROOT_JOURNAL_ID
        ) {
          const l1Children =
            selectedTopLevelJournalId === ROOT_JOURNAL_ID
              ? internalCurrentHierarchy
              : l1.children || [];
          for (const l2 of l1Children) {
            if (selectedLevel2JournalIds.includes(l2.id)) {
              if (
                (l2.children || []).find(
                  (l3) => l3.id === terminalNodeIdToCheck
                )
              ) {
                nodeSource = l2.children || [];
                break;
              }
            }
          }
        }
        if (
          nodeSource !== internalCurrentHierarchy &&
          nodeSource.find((n) => n.id === terminalNodeIdToCheck)
        )
          break;
        else nodeSource = internalCurrentHierarchy; // reset if not found in specific L2
      }
    } else if (selectedLevel2JournalIds.length > 0) {
      terminalNodeIdToCheck = selectedLevel2JournalIds[0]; // Check first L2
      if (selectedTopLevelJournalId !== ROOT_JOURNAL_ID) {
        const l1Node = findNodeById(
          internalCurrentHierarchy,
          selectedTopLevelJournalId
        );
        nodeSource = l1Node?.children || [];
      }
    } else if (
      selectedTopLevelJournalId &&
      selectedTopLevelJournalId !== ROOT_JOURNAL_ID
    ) {
      terminalNodeIdToCheck = selectedTopLevelJournalId; // Check L1
    }

    if (!terminalNodeIdToCheck) return false;

    const node = findNodeById(nodeSource, terminalNodeIdToCheck);
    return !!(
      node &&
      node.isTerminal &&
      (!node.children || node.children.length === 0)
    );
  }, [
    isJournalSliderPrimary,
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    internalCurrentHierarchy,
  ]);

  const createJournalMutation = useMutation({
    mutationFn: (data: ServerCreateJournalData) =>
      serverCreateJournalEntry(data),
    onSuccess: (newJournal) => {
      queryClient.invalidateQueries({ queryKey: ["journalHierarchy"] });
      closeAddJournalModal();
      // Alert can be handled in page.tsx using mutation.isSuccess
    },
    // onError handled in page.tsx or by component using the mutation status
  });

  const deleteJournalMutation = useMutation({
    mutationFn: (journalId: string) => serverDeleteJournalEntry(journalId),
    onSuccess: (data, deletedJournalId) => {
      queryClient.invalidateQueries({ queryKey: ["journalHierarchy"] });
      // Reset selections if the deleted journal was part of the active selection path
      if (selectedTopLevelJournalId === deletedJournalId) {
        setSelectedTopLevelJournalId(ROOT_JOURNAL_ID);
        setSelectedLevel2JournalIds([]);
        setSelectedLevel3JournalIds([]);
      } else if (selectedLevel2JournalIds.includes(deletedJournalId)) {
        setSelectedLevel2JournalIds((ids) =>
          ids.filter((id) => id !== deletedJournalId)
        );
        // Also remove any L3 children of the deleted L2
        const deletedL2Node = findNodeById(
          internalCurrentHierarchy,
          deletedJournalId
        ); // Search full hierarchy
        if (deletedL2Node?.children) {
          const childL3Ids = deletedL2Node.children.map((c) => c.id);
          setSelectedLevel3JournalIds((l3s) =>
            l3s.filter((id) => !childL3Ids.includes(id))
          );
        }
      } else if (selectedLevel3JournalIds.includes(deletedJournalId)) {
        setSelectedLevel3JournalIds((ids) =>
          ids.filter((id) => id !== deletedJournalId)
        );
      }
      // Alert can be handled in page.tsx
    },
  });

  const resetJournalSelections = useCallback(
    (options?: { keepRootFilter?: boolean }) => {
      setSelectedTopLevelJournalId(ROOT_JOURNAL_ID);
      setSelectedLevel2JournalIds([]);
      setSelectedLevel3JournalIds([]);
      setSelectedFlatJournalIdState(null);
      if (!options?.keepRootFilter) {
        setJournalRootFilterStatusState("affected");
      }
    },
    []
  );

  const handleSelectTopLevelJournal = useCallback(
    (
      newTopLevelId: string,
      currentHierarchyData: AccountNodeData[],
      childToSelectInL2: string | null = null
    ) => {
      setSelectedTopLevelJournalId(newTopLevelId);
      setSelectedLevel2JournalIds(childToSelectInL2 ? [childToSelectInL2] : []);
      setSelectedLevel3JournalIds([]);
      setSelectedFlatJournalIdState(null); // Hierarchical selection implies not using flat ID
    },
    []
  );

  const handleToggleLevel2JournalId = useCallback(
    (level2IdToToggle: string, currentHierarchyData: AccountNodeData[]) => {
      const getSourceL2 = () => {
        if (selectedTopLevelJournalId === ROOT_JOURNAL_ID)
          return currentHierarchyData;
        const l1 = findNodeById(
          currentHierarchyData,
          selectedTopLevelJournalId
        );
        return l1?.children || [];
      };

      setSelectedLevel2JournalIds((prevL2s) => {
        const alreadySelected = prevL2s.includes(level2IdToToggle);
        let newL2s;
        if (alreadySelected) {
          newL2s = prevL2s.filter((id) => id !== level2IdToToggle);
          const l2Node = findNodeById(getSourceL2(), level2IdToToggle);
          if (l2Node && l2Node.children) {
            const l3ChildrenIds = l2Node.children.map((c) => c.id);
            setSelectedLevel3JournalIds((prevL3s) =>
              prevL3s.filter((id) => !l3ChildrenIds.includes(id))
            );
          }
        } else {
          newL2s = [...prevL2s, level2IdToToggle].slice(-MAX_L2_SELECTIONS);
        }
        return newL2s;
      });
      setSelectedFlatJournalIdState(null);
    },
    [selectedTopLevelJournalId]
  );

  const handleToggleLevel3JournalId = useCallback(
    (level3IdToToggle: string, currentHierarchyData: AccountNodeData[]) => {
      setSelectedLevel3JournalIds((prevL3s) => {
        const alreadySelected = prevL3s.includes(level3IdToToggle);
        if (alreadySelected) {
          return prevL3s.filter((id) => id !== level3IdToToggle);
        } else {
          // Logic to ensure parent L2 is selected could be added here if needed,
          // but typically UI handles selection flow.
          return [...prevL3s, level3IdToToggle].slice(-MAX_L3_SELECTIONS);
        }
      });
      setSelectedFlatJournalIdState(null);
    },
    []
  );

  const handleL3DoubleClick = useCallback(
    (
      l3ItemId: string,
      isSelected: boolean,
      currentHierarchyData: AccountNodeData[]
    ) => {
      // Find the L3 node and its L2 parent, then L1 parent
      let l1ParentId: string | null = null;
      let l2ParentId: string | null = null;

      const findParents = (
        nodes: AccountNodeData[],
        targetId: string,
        currentL1: string | null,
        currentL2: string | null
      ): boolean => {
        for (const node of nodes) {
          if (node.id === targetId) {
            if (currentL2) {
              // Target is L3, currentL2 is its parent
              l2ParentId = currentL2;
              l1ParentId = currentL1;
            } else if (currentL1) {
              // Target is L2, currentL1 is its parent
              l2ParentId = targetId;
              l1ParentId = currentL1;
            } else {
              // Target is L1
              l1ParentId = targetId;
            }
            return true;
          }
          if (node.children) {
            if (
              findParents(
                node.children,
                targetId,
                currentL1 || node.id,
                currentL2 || (currentL1 ? node.id : null)
              )
            )
              return true;
          }
        }
        return false;
      };

      findParents(
        currentHierarchyData,
        l3ItemId,
        selectedTopLevelJournalId === ROOT_JOURNAL_ID
          ? null
          : selectedTopLevelJournalId,
        null
      );

      // Re-evaluate: Simplified logic from useJournalNavigation (original hook) was:
      const l3Node = findNodeById(currentHierarchyData, l3ItemId);
      if (l3Node && l3Node.parentId) {
        const l2NodeId = l3Node.parentId;
        const l2Node = findNodeById(currentHierarchyData, l2NodeId); // Search from root
        if (l2Node && l2Node.parentId) {
          // L2 has L1 parent
          setSelectedTopLevelJournalId(l2Node.parentId);
          setSelectedLevel2JournalIds([l2NodeId]);
          setSelectedLevel3JournalIds([l3ItemId]);
        } else if (l2Node) {
          // L2Node is actually an L1, and l3Node is an L2
          setSelectedTopLevelJournalId(l2NodeId); // l2NodeId is L1
          setSelectedLevel2JournalIds([l3ItemId]); // l3ItemId is L2
          setSelectedLevel3JournalIds([]);
        }
      }
      setSelectedFlatJournalIdState(null);
    },
    [selectedTopLevelJournalId]
  );

  const handleNavigateContextDown = useCallback(
    (
      args: { currentL1ToBecomeL2: string; longPressedL2ToBecomeL3?: string },
      currentHierarchyData: AccountNodeData[]
    ) => {
      const { currentL1ToBecomeL2, longPressedL2ToBecomeL3 } = args;
      setSelectedTopLevelJournalId(currentL1ToBecomeL2);
      setSelectedLevel2JournalIds(
        longPressedL2ToBecomeL3 ? [longPressedL2ToBecomeL3] : []
      );
      setSelectedLevel3JournalIds([]);
      setSelectedFlatJournalIdState(null);
    },
    []
  );

  const setSelectedFlatJournalId = useCallback((id: string | null) => {
    setSelectedFlatJournalIdState(id);
    if (id !== null) {
      // If a flat journal is selected, clear hierarchical selections
      setSelectedTopLevelJournalId(ROOT_JOURNAL_ID);
      setSelectedLevel2JournalIds([]);
      setSelectedLevel3JournalIds([]);
    }
  }, []);

  const setJournalRootFilterStatus = useCallback(
    (status: "affected" | "unaffected" | "all" | null) => {
      setJournalRootFilterStatusState(status);
      if (status !== null && isJournalSliderPrimary) {
        // If a root filter is applied while primary, ensure flat selection is off
        setSelectedFlatJournalIdState(null);
      }
    },
    [isJournalSliderPrimary]
  );

  const openAddJournalModal = useCallback(
    (context: UseJournalManagerReturn["addJournalContext"]) => {
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
        id: formDataFromModal.code || formDataFromModal.id || "", // Backend should handle if ID is missing (e.g. for new entries)
        name: formDataFromModal.name,
        parentId: addJournalContext?.parentId || undefined,
        isTerminal: formDataFromModal.isTerminal || false,
        additionalDetails: formDataFromModal.additionalDetails,
      };
      createJournalMutation.mutate(journalToCreate);
    },
    [addJournalContext, createJournalMutation]
  );

  const deleteJournal = useCallback(
    (journalId: string) => {
      // Confirmation should be handled by UI before calling this
      deleteJournalMutation.mutate(journalId);
    },
    [deleteJournalMutation]
  );

  // Effect to manage selection state based on primary status
  useEffect(() => {
    if (isJournalSliderPrimary) {
      // If Journal becomes primary and a flat ID was selected, clear flat ID
      if (selectedFlatJournalId !== null) {
        setSelectedFlatJournalIdState(null);
      }
    } else {
      // If Journal is not primary, clear hierarchical selections (flat ID will be set by page.tsx via setSelectedFlatJournalId)
      if (
        selectedTopLevelJournalId !== ROOT_JOURNAL_ID ||
        selectedLevel2JournalIds.length > 0 ||
        selectedLevel3JournalIds.length > 0
      ) {
        setSelectedTopLevelJournalId(ROOT_JOURNAL_ID);
        setSelectedLevel2JournalIds([]);
        setSelectedLevel3JournalIds([]);
      }
    }
  }, [
    isJournalSliderPrimary,
    selectedFlatJournalId,
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
  ]);

  return {
    hierarchyData: journalHierarchyQuery.data || [],
    currentHierarchy: internalCurrentHierarchy,
    isHierarchyLoading: journalHierarchyQuery.isLoading,
    isHierarchyError: journalHierarchyQuery.isError,
    hierarchyError: journalHierarchyQuery.error,

    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    selectedFlatJournalId,

    effectiveSelectedJournalIds,
    isTerminalJournalActive,
    isJournalSliderPrimary,

    isAddJournalModalOpen,
    addJournalContext,
    openAddJournalModal,
    closeAddJournalModal,
    createJournal,
    isCreatingJournal: createJournalMutation.isPending,
    deleteJournal,
    isDeletingJournal: deleteJournalMutation.isPending,

    isJournalNavModalOpen,
    openJournalNavModal,
    closeJournalNavModal,

    handleSelectTopLevelJournal,
    handleToggleLevel2JournalId,
    handleToggleLevel3JournalId,
    handleL3DoubleClick,
    handleNavigateContextDown,
    resetJournalSelections,
    setSelectedFlatJournalId,

    journalRootFilterStatus,
    setJournalRootFilterStatus,
  };
};
