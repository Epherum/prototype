//src/features/journals/hooks/useJournalInteraction.ts
import { useState, useCallback, useRef, useEffect } from "react";
import { findNodeById, findParentOfNode } from "@/lib/helpers";
import { ROOT_JOURNAL_ID } from "@/lib/constants";
import type { AccountNodeData } from "@/lib/types";

const CYCLE_STATES = {
  RESTORE_SAVED: "RESTORE_SAVED",
  CHILDREN_VISIBLE_ALL_SELECTED: "CHILDREN_VISIBLE_ALL_SELECTED",
  CHILDREN_VISIBLE_PARENT_ONLY: "CHILDREN_VISIBLE_PARENT_ONLY", // Renamed for clarity
  CHILDREN_HIDDEN_PARENT_SELECTED: "CHILDREN_HIDDEN_PARENT_SELECTED", // Renamed for clarity
  UNSELECTED: "UNSELECTED",
} as const;
type JournalItemCycleState = (typeof CYCLE_STATES)[keyof typeof CYCLE_STATES];

interface InteractionProps {
  hierarchyData: AccountNodeData[];
  topLevelId: string;
  level2Ids: string[];
  level3Ids: string[];
  restrictedJournalId: string;
  updateJournalSelections: (
    newSelections: {
      topLevelId?: string;
      level2Ids?: string[];
      level3Ids?: string[];
    },
    visibleChildrenMap: Record<string, boolean>
  ) => void;
}

const areStringArraysEqual = (arr1: string[], arr2: string[]): boolean => {
  if (arr1.length !== arr2.length) return false;
  const set1 = new Set(arr1);
  // Optimization: check size first
  if (set1.size !== arr2.length) return false;
  for (const item of arr2) {
    if (!set1.has(item)) return false;
  }
  return true;
};

export const useJournalInteraction = ({
  hierarchyData,
  topLevelId,
  level2Ids,
  level3Ids,
  restrictedJournalId,
  updateJournalSelections,
}: InteractionProps) => {
  const [visibleChildrenMap, setVisibleChildrenMap] = useState<
    Record<string, boolean>
  >({});
  const savedSelectionsRef = useRef<Record<string, string[]>>({});
  const savedTopLevelSelectionsRef = useRef<
    Record<string, { level2Ids: string[]; level3Ids: string[] }>
  >({});
  const [hasSavedState, setHasSavedState] = useState(false);
  const l1ClickInteractionRef = useRef<{
    id: string | null;
    timeout: NodeJS.Timeout | null;
  }>({ id: null, timeout: null });
  const l2ClickInteractionRef = useRef<{
    id: string | null;
    timeout: NodeJS.Timeout | null;
  }>({ id: null, timeout: null });
  // This ref now stores the *last executed state* for an item.
  const l1ClickCycleState = useRef<Record<string, JournalItemCycleState>>({});

  // ... (All other functions up to the handlers remain the same)
  useEffect(() => {
    const savedStateForCurrentView =
      savedTopLevelSelectionsRef.current[topLevelId];
    if (savedStateForCurrentView) {
      const { level2Ids, level3Ids } = savedStateForCurrentView;
      setHasSavedState(level2Ids.length > 0 || level3Ids.length > 0);
    } else {
      setHasSavedState(false);
    }
  }, [topLevelId]);

  const _saveTopLevelSnapshot = useCallback(
    (l2s: string[], l3s: string[]) => {
      const currentTopLevelNode =
        topLevelId === ROOT_JOURNAL_ID
          ? { id: ROOT_JOURNAL_ID, children: hierarchyData }
          : findNodeById(hierarchyData, topLevelId);
      if (!currentTopLevelNode?.children) return;
      const visibleL1Ids = new Set(
        currentTopLevelNode.children.map((node) => node.id)
      );
      const relevantL2Ids = l2s.filter((id) => visibleL1Ids.has(id));
      const allVisibleGrandchildrenIds = new Set(
        currentTopLevelNode.children.flatMap(
          (l1Child) =>
            l1Child.children?.map((l2Grandchild) => l2Grandchild.id) || []
        )
      );
      const relevantL3Ids = l3s.filter((id) =>
        allVisibleGrandchildrenIds.has(id)
      );
      savedTopLevelSelectionsRef.current[topLevelId] = {
        level2Ids: relevantL2Ids,
        level3Ids: relevantL3Ids,
      };
      setHasSavedState(relevantL2Ids.length > 0 || relevantL3Ids.length > 0);
    },
    [hierarchyData, topLevelId]
  );

  const handleSelectTopLevelJournal = useCallback(
    (newTopLevelId: string, childToSelectInL2: string | null = null) => {
      l1ClickCycleState.current = {};
      const savedStateForNewView =
        savedTopLevelSelectionsRef.current[newTopLevelId];

      if (savedStateForNewView) {
        const { level2Ids: newL2Ids, level3Ids: newL3Ids } =
          savedStateForNewView;
        const newVisibleMap: Record<string, boolean> = {};
        const parentsOfSelectedChildren = new Set<string>();
        const allL3Parents = newL3Ids
          .map((id) => findParentOfNode(id, hierarchyData)?.id)
          .filter(Boolean) as string[];
        allL3Parents.forEach((parentId) =>
          parentsOfSelectedChildren.add(parentId)
        );

        newL2Ids.forEach((id) => {
          const node = findNodeById(hierarchyData, id);
          if (node?.children?.length) {
            parentsOfSelectedChildren.add(id);
          }
        });

        parentsOfSelectedChildren.forEach((id) => (newVisibleMap[id] = true));

        setVisibleChildrenMap(newVisibleMap);
        updateJournalSelections(
          {
            topLevelId: newTopLevelId,
            level2Ids: newL2Ids,
            level3Ids: newL3Ids,
          },
          newVisibleMap
        );
      } else {
        const newL2Ids = childToSelectInL2 ? [childToSelectInL2] : [];
        const newVisibleMap = childToSelectInL2
          ? { [childToSelectInL2]: true }
          : {};
        setVisibleChildrenMap(newVisibleMap);
        updateJournalSelections(
          { topLevelId: newTopLevelId, level2Ids: newL2Ids, level3Ids: [] },
          newVisibleMap
        );
      }
    },
    [updateJournalSelections, hierarchyData]
  );

  const handleNavigateUpOneLevel = useCallback(() => {
    const effectiveRootId = restrictedJournalId || ROOT_JOURNAL_ID;
    if (!topLevelId || topLevelId === effectiveRootId) return;

    const parent = findParentOfNode(topLevelId, hierarchyData);
    const newTopLevelId = parent ? parent.id : effectiveRootId;
    handleSelectTopLevelJournal(newTopLevelId, topLevelId);
  }, [
    hierarchyData,
    topLevelId,
    restrictedJournalId,
    handleSelectTopLevelJournal,
  ]);

  const handleRestoreLastSelection = useCallback(() => {
    // Reset L1 item cycle states on any top-level action.
    l1ClickCycleState.current = {};

    const savedStateForCurrentView =
      savedTopLevelSelectionsRef.current[topLevelId];
    if (!savedStateForCurrentView) return;

    const { level2Ids: newL2Ids, level3Ids: newL3Ids } =
      savedStateForCurrentView;

    const topLevelNode =
      topLevelId === ROOT_JOURNAL_ID
        ? { id: ROOT_JOURNAL_ID, children: hierarchyData }
        : findNodeById(hierarchyData, topLevelId);

    if (!topLevelNode) return;

    const newVisibleMap: Record<string, boolean> = {};
    const parentsToMakeVisible = new Set<string>();

    // 1. Find parents of any selected L2 children.
    const parentsOfSelectedL3s = newL3Ids
      .map((id) => findParentOfNode(id, hierarchyData)?.id)
      .filter(Boolean) as string[];
    parentsOfSelectedL3s.forEach((parentId) =>
      parentsToMakeVisible.add(parentId)
    );

    // 2. ALSO, find any selected L1 parents from the saved state that have children
    //    and mark them for visibility, regardless of their children's selection.
    //    This is the key to fixing the bug and the line that had the type error.
    const l1NodesById = new Map<string, AccountNodeData>(
      topLevelNode.children?.map((node) => [node.id, node]) || []
    );
    newL2Ids.forEach((l1Id) => {
      const node = l1NodesById.get(l1Id);
      // Now 'node' is correctly typed as AccountNodeData | undefined
      if (node && node.children && node.children.length > 0) {
        parentsToMakeVisible.add(l1Id);
      }
    });

    // Now, build the final visibility map from the comprehensive set.
    parentsToMakeVisible.forEach((id) => {
      newVisibleMap[id] = true;
    });

    setVisibleChildrenMap(newVisibleMap);
    updateJournalSelections(
      { level2Ids: newL2Ids, level3Ids: newL3Ids },
      newVisibleMap
    );
  }, [topLevelId, hierarchyData, updateJournalSelections]);
  const handleSelectAllVisible = useCallback(() => {
    l1ClickCycleState.current = {};
    const topLevelNode =
      topLevelId === ROOT_JOURNAL_ID
        ? { id: ROOT_JOURNAL_ID, children: hierarchyData }
        : findNodeById(hierarchyData, topLevelId);
    if (!topLevelNode?.children) return;
    const newL2Ids = topLevelNode.children.map((c) => c.id);
    const newL3Ids = topLevelNode.children.flatMap(
      (c) => c.children?.map((gc) => gc.id) || []
    );
    const newVisibleMap: Record<string, boolean> = {};
    newL2Ids.forEach((id) => (newVisibleMap[id] = true));
    setVisibleChildrenMap(newVisibleMap);
    updateJournalSelections(
      { level2Ids: newL2Ids, level3Ids: newL3Ids },
      newVisibleMap
    );
  }, [hierarchyData, topLevelId, updateJournalSelections]);

  const handleSelectParentsOnly = useCallback(() => {
    l1ClickCycleState.current = {};
    const topLevelNode =
      topLevelId === ROOT_JOURNAL_ID
        ? { id: ROOT_JOURNAL_ID, children: hierarchyData }
        : findNodeById(hierarchyData, topLevelId);
    if (!topLevelNode?.children) return;
    const newL2Ids = topLevelNode.children.map((c) => c.id);
    const newVisibleMap: Record<string, boolean> = {};
    newL2Ids.forEach((id) => (newVisibleMap[id] = true));
    setVisibleChildrenMap(newVisibleMap);
    updateJournalSelections(
      { level2Ids: newL2Ids, level3Ids: [] },
      newVisibleMap
    );
  }, [hierarchyData, topLevelId, updateJournalSelections]);

  const handleClearAllSelections = useCallback(() => {
    l1ClickCycleState.current = {};
    const newVisibleMap: Record<string, boolean> = {};
    setVisibleChildrenMap(newVisibleMap);
    updateJournalSelections({ level2Ids: [], level3Ids: [] }, newVisibleMap);
  }, [updateJournalSelections]);

  /**
   * Calculates the next logical state for an L1 item's click cycle,
   * intelligently skipping any steps that would result in no change
   * to the current UI. This prevents "dead clicks".
   *
   * @param l1Node - The data node for the L1 item being interacted with.
   * @param lastExecutedState - The previous state from the cycle for this item.
   * @returns The next state in the cycle that will cause a UI change.
   */
  const _calculateNextL1CycleState = useCallback(
    (
      l1Node: AccountNodeData,
      lastExecutedState: JournalItemCycleState | undefined
    ): JournalItemCycleState => {
      const l1ItemId = l1Node.id;
      const childrenIds = l1Node.children?.map((c) => c.id) || [];
      const hasSavedSelection = !!savedSelectionsRef.current[l1ItemId];

      // Define the complete, ordered cycle.
      const potentialCycle: JournalItemCycleState[] = [];
      if (hasSavedSelection) {
        potentialCycle.push(CYCLE_STATES.RESTORE_SAVED);
      }
      potentialCycle.push(
        CYCLE_STATES.CHILDREN_VISIBLE_ALL_SELECTED,
        CYCLE_STATES.CHILDREN_VISIBLE_PARENT_ONLY,
        CYCLE_STATES.CHILDREN_HIDDEN_PARENT_SELECTED,
        CYCLE_STATES.UNSELECTED
      );

      // Find where we are in the cycle. If no state is recorded, we start before the first step.
      const lastStateIndex = lastExecutedState
        ? potentialCycle.indexOf(lastExecutedState)
        : -1;

      // Iterate through the cycle, starting from the step AFTER the last one.
      for (let i = 1; i <= potentialCycle.length; i++) {
        const nextStateIndex = (lastStateIndex + i) % potentialCycle.length;
        const nextState = potentialCycle[nextStateIndex];

        // Get current state attributes for comparison
        const isParentCurrentlySelected = level2Ids.includes(l1ItemId);
        const areChildrenCurrentlyVisible = !!visibleChildrenMap[l1ItemId];
        const currentSelectedChildren = level3Ids.filter((id) =>
          childrenIds.includes(id)
        );

        // Check if the `nextState` is DIFFERENT from the current state.
        switch (nextState) {
          case CYCLE_STATES.RESTORE_SAVED:
            const saved = savedSelectionsRef.current[l1ItemId] || [];
            if (
              !isParentCurrentlySelected ||
              !areChildrenCurrentlyVisible ||
              !areStringArraysEqual(currentSelectedChildren, saved)
            ) {
              return nextState; // State is different, so execute this step.
            }
            break; // State is the same, continue loop to check next cycle step.

          case CYCLE_STATES.CHILDREN_VISIBLE_ALL_SELECTED:
            if (
              !isParentCurrentlySelected ||
              !areChildrenCurrentlyVisible ||
              !areStringArraysEqual(currentSelectedChildren, childrenIds)
            ) {
              return nextState;
            }
            break;

          case CYCLE_STATES.CHILDREN_VISIBLE_PARENT_ONLY:
            if (
              !isParentCurrentlySelected ||
              !areChildrenCurrentlyVisible ||
              currentSelectedChildren.length !== 0
            ) {
              return nextState;
            }
            break;

          case CYCLE_STATES.CHILDREN_HIDDEN_PARENT_SELECTED:
            // This state only cares about parent selection and visibility
            if (!isParentCurrentlySelected || areChildrenCurrentlyVisible) {
              return nextState;
            }
            break;

          case CYCLE_STATES.UNSELECTED:
            if (isParentCurrentlySelected) {
              // Only selection matters here. Children will be deselected and hidden.
              return nextState;
            }
            break;
        }
      }

      // Fallback: if all states match the current state (highly unlikely),
      // default to unselected.
      return CYCLE_STATES.UNSELECTED;
    },
    [level2Ids, level3Ids, visibleChildrenMap, savedSelectionsRef]
  );

  const handleL1Interaction = useCallback(
    (l1ItemId: string) => {
      // --- Start of single/double click detection logic ---
      if (l1ClickInteractionRef.current.timeout) {
        clearTimeout(l1ClickInteractionRef.current.timeout);
      }
      if (l1ClickInteractionRef.current.id === l1ItemId) {
        // Double click detected
        delete savedSelectionsRef.current[l1ItemId];
        handleSelectTopLevelJournal(l1ItemId);
        l1ClickInteractionRef.current = { id: null, timeout: null };
        return;
      }
      // --- End of single/double click detection logic ---

      const newTimeout = setTimeout(() => {
        // --- Single click logic starts here ---
        const l1Node = findNodeById(hierarchyData, l1ItemId);
        if (!l1Node) return;

        // Case 1: Terminal node (no children) - simple toggle
        if (!l1Node.children || l1Node.children.length === 0) {
          const newL2Ids = level2Ids.includes(l1ItemId)
            ? level2Ids.filter((id) => id !== l1ItemId)
            : [...level2Ids, l1ItemId];
          _saveTopLevelSnapshot(newL2Ids, level3Ids);
          updateJournalSelections({ level2Ids: newL2Ids }, visibleChildrenMap);
          l1ClickInteractionRef.current = { id: null, timeout: null };
          return;
        }

        // Case 2: Parent node (with children) - use the cycle logic
        const lastExecutedState = l1ClickCycleState.current[l1ItemId];

        // UPDATED: All complex "what's next?" logic is now in the helper.
        const nextState = _calculateNextL1CycleState(l1Node, lastExecutedState);

        // Store the state we are about to execute.
        l1ClickCycleState.current[l1ItemId] = nextState;

        // Apply the determined nextState
        let newL2Ids = [...level2Ids];
        let newL3Ids = level3Ids.filter(
          (id) => !l1Node.children!.some((c) => c.id === id)
        );
        let newVisibleMap = { ...visibleChildrenMap };
        const childrenIds = l1Node.children.map((c) => c.id);

        switch (nextState) {
          case CYCLE_STATES.RESTORE_SAVED:
            if (!newL2Ids.includes(l1ItemId)) newL2Ids.push(l1ItemId);
            newL3Ids.push(...(savedSelectionsRef.current[l1ItemId] || []));
            newVisibleMap[l1ItemId] = true;
            break;
          case CYCLE_STATES.CHILDREN_VISIBLE_ALL_SELECTED:
            if (!newL2Ids.includes(l1ItemId)) newL2Ids.push(l1ItemId);
            newL3Ids.push(...childrenIds);
            newVisibleMap[l1ItemId] = true;
            break;
          case CYCLE_STATES.CHILDREN_VISIBLE_PARENT_ONLY:
            if (!newL2Ids.includes(l1ItemId)) newL2Ids.push(l1ItemId);
            // newL3Ids is already filtered
            newVisibleMap[l1ItemId] = true;
            break;
          case CYCLE_STATES.CHILDREN_HIDDEN_PARENT_SELECTED:
            if (!newL2Ids.includes(l1ItemId)) newL2Ids.push(l1ItemId);
            // newL3Ids is already filtered
            newVisibleMap[l1ItemId] = false;
            break;
          case CYCLE_STATES.UNSELECTED:
            newL2Ids = newL2Ids.filter((id) => id !== l1ItemId);
            // newL3Ids is already filtered
            newVisibleMap[l1ItemId] = false;
            break;
        }

        setVisibleChildrenMap(newVisibleMap);
        _saveTopLevelSnapshot(newL2Ids, newL3Ids);
        updateJournalSelections(
          { level2Ids: newL2Ids, level3Ids: newL3Ids },
          newVisibleMap
        );
        l1ClickInteractionRef.current = { id: null, timeout: null };
      }, 200);

      l1ClickInteractionRef.current = { id: l1ItemId, timeout: newTimeout };
    },
    [
      hierarchyData,
      level2Ids,
      level3Ids,
      visibleChildrenMap,
      handleSelectTopLevelJournal,
      updateJournalSelections,
      _saveTopLevelSnapshot,
      _calculateNextL1CycleState, // Add new helper to dependency array
    ]
  );

  const handleL2SingleClickToggle = useCallback(
    (l2ItemId: string) => {
      const isSelected = level3Ids.includes(l2ItemId);
      const newL3s = isSelected
        ? level3Ids.filter((id) => id !== l2ItemId)
        : [...level3Ids, l2ItemId];
      const parentL1 = findParentOfNode(l2ItemId, hierarchyData);
      if (parentL1) {
        const parentChildrenIds = new Set(
          parentL1.children?.map((c) => c.id) || []
        );
        const newCustomSelectionForParent = newL3s.filter((id) =>
          parentChildrenIds.has(id)
        );
        savedSelectionsRef.current[parentL1.id] = newCustomSelectionForParent;
        l1ClickCycleState.current[parentL1.id] = CYCLE_STATES.RESTORE_SAVED;
      }
      _saveTopLevelSnapshot(level2Ids, newL3s);
      updateJournalSelections({ level3Ids: newL3s }, visibleChildrenMap);
    },
    [
      level3Ids,
      hierarchyData,
      updateJournalSelections,
      visibleChildrenMap,
      _saveTopLevelSnapshot,
      level2Ids,
    ]
  );
  const handleL2Interaction = useCallback(
    (l2ItemId: string) => {
      if (l2ClickInteractionRef.current.timeout)
        clearTimeout(l2ClickInteractionRef.current.timeout);
      if (l2ClickInteractionRef.current.id === l2ItemId) {
        const parent = findParentOfNode(l2ItemId, hierarchyData);
        if (parent) {
          delete savedSelectionsRef.current[parent.id];
          handleSelectTopLevelJournal(parent.id, l2ItemId);
        }
        l2ClickInteractionRef.current = { id: null, timeout: null };
        return;
      }
      const newTimeout = setTimeout(() => {
        handleL2SingleClickToggle(l2ItemId);
        l2ClickInteractionRef.current.id = null;
        l2ClickInteractionRef.current.timeout = null;
      }, 200);
      l2ClickInteractionRef.current = { id: l2ItemId, timeout: newTimeout };
    },
    [hierarchyData, handleSelectTopLevelJournal, handleL2SingleClickToggle]
  );

  return {
    visibleChildrenMap,
    handleSelectTopLevelJournal,
    handleL1Interaction,
    handleL2Interaction,
    handleNavigateUpOneLevel,
    handleRestoreLastSelection,
    handleSelectAllVisible,
    handleSelectParentsOnly,
    handleClearAllSelections,
    hasSavedSelection: hasSavedState,
  };
};
