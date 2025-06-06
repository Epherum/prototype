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
  restrictedJournalId?: string | null;
  restrictedJournalCompanyId?: string | null;
}

// ... (UseJournalManagerReturn interface remains the same) ...
export interface UseJournalManagerReturn {
  // Data & Queries
  hierarchyData: AccountNodeData[];
  currentHierarchy: AccountNodeData[];
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
  isTerminalJournalActive: boolean;
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

  // Handlers
  handleSelectTopLevelJournal: (
    newTopLevelId: string,
    currentHierarchyData: AccountNodeData[], // This param seems unused within the function, can be removed if so
    childToSelectInL2?: string | null
  ) => void;
  handleToggleLevel2JournalId: (
    level2IdToToggle: string,
    currentHierarchyData: AccountNodeData[] // This param seems unused within the function, can be removed if so
  ) => void;
  handleToggleLevel3JournalId: (
    level3IdToToggle: string,
    currentHierarchyData: AccountNodeData[] // This param seems unused within the function, can be removed if so
  ) => void;

  handleL2DoubleClick: (
    l2ItemId: string,
    isL2Selected: boolean,
    currentHierarchyData: AccountNodeData[] // This is the full hierarchy (potentially restricted sub-tree)
  ) => void;

  handleL3DoubleClick: (
    l3ItemId: string,
    isSelected: boolean,
    currentHierarchyData: AccountNodeData[] // This is the full hierarchy (potentially restricted sub-tree)
  ) => void;
  handleNavigateContextDown: (
    args: { currentL1ToBecomeL2: string; longPressedL2ToBecomeL3?: string },
    currentHierarchyData: AccountNodeData[] // This param seems unused, can be removed
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
  restrictedJournalId,
  restrictedJournalCompanyId,
}: UseJournalManagerProps): UseJournalManagerReturn => {
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log("[useJournalManager] Props received:", {
      restrictedJournalId,
      restrictedJournalCompanyId,
      sliderOrder,
      visibility,
    });
  }, [
    restrictedJournalId,
    restrictedJournalCompanyId,
    sliderOrder,
    visibility,
  ]);

  const journalHierarchyQuery = useQuery<AccountNodeData[], Error>({
    queryKey: [
      "journalHierarchy",
      restrictedJournalId,
      restrictedJournalCompanyId,
    ], // Add companyId if it influences the fetch directly from client
    queryFn: () => {
      console.log(
        "[useJournalManager] Fetching hierarchy. Restriction ID from prop:",
        restrictedJournalId
      );
      // fetchJournalHierarchy now correctly passes restrictedJournalId (or null)
      // and expects the API to return the appropriate sub-tree or full tree.
      return fetchJournalHierarchy(restrictedJournalId);
    },
    staleTime: 5 * 60 * 1000,
    enabled: visibility[SLIDER_TYPES.JOURNAL],
  });

  const { data: hierarchyDataFromQuery } = journalHierarchyQuery;

  const rawFullHierarchyDataForUserScope = useMemo(
    // New name
    () => hierarchyDataFromQuery || [],
    [hierarchyDataFromQuery]
  );

  // Helper: findNodeWithPath - unchanged but crucial for navigation within rawFullHierarchyDataForUserScope
  const findNodeWithPath = useCallback(
    (
      nodeId: string,
      currentFullHierarchy: AccountNodeData[] // This will be rawFullHierarchyDataForUserScope
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
    [] // No dependencies, relies on args
  );

  const isJournalSliderPrimary = useMemo(
    () =>
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 0 &&
      visibility[SLIDER_TYPES.JOURNAL],
    [sliderOrder, visibility]
  );

  // Initialize selectedTopLevelJournalId:
  // If restricted, this will be the restrictedJournalId. Otherwise, ROOT_JOURNAL_ID.
  const [selectedTopLevelJournalId, setSelectedTopLevelJournalId] =
    useState<string>(() => {
      const isPrimary = isJournalSliderPrimary; // Use the memoized value if available at init
      console.log(
        `[useJournalManager] Initializing selectedTopLevelJournalId. isPrimary: ${isPrimary}, restrictedJournalId: ${restrictedJournalId}`
      );
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
  const [journalRootFilterStatus, setJournalRootFilterStatusState] = useState<
    "affected" | "unaffected" | "all" | null
  >("affected");

  const [isAddJournalModalOpen, setIsAddJournalModalOpen] = useState(false);
  const [addJournalContext, setAddJournalContext] =
    useState<UseJournalManagerReturn["addJournalContext"]>(null);
  const [isJournalNavModalOpen, setIsJournalNavModalOpen] = useState(false);

  const currentViewHierarchyForSlider = useMemo(() => {
    // Log inputs for debugging
    console.log(
      "[UJM] Recalculating currentViewHierarchyForSlider. SelectedTopLevel:",
      selectedTopLevelJournalId,
      "rawFullHierarchyDataForUserScope items:",
      rawFullHierarchyDataForUserScope.length
    );

    if (
      !rawFullHierarchyDataForUserScope ||
      rawFullHierarchyDataForUserScope.length === 0
    ) {
      return [];
    }

    if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
      // When at the root, currentViewHierarchyForSlider is the list of actual top-level accounts
      // (or the children of the restricted node if restrictedJournalId is active and not ROOT_JOURNAL_ID itself).
      // fetchJournalHierarchy should provide these directly as rawFullHierarchyDataForUserScope.
      console.log(
        "[UJM] currentViewHierarchyForSlider: Root view, returning rawFullHierarchyDataForUserScope (count: " +
          rawFullHierarchyDataForUserScope.length +
          ")"
      );
      return rawFullHierarchyDataForUserScope;
    } else {
      // When a specific L1 is selected (e.g., "Assets-Current"),
      // currentViewHierarchyForSlider should be an array containing only that specific node object.
      // The slider then uses this node's .children property to populate its L2 scroller.
      const topLevelNode = findNodeById(
        rawFullHierarchyDataForUserScope,
        selectedTopLevelJournalId
      );
      if (topLevelNode) {
        console.log(
          "[UJM] currentViewHierarchyForSlider: Specific L1 view (" +
            selectedTopLevelJournalId +
            "). Node found. Returning array with this node."
        );
        return [topLevelNode];
      } else {
        // This might happen if selectedTopLevelJournalId is stale or refers to a node not in the current scope.
        // Or, if rawFullHierarchyDataForUserScope *is* the single restricted node and selectedTopLevelJournalId is its ID.
        // If rawFullHierarchyDataForUserScope IS the single restricted node, and selectedTopLevelJournalId is its ID,
        // then findNodeById should find it.
        console.warn(
          "[UJM] currentViewHierarchyForSlider: Specific L1 view (" +
            selectedTopLevelJournalId +
            "). Node NOT FOUND in rawFullHierarchyDataForUserScope. This might be an issue. Returning empty array for now."
        );
        return [];
      }
    }
  }, [selectedTopLevelJournalId, rawFullHierarchyDataForUserScope]);

  // Effect to reset selections if restrictedJournalId changes OR if primary status changes
  useEffect(() => {
    console.log(
      `[useJournalManager] useEffect[restrictedJournalId, isJournalSliderPrimary] running. isPrimary: ${isJournalSliderPrimary}, restrictedId: ${restrictedJournalId}`
    );
    if (isJournalSliderPrimary) {
      const newTopLevelBasedOnRestrictionOrRoot =
        restrictedJournalId || ROOT_JOURNAL_ID;

      // Use functional update to access the most current selectedTopLevelJournalId
      // and avoid an unnecessary update if the ID is already correct.
      setSelectedTopLevelJournalId((currentActualSelectedTopLevel) => {
        if (
          currentActualSelectedTopLevel !== newTopLevelBasedOnRestrictionOrRoot
        ) {
          console.log(
            `[useJournalManager] useEffect[restricted, primary]: Resetting top level from ${currentActualSelectedTopLevel} to ${newTopLevelBasedOnRestrictionOrRoot}. Also clearing L2/L3 selections.`
          );
          setSelectedLevel2JournalIds([]);
          setSelectedLevel3JournalIds([]);
          // setSelectedFlatJournalIdState(null); // Flat selection is often cleared if hierarchy becomes primary
          return newTopLevelBasedOnRestrictionOrRoot;
        }
        // If the ID is already what it should be based on restriction/primary status, no change.
        return currentActualSelectedTopLevel;
      });
    }
    // If not primary, other effects/logic might handle clearing selections or switching to flat mode.
    // The existing useEffect that listens to !isJournalSliderPrimary and selection states seems to cover this.
  }, [restrictedJournalId, isJournalSliderPrimary]); // REMOVED selectedTopLevelJournalId from dependencies

  // ... (effectiveSelectedJournalIds, isTerminalJournalActive, CRUD mutations, etc. largely remain the same)
  // The key is that they operate on `rawFullHierarchyDataForUserScope` which is already the (potentially) restricted sub-tree.
  // And `selectedTopLevelJournalId` is correctly initialized.

  const effectiveSelectedJournalIds = useMemo(() => {
    // This logic should work correctly as long as rawFullHierarchyDataForUserScope and selected IDs are right
    if (!isJournalSliderPrimary) return [];
    const effectiveIds = new Set<string>();

    const getSourceForL2s = () => {
      // If selectedTopLevelJournalId is the restricted ID (e.g. "51"), findNodeById will get it from rawFullHierarchyDataForUserScope
      // and its children will be correctly used.
      // If selectedTopLevelJournalId is ROOT_JOURNAL_ID (unrestricted view), rawFullHierarchyDataForUserScope is the full list of L1s.
      if (
        selectedTopLevelJournalId === ROOT_JOURNAL_ID &&
        (!restrictedJournalId || restrictedJournalId === ROOT_JOURNAL_ID)
      ) {
        // Check if we are truly at root
        return rawFullHierarchyDataForUserScope; // These are the actual L1s
      }
      const l1Node = findNodeById(
        rawFullHierarchyDataForUserScope,
        selectedTopLevelJournalId
      );
      return l1Node?.children || [];
    };
    const sourceForL2s = getSourceForL2s();

    selectedLevel3JournalIds.forEach((l3Id) => effectiveIds.add(l3Id));

    selectedLevel2JournalIds.forEach((l2Id) => {
      const l2Node = findNodeById(sourceForL2s, l2Id);
      if (l2Node) {
        const anyOfItsL3ChildrenSelected = (l2Node.children || []).some(
          (l3Child) => selectedLevel3JournalIds.includes(l3Child.id)
        );
        if (!anyOfItsL3ChildrenSelected) effectiveIds.add(l2Id);
      }
    });

    // If nothing is selected at L2/L3, then L1 itself is effective,
    // but only if L1 is not the ROOT_JOURNAL_ID (unless ROOT_JOURNAL_ID is the restricted one, edge case).
    // Or if L1 is the restrictedJournalId and it's terminal.
    if (
      effectiveIds.size === 0 &&
      selectedTopLevelJournalId &&
      selectedTopLevelJournalId !== ROOT_JOURNAL_ID
    ) {
      const l1Node = findNodeById(
        rawFullHierarchyDataForUserScope,
        selectedTopLevelJournalId
      );
      if (
        l1Node &&
        ((l1Node.children || []).length === 0 ||
          selectedLevel2JournalIds.length === 0)
      ) {
        effectiveIds.add(selectedTopLevelJournalId);
      }
    } else if (
      effectiveIds.size === 0 &&
      selectedTopLevelJournalId &&
      selectedTopLevelJournalId === ROOT_JOURNAL_ID &&
      restrictedJournalId &&
      restrictedJournalId === ROOT_JOURNAL_ID
    ) {
      // Handles a rare case where ROOT_JOURNAL_ID itself is the restriction point.
      const rootNode = findNodeById(
        rawFullHierarchyDataForUserScope,
        ROOT_JOURNAL_ID
      );
      if (
        rootNode &&
        ((rootNode.children || []).length === 0 ||
          selectedLevel2JournalIds.length === 0)
      ) {
        effectiveIds.add(ROOT_JOURNAL_ID);
      }
    }
    return Array.from(effectiveIds);
  }, [
    isJournalSliderPrimary,
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    rawFullHierarchyDataForUserScope,
    restrictedJournalId, // Added dependency
  ]);

  const isTerminalJournalActive = useMemo(() => {
    // This logic also depends on the correctness of rawFullHierarchyDataForUserScope and selected IDs
    if (
      !isJournalSliderPrimary ||
      !rawFullHierarchyDataForUserScope ||
      rawFullHierarchyDataForUserScope.length === 0
    )
      return false;

    let terminalNodeIdToCheck: string | null = null;
    let nodeSourceForFind = rawFullHierarchyDataForUserScope; // Start with the full (potentially restricted) hierarchy

    if (selectedLevel3JournalIds.length > 0) {
      terminalNodeIdToCheck = selectedLevel3JournalIds[0];
      // To find L3, we need its L2 parent from selectedLevel2JournalIds, and L2's L1 parent (selectedTopLevelJournalId)
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
      // nodeSourceForFind remains rawFullHierarchyDataForUserScope as we are checking a top-level item
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
    restrictedJournalId, // Added dependency
  ]);

  const createJournalMutation = useMutation({
    mutationFn: (data: ServerCreateJournalData) =>
      serverCreateJournalEntry(data),
    onSuccess: (newJournal) => {
      // Invalidate with the specific restrictedJournalId if it's set, otherwise general invalidation
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
        setSelectedTopLevelJournalId(actualRootForReset); // Reset to restricted root or actual root
        setSelectedLevel2JournalIds([]);
        setSelectedLevel3JournalIds([]);
      } else if (selectedLevel2JournalIds.includes(deletedJournalId)) {
        setSelectedLevel2JournalIds((ids) =>
          ids.filter((id) => id !== deletedJournalId)
        );
        // findNodeById needs the correct hierarchy to search in.
        // rawFullHierarchyDataForUserScope is the full (potentially restricted) tree.
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
      // When resetting, the top level should become the restrictedJournalId if set, otherwise the true ROOT_JOURNAL_ID.
      setSelectedTopLevelJournalId(restrictedJournalId || ROOT_JOURNAL_ID);
      setSelectedLevel2JournalIds([]);
      setSelectedLevel3JournalIds([]);
      setSelectedFlatJournalIdState(null);
      if (!options?.keepRootFilter) {
        setJournalRootFilterStatusState("affected");
      }
    },
    [restrictedJournalId] // Add dependency
  );

  const handleSelectTopLevelJournal = useCallback(
    (
      newTopLevelId: string,
      _currentHierarchyData?: AccountNodeData[], // Mark as unused if not needed
      childToSelectInL2: string | null = null
    ) => {
      // This function is called by the slider, e.g., when L1 context is double-clicked to go "up".
      // It should respect the restrictedJournalId as the ultimate ceiling.
      // However, the slider itself (JournalHierarchySlider) will be modified to prevent calling this
      // in a way that would go above restrictedJournalId.
      // So, this function can assume newTopLevelId is valid.
      setSelectedTopLevelJournalId(newTopLevelId);
      setSelectedLevel2JournalIds(childToSelectInL2 ? [childToSelectInL2] : []);
      setSelectedLevel3JournalIds([]);
      setSelectedFlatJournalIdState(null);
    },
    [] // No relevant dependencies here, relies on args
  );

  const handleToggleLevel2JournalId = useCallback(
    (level2IdToToggle: string, _currentHierarchyData?: AccountNodeData[]) => {
      const getSourceL2 = () => {
        // If selectedTopLevelJournalId is restricted, findNodeById gets it from rawFullHierarchyDataForUserScope.
        // If selectedTopLevelJournalId is ROOT_JOURNAL_ID (unrestricted), rawFullHierarchyDataForUserScope is the list of L1s.
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
    ] // Added dependencies
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

  // Double click handlers:
  // These use `findNodeWithPath` with `currentFullHierarchy` which will be `rawFullHierarchyDataForUserScope`.
  // This means all path finding is already within the restricted sub-tree if a restriction is active.
  // The logic for "going up" needs to ensure it doesn't try to go above the restricted root.

  const handleL2DoubleClick = useCallback(
    (
      l2ItemId: string,
      isL2Selected: boolean,
      currentFullHierarchy: AccountNodeData[] // This is rawFullHierarchyDataForUserScope from the hook's scope
    ) => {
      // currentFullHierarchy is rawFullHierarchyDataForUserScope, already restricted if applicable.
      // Promoting L2 to L1 view: setSelectedTopLevelJournalId(l2ItemId) is fine, stays within sub-tree.
      // Going back a level:
      //   `const { node: currentL1Node, l1ParentId: grandParentL1Id } = findNodeWithPath(selectedTopLevelJournalId, currentFullHierarchy);`
      //   If `selectedTopLevelJournalId` is the `restrictedJournalId`, then `grandParentL1Id` will be undefined
      //   because `restrictedJournalId` is the root of `currentFullHierarchy`.
      //   Then `setSelectedTopLevelJournalId(ROOT_JOURNAL_ID)` would be called. This needs to be changed.
      //   If `selectedTopLevelJournalId` is the `restrictedJournalId`, we should not go further up.

      if (isL2Selected) {
        // Promote L2 to L1 view
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
        // Go back a level (L1 becomes L2)
        if (
          selectedTopLevelJournalId === restrictedJournalId &&
          restrictedJournalId !== ROOT_JOURNAL_ID
        ) {
          // If current L1 is the restricted root, cannot go up further
          console.log(
            `[useJournalManager] L2DoubleClick: At restricted root (${restrictedJournalId}), cannot go up.`
          );
          return;
        }
        if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
          // Already at true root
          console.log(
            "[useJournalManager] L2DoubleClick: At ROOT, cannot go up via L2 non-selected double click."
          );
          return;
        }

        const { node: currentL1Node, l1ParentId: grandParentL1Id } =
          findNodeWithPath(selectedTopLevelJournalId, currentFullHierarchy);

        if (currentL1Node) {
          // If grandParentL1Id is found, it becomes the new L1.
          // If not (i.e., currentL1Node was a child of the effective root of currentFullHierarchy),
          // then the new L1 becomes that effective root (which is restrictedJournalId or ROOT_JOURNAL_ID).
          const newL1 =
            grandParentL1Id || restrictedJournalId || ROOT_JOURNAL_ID;
          setSelectedTopLevelJournalId(newL1);
          setSelectedLevel2JournalIds([selectedTopLevelJournalId]); // Old L1 becomes selected L2
          setSelectedLevel3JournalIds([]);
        }
      }
      setSelectedFlatJournalIdState(null);
    },
    [
      selectedTopLevelJournalId,
      findNodeWithPath,
      restrictedJournalId,
      rawFullHierarchyDataForUserScope /* ensure this is stable or included */,
    ]
  );

  const handleL3DoubleClick = useCallback(
    (
      l3ItemId: string,
      isL3Selected: boolean,
      currentFullHierarchy: AccountNodeData[] // This is rawFullHierarchyDataForUserScope
    ) => {
      // Similar logic to L2 double click for "going up".
      const {
        node: l3Node,
        l1ParentId: originalL1Id,
        l2ParentId: originalL2Id,
      } = findNodeWithPath(l3ItemId, currentFullHierarchy);

      if (!l3Node || !originalL2Id) return;

      if (isL3Selected) {
        // Promote L3's context (L2 becomes L1, L3 becomes L2)
        setSelectedTopLevelJournalId(originalL2Id);
        setSelectedLevel2JournalIds([l3ItemId]);
        setSelectedLevel3JournalIds([]);
      } else {
        // Go back a level (current L1 becomes L2)
        if (
          selectedTopLevelJournalId === restrictedJournalId &&
          restrictedJournalId !== ROOT_JOURNAL_ID
        ) {
          console.log(
            `[useJournalManager] L3DoubleClick: At restricted root (${restrictedJournalId}), cannot go up.`
          );
          return;
        }
        if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
          console.log(
            "[useJournalManager] L3DoubleClick: At ROOT, cannot go up."
          );
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
    // This seems fine, navigation is downwards within the hierarchy
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

  // ... (setSelectedFlatJournalId, setJournalRootFilterStatus, modal openers/closers, CRUD ops remain mostly same)
  const setSelectedFlatJournalId = useCallback(
    (id: string | null) => {
      setSelectedFlatJournalIdState(id);
      if (id !== null) {
        setSelectedTopLevelJournalId(restrictedJournalId || ROOT_JOURNAL_ID); // Reset to restricted or actual root
        setSelectedLevel2JournalIds([]);
        setSelectedLevel3JournalIds([]);
      }
    },
    [restrictedJournalId]
  );

  const setJournalRootFilterStatus = useCallback(
    (status: "affected" | "unaffected" | "all" | null) => {
      setJournalRootFilterStatusState(status);
      if (status !== null && isJournalSliderPrimary) {
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
        id: formDataFromModal.code || formDataFromModal.id || "",
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
      deleteJournalMutation.mutate(journalId);
    },
    [deleteJournalMutation]
  );

  // Effect to manage selection state based on primary status
  useEffect(() => {
    if (!isJournalSliderPrimary) {
      // If Journal is not primary, clear hierarchical selections
      // (flat ID will be set by page.tsx via setSelectedFlatJournalId)
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
    // No specific action needed if it becomes primary, handled by other effects/init.
  }, [
    isJournalSliderPrimary,
    // selectedFlatJournalId, // Flat ID logic seems managed elsewhere when becoming primary
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    restrictedJournalId, // Add dependency
  ]);

  return {
    hierarchyData: rawFullHierarchyDataForUserScope, // Corresponds to slider's fullHierarchyData prop
    currentHierarchy: currentViewHierarchyForSlider, // Corresponds to slider's hierarchyData prop
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

    journalRootFilterStatus,
    setJournalRootFilterStatus,
  };
};
