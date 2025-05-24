// src/hooks/useJournalNavigation.ts
import { useState, useCallback } from "react";
import { findNodeById, findParentOfNode } from "@/lib/helpers"; // Adjust path if necessary
import { ROOT_JOURNAL_ID } from "@/lib/constants"; // Adjust path if necessary
import type { AccountNodeData } from "@/lib/types"; // Assuming AccountNodeData is defined here

export interface JournalNavigationHookProps {
  initialHierarchyData?: AccountNodeData[]; // The full account hierarchy
}

export function useJournalNavigation(props?: JournalNavigationHookProps) {
  // The hierarchy itself is passed in or fetched separately by the component using this hook.
  // This hook manages the *selected state within* that hierarchy.
  const [selectedTopLevelJournalId, setSelectedTopLevelJournalId] =
    useState<string>(ROOT_JOURNAL_ID);
  const [selectedLevel2JournalIds, setSelectedLevel2JournalIds] = useState<
    string[]
  >([]);
  const [selectedLevel3JournalIds, setSelectedLevel3JournalIds] = useState<
    string[]
  >([]);

  // The `hierarchyData` will be passed from the component that uses this hook,
  // typically from a TanStack Query result for fetching journals.
  // For now, it can be passed from the local mock data in Home.tsx.

  const handleSelectTopLevelJournal = useCallback(
    (
      newTopLevelId: string,
      hierarchyData: AccountNodeData[],
      childToSelectInL2: string | null = null
    ) => {
      if (!newTopLevelId && newTopLevelId !== ROOT_JOURNAL_ID) {
        console.error(
          "useJournalNavigation: handleSelectTopLevelJournal called with invalid newTopLevelId:",
          newTopLevelId
        );
        return;
      }
      if (
        newTopLevelId !== ROOT_JOURNAL_ID &&
        !findNodeById(hierarchyData, newTopLevelId)
      ) {
        console.error(
          "useJournalNavigation: Selected Top-Level ID not found in hierarchy:",
          newTopLevelId
        );
        return;
      }

      setSelectedTopLevelJournalId(newTopLevelId);

      if (childToSelectInL2) {
        let l2SourceNodesForValidation: AccountNodeData[];
        if (newTopLevelId === ROOT_JOURNAL_ID) {
          l2SourceNodesForValidation = hierarchyData || [];
        } else {
          const topNode = findNodeById(hierarchyData, newTopLevelId);
          l2SourceNodesForValidation = topNode?.children || [];
        }

        if (
          l2SourceNodesForValidation.some(
            (node) => node.id === childToSelectInL2
          )
        ) {
          setSelectedLevel2JournalIds([childToSelectInL2]);
        } else {
          setSelectedLevel2JournalIds([]);
        }
      } else {
        setSelectedLevel2JournalIds([]);
      }
      setSelectedLevel3JournalIds([]);
    },
    [] // No dependencies on internal state, relies on passed `hierarchyData`
  );

  const handleToggleLevel2JournalId = useCallback(
    (level2IdToToggle: string, hierarchyData: AccountNodeData[]) => {
      let l2SourceNodes: AccountNodeData[];
      let currentL1NodeForContext:
        | AccountNodeData
        | { id: string; children: AccountNodeData[] }
        | null;

      if (!hierarchyData) return;

      if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
        l2SourceNodes = hierarchyData;
        currentL1NodeForContext = {
          id: ROOT_JOURNAL_ID,
          children: hierarchyData,
        };
      } else {
        currentL1NodeForContext = findNodeById(
          hierarchyData,
          selectedTopLevelJournalId
        );
        if (!currentL1NodeForContext) return;
        l2SourceNodes =
          (currentL1NodeForContext as AccountNodeData).children || [];
      }

      if (!l2SourceNodes.some((node) => node.id === level2IdToToggle)) return;

      const newSelectedL2Ids = selectedLevel2JournalIds.includes(
        level2IdToToggle
      )
        ? selectedLevel2JournalIds.filter((id) => id !== level2IdToToggle)
        : [...selectedLevel2JournalIds, level2IdToToggle];

      setSelectedLevel2JournalIds(newSelectedL2Ids);

      setSelectedLevel3JournalIds((prevSelectedL3Ids) => {
        if (newSelectedL2Ids.length === 0) return [];
        const validL3s: string[] = [];
        const l1ChildrenSource =
          (currentL1NodeForContext as AccountNodeData)?.children ||
          (selectedTopLevelJournalId === ROOT_JOURNAL_ID ? hierarchyData : []);

        for (const l3Id of prevSelectedL3Ids) {
          let l3StillValid = false;
          for (const newL2Id of newSelectedL2Ids) {
            const newL2Node = findNodeById(l1ChildrenSource, newL2Id);
            if (newL2Node?.children?.some((l3Child) => l3Child.id === l3Id)) {
              l3StillValid = true;
              break;
            }
          }
          if (l3StillValid) validL3s.push(l3Id);
        }
        return validL3s;
      });
    },
    [selectedTopLevelJournalId, selectedLevel2JournalIds] // Depends on current selection state
  );

  const handleToggleLevel3JournalId = useCallback(
    (level3IdToToggle: string, hierarchyData: AccountNodeData[]) => {
      let l3IsValid = false;
      if (!hierarchyData) return;

      const l1NodeForContext =
        selectedTopLevelJournalId === ROOT_JOURNAL_ID
          ? { id: ROOT_JOURNAL_ID, children: hierarchyData }
          : findNodeById(hierarchyData, selectedTopLevelJournalId);

      if (l1NodeForContext) {
        const l1ChildrenSource =
          (l1NodeForContext as AccountNodeData).children ||
          (selectedTopLevelJournalId === ROOT_JOURNAL_ID ? hierarchyData : []);
        for (const l2Id of selectedLevel2JournalIds) {
          const l2Node = findNodeById(l1ChildrenSource, l2Id);
          if (l2Node?.children?.some((l3) => l3.id === level3IdToToggle)) {
            l3IsValid = true;
            break;
          }
        }
      }

      if (!l3IsValid) return;

      setSelectedLevel3JournalIds((prevSelectedL3Ids) =>
        prevSelectedL3Ids.includes(level3IdToToggle)
          ? prevSelectedL3Ids.filter((id) => id !== level3IdToToggle)
          : [...prevSelectedL3Ids, level3IdToToggle]
      );
    },
    [selectedTopLevelJournalId, selectedLevel2JournalIds] // Depends on current selection state
  );

  const handleNavigateContextDown = useCallback(
    (
      args: { currentL1ToBecomeL2: string; longPressedL2ToBecomeL3?: string },
      hierarchyData: AccountNodeData[]
    ) => {
      const { currentL1ToBecomeL2 } = args;
      let newL1ContextId: string;
      const parentOfOldL1 = findParentOfNode(
        currentL1ToBecomeL2,
        hierarchyData
      );
      newL1ContextId = parentOfOldL1 ? parentOfOldL1.id : ROOT_JOURNAL_ID;

      setSelectedTopLevelJournalId(newL1ContextId);
      setSelectedLevel2JournalIds([currentL1ToBecomeL2]);
      setSelectedLevel3JournalIds([]);
    },
    [] // Relies on passed hierarchyData
  );

  const handleNavigateFromL3Up = useCallback(
    ({ l3ItemId }: { l3ItemId: string }, hierarchyData: AccountNodeData[]) => {
      if (!hierarchyData) return;

      if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
        let actualL1ParentOfL3: AccountNodeData | null = null;
        for (const actualL1Id of selectedLevel2JournalIds) {
          const actualL1Node = findNodeById(hierarchyData, actualL1Id);
          if (
            actualL1Node?.children?.some(
              (childL2Node) => childL2Node.id === l3ItemId
            )
          ) {
            actualL1ParentOfL3 = actualL1Node;
            break;
          }
        }
        if (!actualL1ParentOfL3) {
          const parentCandidate = findParentOfNode(l3ItemId, hierarchyData);
          if (parentCandidate && parentCandidate.id !== ROOT_JOURNAL_ID) {
            actualL1ParentOfL3 = parentCandidate;
          } else {
            return;
          }
        }
        const newL1Id = actualL1ParentOfL3.id;
        const newL2toSelect = l3ItemId;
        setSelectedTopLevelJournalId(newL1Id);
        setSelectedLevel2JournalIds([newL2toSelect]);
        setSelectedLevel3JournalIds([]);
      } else {
        let l2ParentOfClickedL3: AccountNodeData | null = null;
        const currentL1Node = findNodeById(
          hierarchyData,
          selectedTopLevelJournalId
        );
        if (!currentL1Node?.children) return;
        for (const l2Id of selectedLevel2JournalIds) {
          const l2Node = findNodeById(currentL1Node.children, l2Id);
          if (l2Node?.children?.some((l3) => l3.id === l3ItemId)) {
            l2ParentOfClickedL3 = l2Node;
            break;
          }
        }
        if (!l2ParentOfClickedL3) return;
        const newL1Id = l2ParentOfClickedL3.id;
        const newL2toSelect = l3ItemId;
        setSelectedTopLevelJournalId(newL1Id);
        setSelectedLevel2JournalIds([newL2toSelect]);
        setSelectedLevel3JournalIds([]);
      }
    },
    [selectedTopLevelJournalId, selectedLevel2JournalIds] // Depends on current selection
  );

  const handleNavigateFromL3Down = useCallback(
    ({ l3ItemId }: { l3ItemId: string }, hierarchyData: AccountNodeData[]) => {
      if (!hierarchyData) return;

      if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
        const l1ParentOfL3Item = findParentOfNode(l3ItemId, hierarchyData);
        if (l1ParentOfL3Item && l1ParentOfL3Item.id !== ROOT_JOURNAL_ID) {
          setSelectedTopLevelJournalId(l1ParentOfL3Item.id);
          setSelectedLevel2JournalIds([l3ItemId]);
          setSelectedLevel3JournalIds([]);
        } else {
          if (hierarchyData.some((node) => node.id === l3ItemId)) {
            setSelectedTopLevelJournalId(l3ItemId);
            setSelectedLevel2JournalIds([]);
            setSelectedLevel3JournalIds([]);
          }
        }
        return;
      }

      const parentOfCurrentL1 = findParentOfNode(
        selectedTopLevelJournalId,
        hierarchyData
      );
      const newL1ContextId = parentOfCurrentL1
        ? parentOfCurrentL1.id
        : ROOT_JOURNAL_ID;
      const oldL1ToBecomeSelectedL2 = selectedTopLevelJournalId;

      setSelectedTopLevelJournalId(newL1ContextId);
      setSelectedLevel2JournalIds([oldL1ToBecomeSelectedL2]);
      setSelectedLevel3JournalIds([]); // Simplified: always clear L3 on this type of "up" navigation
    },
    [selectedTopLevelJournalId] // Depends on current selection
  );

  const handleL3DoubleClick = useCallback(
    (
      l3ItemId: string,
      isSelected: boolean,
      hierarchyData: AccountNodeData[]
    ) => {
      if (isSelected) {
        handleNavigateFromL3Up({ l3ItemId }, hierarchyData);
      } else {
        handleNavigateFromL3Down({ l3ItemId }, hierarchyData);
      }
    },
    [handleNavigateFromL3Up, handleNavigateFromL3Down] // These internal handlers now correctly take hierarchyData
  );

  // Reset function specific to journal navigation state
  const resetJournalSelections = useCallback(() => {
    setSelectedTopLevelJournalId(ROOT_JOURNAL_ID);
    setSelectedLevel2JournalIds([]);
    setSelectedLevel3JournalIds([]);
  }, []);

  return {
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    setSelectedTopLevelJournalId, // Expose setters if direct manipulation needed from Home for reset etc.
    setSelectedLevel2JournalIds,
    setSelectedLevel3JournalIds,
    handleSelectTopLevelJournal,
    handleToggleLevel2JournalId,
    handleToggleLevel3JournalId,
    handleL3DoubleClick,
    handleNavigateContextDown,
    resetJournalSelections, // For resetting state from outside, e.g. data source change if it comes back
  };
}
