// src/hooks/useJournalManager.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchJournalHierarchy,
  createJournalEntry as serverCreateJournalEntry,
  deleteJournalEntry as serverDeleteJournalEntry,
} from "@/services/clientJournalService";
import { findNodeById, findParentOfNode } from "@/lib/helpers";
import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import type { CreateJournalData as ServerCreateJournalData } from "@/app/services/journalService";
import type {
  AccountNodeData,
  ActivePartnerFilters,
  PartnerGoodFilterStatus,
} from "@/lib/types";

// ... (Interfaces, props, and most of the hook are unchanged) ...
export interface UseJournalManagerProps {
  sliderOrder: string[];
  visibility: Record<string, boolean>;
  restrictedJournalId?: string | null;
  restrictedJournalCompanyId?: string | null;
}

export interface UseJournalManagerReturn {
  hierarchyData: AccountNodeData[];
  currentHierarchy: AccountNodeData[];
  isHierarchyLoading: boolean;
  isHierarchyError: boolean;
  hierarchyError: Error | null;
  selectedTopLevelJournalId: string;
  selectedLevel2JournalIds: string[];
  selectedLevel3JournalIds: string[];
  selectedFlatJournalId: string | null;
  effectiveSelectedJournalIds: string[];
  isTerminalJournalActive: boolean;
  isJournalSliderPrimary: boolean;
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
  isJournalNavModalOpen: boolean;
  openJournalNavModal: () => void;
  closeJournalNavModal: () => void;
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
  handleL2DoubleClick: (
    l2ItemId: string,
    isL2Selected: boolean,
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
  activeJournalRootFilters: ActivePartnerFilters;
  handleToggleJournalRootFilter: (
    filterToToggle: PartnerGoodFilterStatus
  ) => void;
}

const MAX_L2_SELECTIONS = 10;
const MAX_L3_SELECTIONS = 20;

export const useJournalManager = ({
  sliderOrder,
  visibility,
  restrictedJournalId,
  restrictedJournalCompanyId,
}: UseJournalManagerProps): UseJournalManagerReturn => {
  const queryClient = useQueryClient();
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
  const { data: hierarchyDataFromQuery } = journalHierarchyQuery;
  const rawFullHierarchyDataForUserScope = useMemo(
    () => hierarchyDataFromQuery || [],
    [hierarchyDataFromQuery]
  );
  const findNodeWithPath = useCallback(
    (
      nodeId: string,
      currentFullHierarchy: AccountNodeData[]
    ): {
      node: AccountNodeData | null;
      l1ParentId?: string;
      l2ParentId?: string;
    } => {
      for (const l1Node of currentFullHierarchy) {
        if (l1Node.id === nodeId) return { node: l1Node };
        if (l1Node.children) {
          for (const l2Node of l1Node.children) {
            if (l2Node.id === nodeId)
              return { node: l2Node, l1ParentId: l1Node.id };
            if (l2Node.children) {
              for (const l3Node of l2Node.children) {
                if (l3Node.id === nodeId)
                  return {
                    node: l3Node,
                    l1ParentId: l1Node.id,
                    l2ParentId: l2Node.id,
                  };
              }
            }
          }
        }
      }
      return { node: null };
    },
    []
  );
  const isJournalSliderPrimary = useMemo(
    () =>
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 0 &&
      visibility[SLIDER_TYPES.JOURNAL],
    [sliderOrder, visibility]
  );
  const [selectedTopLevelJournalId, setSelectedTopLevelJournalId] =
    useState<string>(() => {
      const isPrimary =
        sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 0 &&
        visibility[SLIDER_TYPES.JOURNAL];
      return isPrimary && restrictedJournalId
        ? restrictedJournalId
        : ROOT_JOURNAL_ID;
    });
  const [selectedLevel2JournalIds, setSelectedLevel2JournalIds] = useState<
    string[]
  >([]);
  const [selectedLevel3JournalIds, setSelectedLevel3JournalIds] = useState<
    string[]
  >([]);
  const [selectedFlatJournalId, setSelectedFlatJournalIdState] = useState<
    string | null
  >(null);
  const [activeJournalRootFilters, setActiveJournalRootFilters] =
    useState<ActivePartnerFilters>(["affected"]);
  const [isAddJournalModalOpen, setIsAddJournalModalOpen] = useState(false);
  const [addJournalContext, setAddJournalContext] =
    useState<UseJournalManagerReturn["addJournalContext"]>(null);
  const [isJournalNavModalOpen, setIsJournalNavModalOpen] = useState(false);
  const currentViewHierarchyForSlider = useMemo(() => {
    if (
      !rawFullHierarchyDataForUserScope ||
      rawFullHierarchyDataForUserScope.length === 0
    )
      return [];
    if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
      return rawFullHierarchyDataForUserScope;
    } else {
      const topLevelNode = findNodeById(
        rawFullHierarchyDataForUserScope,
        selectedTopLevelJournalId
      );
      if (topLevelNode) return [topLevelNode];
      else return [];
    }
  }, [selectedTopLevelJournalId, rawFullHierarchyDataForUserScope]);
  useEffect(() => {
    if (isJournalSliderPrimary) {
      const newTopLevel = restrictedJournalId || ROOT_JOURNAL_ID;
      if (selectedTopLevelJournalId !== newTopLevel) {
        setSelectedTopLevelJournalId(newTopLevel);
        setSelectedLevel2JournalIds([]);
        setSelectedLevel3JournalIds([]);
      }
    }
  }, [restrictedJournalId, isJournalSliderPrimary, selectedTopLevelJournalId]);

  // ============================ FIX IS HERE ============================
  const effectiveSelectedJournalIds = useMemo(() => {
    if (!isJournalSliderPrimary) {
      return [];
    }
    const finalIds = new Set<string>();

    // 1. Add all most granular selections first (L3s)
    selectedLevel3JournalIds.forEach((id) => finalIds.add(id));

    // 2. Identify the direct parents of the selected L3s to exclude them later.
    const parentsOfSelectedL3s = new Set<string>();
    if (selectedLevel3JournalIds.length > 0) {
      const sourceForL2s =
        selectedTopLevelJournalId === ROOT_JOURNAL_ID && !restrictedJournalId
          ? rawFullHierarchyDataForUserScope
          : findNodeById(
              rawFullHierarchyDataForUserScope,
              selectedTopLevelJournalId
            )?.children || [];

      sourceForL2s.forEach((l2Node) => {
        const hasSelectedChild = (l2Node.children || []).some((l3Child) =>
          selectedLevel3JournalIds.includes(l3Child.id)
        );
        if (hasSelectedChild) {
          parentsOfSelectedL3s.add(l2Node.id);
        }
      });
    }

    // 3. Add selected L2s, but only if they are NOT a parent of an already-added L3.
    selectedLevel2JournalIds.forEach((l2Id) => {
      if (!parentsOfSelectedL3s.has(l2Id)) {
        finalIds.add(l2Id);
      }
    });

    // 4. If nothing granular is selected, consider the L1 context.
    //    THIS IS THE CRITICAL CHANGE: It should NOT count the initial restricted journal as a selection.
    if (
      finalIds.size === 0 && // And no L2/L3s are selected
      selectedTopLevelJournalId !== ROOT_JOURNAL_ID && // And we are not at the absolute root
      selectedTopLevelJournalId !== restrictedJournalId // And we are not at the user's initial restricted view
    ) {
      // This logic now only applies when a user has actively drilled down into a sub-level.
      finalIds.add(selectedTopLevelJournalId);
    }

    return Array.from(finalIds);
  }, [
    isJournalSliderPrimary,
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    rawFullHierarchyDataForUserScope,
    restrictedJournalId, // CRITICAL dependency for the fix
  ]);
  // ========================= END OF FIX ==========================

  const isTerminalJournalActive = useMemo(() => {
    if (
      !isJournalSliderPrimary ||
      !rawFullHierarchyDataForUserScope ||
      rawFullHierarchyDataForUserScope.length === 0
    )
      return false;
    let terminalNodeIdToCheck: string | null = null;
    let nodeSourceForFind = rawFullHierarchyDataForUserScope;
    if (selectedLevel3JournalIds.length > 0) {
      terminalNodeIdToCheck = selectedLevel3JournalIds[0];
      const l1Context = findNodeById(
        rawFullHierarchyDataForUserScope,
        selectedTopLevelJournalId
      );
      const l2ContextCandidates =
        selectedTopLevelJournalId === ROOT_JOURNAL_ID &&
        (!restrictedJournalId || restrictedJournalId === ROOT_JOURNAL_ID)
          ? rawFullHierarchyDataForUserScope
          : l1Context?.children || [];
      for (const l2Id of selectedLevel2JournalIds) {
        const l2Node = findNodeById(l2ContextCandidates, l2Id);
        if (l2Node?.children?.find((c) => c.id === terminalNodeIdToCheck)) {
          nodeSourceForFind = l2Node.children;
          break;
        }
      }
    } else if (selectedLevel2JournalIds.length > 0) {
      terminalNodeIdToCheck = selectedLevel2JournalIds[0];
      const l1Context = findNodeById(
        rawFullHierarchyDataForUserScope,
        selectedTopLevelJournalId
      );
      nodeSourceForFind =
        selectedTopLevelJournalId === ROOT_JOURNAL_ID &&
        (!restrictedJournalId || restrictedJournalId === ROOT_JOURNAL_ID)
          ? rawFullHierarchyDataForUserScope
          : l1Context?.children || [];
    } else if (
      selectedTopLevelJournalId &&
      (selectedTopLevelJournalId !== ROOT_JOURNAL_ID ||
        (restrictedJournalId && restrictedJournalId === ROOT_JOURNAL_ID))
    ) {
      terminalNodeIdToCheck = selectedTopLevelJournalId;
    }
    if (!terminalNodeIdToCheck) return false;
    const node = findNodeById(nodeSourceForFind, terminalNodeIdToCheck);
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
    rawFullHierarchyDataForUserScope,
    restrictedJournalId,
  ]);

  // ... (rest of the hook is unchanged)
  const createJournalMutation = useMutation({
    mutationFn: (data: ServerCreateJournalData) =>
      serverCreateJournalEntry(data),
    onSuccess: (newJournal) => {
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
  const deleteJournalMutation = useMutation({
    mutationFn: (journalId: string) => serverDeleteJournalEntry(journalId),
    onSuccess: (data, deletedJournalId) => {
      queryClient.invalidateQueries({
        queryKey: [
          "journalHierarchy",
          restrictedJournalId,
          restrictedJournalCompanyId,
        ],
      });
      const actualRootForReset = restrictedJournalId || ROOT_JOURNAL_ID;
      if (selectedTopLevelJournalId === deletedJournalId) {
        setSelectedTopLevelJournalId(actualRootForReset);
        setSelectedLevel2JournalIds([]);
        setSelectedLevel3JournalIds([]);
      } else if (selectedLevel2JournalIds.includes(deletedJournalId)) {
        setSelectedLevel2JournalIds((ids) =>
          ids.filter((id) => id !== deletedJournalId)
        );
        const { node: deletedL2Node } = findNodeWithPath(
          deletedJournalId,
          rawFullHierarchyDataForUserScope
        );
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
    },
  });
  const resetJournalSelections = useCallback(
    (options?: { keepRootFilter?: boolean }) => {
      setSelectedTopLevelJournalId(restrictedJournalId || ROOT_JOURNAL_ID);
      setSelectedLevel2JournalIds([]);
      setSelectedLevel3JournalIds([]);
      setSelectedFlatJournalIdState(null);
      if (!options?.keepRootFilter) {
        setActiveJournalRootFilters(["affected"]);
      }
    },
    [restrictedJournalId]
  );
  const handleToggleJournalRootFilter = useCallback(
    (filterToToggle: PartnerGoodFilterStatus) => {
      setActiveJournalRootFilters((prevFilters) => {
        const isAlreadyActive = prevFilters.includes(filterToToggle);
        if (isAlreadyActive) {
          if (filterToToggle === "affected") {
            setSelectedLevel2JournalIds([]);
            setSelectedLevel3JournalIds([]);
          }
          return prevFilters.filter((f) => f !== filterToToggle);
        } else {
          return [...prevFilters, filterToToggle];
        }
      });
    },
    []
  );
  const handleSelectTopLevelJournal = useCallback(
    (
      newTopLevelId: string,
      _currentHierarchyData?: AccountNodeData[],
      childToSelectInL2: string | null = null
    ) => {
      setSelectedTopLevelJournalId(newTopLevelId);
      setSelectedLevel2JournalIds(childToSelectInL2 ? [childToSelectInL2] : []);
      setSelectedLevel3JournalIds([]);
      setSelectedFlatJournalIdState(null);
    },
    []
  );
  const handleToggleLevel2JournalId = useCallback(
    (level2IdToToggle: string, _currentHierarchyData?: AccountNodeData[]) => {
      const getSourceL2 = () => {
        if (
          selectedTopLevelJournalId === ROOT_JOURNAL_ID &&
          (!restrictedJournalId || restrictedJournalId === ROOT_JOURNAL_ID)
        ) {
          return rawFullHierarchyDataForUserScope;
        }
        const l1 = findNodeById(
          rawFullHierarchyDataForUserScope,
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
    [
      selectedTopLevelJournalId,
      rawFullHierarchyDataForUserScope,
      restrictedJournalId,
    ]
  );
  const handleToggleLevel3JournalId = useCallback(
    (level3IdToToggle: string, _currentHierarchyData?: AccountNodeData[]) => {
      setSelectedLevel3JournalIds((prevL3s) => {
        const alreadySelected = prevL3s.includes(level3IdToToggle);
        if (alreadySelected) {
          return prevL3s.filter((id) => id !== level3IdToToggle);
        } else {
          return [...prevL3s, level3IdToToggle].slice(-MAX_L3_SELECTIONS);
        }
      });
      setSelectedFlatJournalIdState(null);
    },
    []
  );
  const handleL2DoubleClick = useCallback(
    (
      l2ItemId: string,
      isL2Selected: boolean,
      currentFullHierarchy: AccountNodeData[]
    ) => {
      if (isL2Selected) {
        const { node: l2Node } = findNodeWithPath(
          l2ItemId,
          currentFullHierarchy
        );
        if (l2Node) {
          setSelectedTopLevelJournalId(l2ItemId);
          setSelectedLevel2JournalIds([]);
          setSelectedLevel3JournalIds([]);
        }
      } else {
        if (
          selectedTopLevelJournalId === restrictedJournalId &&
          restrictedJournalId !== ROOT_JOURNAL_ID
        ) {
          return;
        }
        if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
          return;
        }
        const { node: currentL1Node, l1ParentId: grandParentL1Id } =
          findNodeWithPath(selectedTopLevelJournalId, currentFullHierarchy);
        if (currentL1Node) {
          const newL1 =
            grandParentL1Id || restrictedJournalId || ROOT_JOURNAL_ID;
          setSelectedTopLevelJournalId(newL1);
          setSelectedLevel2JournalIds([selectedTopLevelJournalId]);
          setSelectedLevel3JournalIds([]);
        }
      }
      setSelectedFlatJournalIdState(null);
    },
    [
      selectedTopLevelJournalId,
      findNodeWithPath,
      restrictedJournalId,
      rawFullHierarchyDataForUserScope,
    ]
  );
  const handleL3DoubleClick = useCallback(
    (
      l3ItemId: string,
      isL3Selected: boolean,
      currentFullHierarchy: AccountNodeData[]
    ) => {
      const {
        node: l3Node,
        l1ParentId: originalL1Id,
        l2ParentId: originalL2Id,
      } = findNodeWithPath(l3ItemId, currentFullHierarchy);
      if (!l3Node || !originalL2Id) return;
      if (isL3Selected) {
        setSelectedTopLevelJournalId(originalL2Id);
        setSelectedLevel2JournalIds([l3ItemId]);
        setSelectedLevel3JournalIds([]);
      } else {
        if (
          selectedTopLevelJournalId === restrictedJournalId &&
          restrictedJournalId !== ROOT_JOURNAL_ID
        ) {
          return;
        }
        if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
          return;
        }
        const {
          node: currentL1NodeInfo,
          l1ParentId: grandParentL1IdForCurrentL1,
        } = findNodeWithPath(selectedTopLevelJournalId, currentFullHierarchy);
        if (currentL1NodeInfo) {
          const newL1 =
            grandParentL1IdForCurrentL1 ||
            restrictedJournalId ||
            ROOT_JOURNAL_ID;
          setSelectedTopLevelJournalId(newL1);
          setSelectedLevel2JournalIds([selectedTopLevelJournalId]);
          setSelectedLevel3JournalIds([]);
        }
      }
      setSelectedFlatJournalIdState(null);
    },
    [
      selectedTopLevelJournalId,
      findNodeWithPath,
      restrictedJournalId,
      rawFullHierarchyDataForUserScope,
    ]
  );
  const handleNavigateContextDown = useCallback(
    (
      args: { currentL1ToBecomeL2: string; longPressedL2ToBecomeL3?: string },
      _currentHierarchyData?: AccountNodeData[]
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
  const setSelectedFlatJournalId = useCallback(
    (id: string | null) => {
      setSelectedFlatJournalIdState(id);
      if (id !== null) {
        setSelectedTopLevelJournalId(restrictedJournalId || ROOT_JOURNAL_ID);
        setSelectedLevel2JournalIds([]);
        setSelectedLevel3JournalIds([]);
      }
    },
    [restrictedJournalId]
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
  useEffect(() => {
    if (!isJournalSliderPrimary) {
      const effectiveRoot = restrictedJournalId || ROOT_JOURNAL_ID;
      if (
        selectedTopLevelJournalId !== effectiveRoot ||
        selectedLevel2JournalIds.length > 0 ||
        selectedLevel3JournalIds.length > 0
      ) {
        setSelectedTopLevelJournalId(effectiveRoot);
        setSelectedLevel2JournalIds([]);
        setSelectedLevel3JournalIds([]);
      }
    }
  }, [
    isJournalSliderPrimary,
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    restrictedJournalId,
  ]);

  return {
    hierarchyData: rawFullHierarchyDataForUserScope,
    currentHierarchy: currentViewHierarchyForSlider,
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
    handleL2DoubleClick,
    handleL3DoubleClick,
    handleNavigateContextDown,
    resetJournalSelections,
    setSelectedFlatJournalId,
    activeJournalRootFilters,
    handleToggleJournalRootFilter,
  };
};
