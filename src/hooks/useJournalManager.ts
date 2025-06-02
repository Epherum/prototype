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

  const { data: hierarchyDataFromQuery } = journalHierarchyQuery; // Renamed for clarity

  const internalCurrentHierarchy = useMemo(
    () => hierarchyDataFromQuery || [],
    [hierarchyDataFromQuery]
  );

  //helper
  const findNodeWithPath = useCallback(
    (
      nodeId: string,
      currentFullHierarchy: AccountNodeData[]
    ): {
      node: AccountNodeData | null;
      l1ParentId?: string; // ID of the L1 parent (if node is L2 or L3)
      l2ParentId?: string; // ID of the L2 parent (if node is L3)
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

  // Handle double click logic
  const handleL2DoubleClick = useCallback(
    (
      l2ItemId: string,
      isL2Selected: boolean, // The selection state *of this L2 item*
      // currentHierarchyData is the *currently displayed* hierarchy in the slider (could be root or L1's children)
      // We also need the full hierarchy to find the L2's original L1 parent if we navigate "up".
      currentFullHierarchy: AccountNodeData[]
    ) => {
      console.log(
        `L2 Double Click: ID=${l2ItemId}, Selected=${isL2Selected}, CurrentL1=${selectedTopLevelJournalId}`
      );

      if (isL2Selected) {
        // L2 is selected: "Promote" L2 to L1 view.
        // The L2 item clicked becomes the new selectedTopLevelJournalId.
        // Its children (L3s) will now be displayed as L2s.
        const { node: l2Node } = findNodeWithPath(
          l2ItemId,
          currentFullHierarchy
        );
        if (l2Node) {
          // Ensure node exists
          setSelectedTopLevelJournalId(l2ItemId);
          setSelectedLevel2JournalIds([]); // Clear L2 selections as they are now L1's children
          setSelectedLevel3JournalIds([]); // Clear L3 selections
          console.log(`  Promoted L2 ${l2ItemId} to L1 view.`);
        } else {
          console.warn(
            `  L2 node ${l2ItemId} not found in full hierarchy for promotion.`
          );
        }
      } else {
        // L2 is NOT selected: "Go back a level."
        // The current L1 (selectedTopLevelJournalId) becomes an L2.
        // The parent of the current L1 becomes the new L1.
        // This only works if the current L1 is NOT the ROOT_JOURNAL_ID.
        if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
          console.log("  Cannot go back from root L1.");
          return; // Cannot go back further
        }

        // Find the parent of the current selectedTopLevelJournalId from the full hierarchy
        const { node: currentL1Node, l1ParentId: grandParentL1Id } =
          findNodeWithPath(selectedTopLevelJournalId, currentFullHierarchy);

        if (currentL1Node) {
          if (grandParentL1Id) {
            // currentL1Node has an L1 parent (it was an L2 itself)
            setSelectedTopLevelJournalId(grandParentL1Id);
            setSelectedLevel2JournalIds([selectedTopLevelJournalId]); // The old L1 is now selected as L2
            setSelectedLevel3JournalIds([]);
            console.log(
              `  Navigated up. New L1: ${grandParentL1Id}, New L2 (selected): ${selectedTopLevelJournalId}`
            );
          } else {
            // currentL1Node is a true L1 (its parent was root)
            setSelectedTopLevelJournalId(ROOT_JOURNAL_ID); // Go back to root
            setSelectedLevel2JournalIds([selectedTopLevelJournalId]); // The old L1 is now selected as L2 under root
            setSelectedLevel3JournalIds([]);
            console.log(
              `  Navigated up to ROOT. New L2 (selected): ${selectedTopLevelJournalId}`
            );
          }
        } else {
          console.warn(
            `  Current L1 node ${selectedTopLevelJournalId} not found for 'go back' navigation.`
          );
        }
      }
      setSelectedFlatJournalIdState(null);
    },
    [
      selectedTopLevelJournalId,
      setSelectedTopLevelJournalId,
      setSelectedLevel2JournalIds,
      setSelectedLevel3JournalIds,
      findNodeWithPath,
      internalCurrentHierarchy /* Add internalCurrentHierarchy if findNodeWithPath uses it by default*/,
    ]
  );

  const handleL3DoubleClick = useCallback(
    (
      l3ItemId: string,
      isL3Selected: boolean, // The selection state *of this L3 item*
      currentFullHierarchy: AccountNodeData[]
    ) => {
      console.log(`L3 Double Click: ID=${l3ItemId}, Selected=${isL3Selected}`);
      const {
        node: l3Node,
        l1ParentId: originalL1Id,
        l2ParentId: originalL2Id,
      } = findNodeWithPath(l3ItemId, currentFullHierarchy);

      if (!l3Node || !originalL2Id) {
        // L3 must exist and have an L2 parent
        console.warn(`  L3 node ${l3ItemId} or its L2 parent not found.`);
        return;
      }

      if (isL3Selected) {
        // L3 is selected: "Promote" L3's parent (originalL2Id) to L1, and L3 (l3ItemId) to L2.
        // The original L1 (originalL1Id) is now the parent of the new L1, or it's root.
        // The new L1 is originalL2Id.
        // The new L2 selected is l3ItemId.
        if (originalL1Id) {
          // originalL2Id has an L1 parent
          setSelectedTopLevelJournalId(originalL1Id); // Keep the original L1 as the top level context for the new L1
          setSelectedLevel2JournalIds([originalL2Id]); // The L3's original L2 parent becomes the selected L2
          setSelectedLevel3JournalIds([l3ItemId]); // The L3 item becomes the selected L3
          // This effectively makes L3's parent (original L2) the new "focused L1" for the view
          // Wait, the requirement is "l3 becomes in l2 and its parent becomes in l1"
          setSelectedTopLevelJournalId(originalL2Id); // L3's parent (originalL2Id) becomes the new L1
          setSelectedLevel2JournalIds([l3ItemId]); // L3 item (l3ItemId) becomes the selected L2
          setSelectedLevel3JournalIds([]); // No L3s selected in this new view
          console.log(
            `  Promoted. New L1: ${originalL2Id}, New L2 (selected): ${l3ItemId}`
          );
        } else {
          // originalL2Id was a top-level node (child of ROOT)
          setSelectedTopLevelJournalId(originalL2Id); // L3's parent (originalL2Id) becomes new L1
          setSelectedLevel2JournalIds([l3ItemId]); // L3 item (l3ItemId) becomes selected L2
          setSelectedLevel3JournalIds([]);
          console.log(
            `  Promoted (from root context). New L1: ${originalL2Id}, New L2 (selected): ${l3ItemId}`
          );
        }
      } else {
        // L3 is NOT selected: "Go back a level" (current L1 becomes L2).
        // This is the same behavior as L2 NOT selected double click.
        // The selectedTopLevelJournalId determines the current L1.
        if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
          console.log(
            "  Cannot go back from root L1 (triggered by L3 non-selected)."
          );
          return;
        }

        const {
          node: currentL1NodeInfo,
          l1ParentId: grandParentL1IdForCurrentL1,
        } = findNodeWithPath(selectedTopLevelJournalId, currentFullHierarchy);
        if (currentL1NodeInfo) {
          if (grandParentL1IdForCurrentL1) {
            // currentL1 has a parent
            setSelectedTopLevelJournalId(grandParentL1IdForCurrentL1);
            setSelectedLevel2JournalIds([selectedTopLevelJournalId]); // old L1 becomes selected L2
            setSelectedLevel3JournalIds([]); // Clear L3s
            console.log(
              `  Navigated up (from L3 non-selected). New L1: ${grandParentL1IdForCurrentL1}, New L2 (selected): ${selectedTopLevelJournalId}`
            );
          } else {
            // currentL1 is a child of ROOT
            setSelectedTopLevelJournalId(ROOT_JOURNAL_ID);
            setSelectedLevel2JournalIds([selectedTopLevelJournalId]); // old L1 becomes selected L2
            setSelectedLevel3JournalIds([]);
            console.log(
              `  Navigated up to ROOT (from L3 non-selected). New L2 (selected): ${selectedTopLevelJournalId}`
            );
          }
        } else {
          console.warn(
            ` Current L1 node ${selectedTopLevelJournalId} not found for 'go back' (L3 non-selected).`
          );
        }
      }
      setSelectedFlatJournalIdState(null);
    },
    [
      selectedTopLevelJournalId,
      setSelectedTopLevelJournalId,
      setSelectedLevel2JournalIds,
      setSelectedLevel3JournalIds,
      findNodeWithPath,
      internalCurrentHierarchy /* Add internalCurrentHierarchy if findNodeWithPath uses it by default*/,
    ]
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

    handleL2DoubleClick,
    handleL3DoubleClick,

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
    handleNavigateContextDown,
    resetJournalSelections,
    setSelectedFlatJournalId,

    journalRootFilterStatus,
    setJournalRootFilterStatus,
  };
};
