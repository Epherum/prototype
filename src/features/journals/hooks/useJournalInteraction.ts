import { useState, useCallback, useRef, useEffect } from "react";
import { findNodeById, findParentOfNode } from "@/lib/helpers";
import { ROOT_JOURNAL_ID } from "@/lib/constants";
import type { AccountNodeData } from "@/lib/types";

// ... (constants, types, and helpers remain unchanged)
const CYCLE_STATES = {
  UNSELECTED: "UNSELECTED",
  RESTORE_SAVED: "RESTORE_SAVED",
  CHILDREN_VISIBLE_ALL_SELECTED: "CHILDREN_VISIBLE_ALL_SELECTED",
  CHILDREN_VISIBLE_NONE_SELECTED: "CHILDREN_VISIBLE_NONE_SELECTED",
  CHILDREN_HIDDEN: "CHILDREN_HIDDEN",
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
  if (set1.size !== arr1.length) return false;
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
  const l1ClickCycleState = useRef<Record<string, JournalItemCycleState>>({});

  // All other functions up to the handlers remain the same...
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
    /* ... unchanged ... */
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
    /* ... unchanged ... */
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

  const handleNavigateUpOneLevel = useCallback(
    /* ... unchanged ... */
    () => {
      const effectiveRootId = restrictedJournalId || ROOT_JOURNAL_ID;
      if (!topLevelId || topLevelId === effectiveRootId) return;

      const parent = findParentOfNode(topLevelId, hierarchyData);
      const newTopLevelId = parent ? parent.id : effectiveRootId;
      handleSelectTopLevelJournal(newTopLevelId, topLevelId);
    },
    [
      hierarchyData,
      topLevelId,
      restrictedJournalId,
      handleSelectTopLevelJournal,
    ]
  );

  // =========================================================
  // === THE FIX IS APPLIED IN THE NEXT 4 HANDLERS ===
  // =========================================================

  const handleRestoreLastSelection = useCallback(() => {
    // *** FIX: Reset L1 item cycle states on any top-level action. ***
    l1ClickCycleState.current = {};

    const savedStateForCurrentView =
      savedTopLevelSelectionsRef.current[topLevelId];
    if (!savedStateForCurrentView) return;

    // ... (rest of the function is unchanged)
    const { level2Ids: newL2Ids, level3Ids: newL3Ids } =
      savedStateForCurrentView;
    const newVisibleMap: Record<string, boolean> = {};
    const topLevelNode =
      topLevelId === ROOT_JOURNAL_ID
        ? { id: ROOT_JOURNAL_ID, children: hierarchyData }
        : findNodeById(hierarchyData, topLevelId);
    const parentsOfSelectedChildren = new Set<string>();
    const allL3Parents = newL3Ids
      .map((id) => findParentOfNode(id, hierarchyData)?.id)
      .filter(Boolean) as string[];
    allL3Parents.forEach((parentId) => parentsOfSelectedChildren.add(parentId));
    topLevelNode?.children?.forEach((node) => {
      if (parentsOfSelectedChildren.has(node.id)) {
        newVisibleMap[node.id] = true;
      }
    });
    setVisibleChildrenMap(newVisibleMap);
    updateJournalSelections(
      { level2Ids: newL2Ids, level3Ids: newL3Ids },
      newVisibleMap
    );
  }, [topLevelId, hierarchyData, updateJournalSelections]);

  const handleSelectAllVisible = useCallback(() => {
    // *** FIX: Reset L1 item cycle states on any top-level action. ***
    l1ClickCycleState.current = {};

    const topLevelNode =
      topLevelId === ROOT_JOURNAL_ID
        ? { id: ROOT_JOURNAL_ID, children: hierarchyData }
        : findNodeById(hierarchyData, topLevelId);
    if (!topLevelNode?.children) return;

    // ... (rest of the function is unchanged)
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
    // *** FIX: Reset L1 item cycle states on any top-level action. ***
    l1ClickCycleState.current = {};

    const topLevelNode =
      topLevelId === ROOT_JOURNAL_ID
        ? { id: ROOT_JOURNAL_ID, children: hierarchyData }
        : findNodeById(hierarchyData, topLevelId);
    if (!topLevelNode?.children) return;

    // ... (rest of the function is unchanged)
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
    // *** FIX: Reset L1 item cycle states on any top-level action. ***
    l1ClickCycleState.current = {};

    const newVisibleMap: Record<string, boolean> = {};
    setVisibleChildrenMap(newVisibleMap);
    updateJournalSelections({ level2Ids: [], level3Ids: [] }, newVisibleMap);
  }, [updateJournalSelections]);

  // The L1/L2 interaction handlers are now correct and do not need further changes.
  const handleL1Interaction = useCallback(
    /* ... unchanged ... */
    (l1ItemId: string) => {
      if (l1ClickInteractionRef.current.timeout)
        clearTimeout(l1ClickInteractionRef.current.timeout);
      if (l1ClickInteractionRef.current.id === l1ItemId) {
        delete savedSelectionsRef.current[l1ItemId];
        handleSelectTopLevelJournal(l1ItemId);
        l1ClickInteractionRef.current = { id: null, timeout: null };
        return;
      }
      const newTimeout = setTimeout(() => {
        const l1Node = findNodeById(hierarchyData, l1ItemId);
        if (!l1Node) return;

        if (!l1Node.children || l1Node.children.length === 0) {
          const newL2Ids = level2Ids.includes(l1ItemId)
            ? level2Ids.filter((id) => id !== l1ItemId)
            : [...level2Ids, l1ItemId];

          _saveTopLevelSnapshot(newL2Ids, level3Ids);
          updateJournalSelections({ level2Ids: newL2Ids }, visibleChildrenMap);
          l1ClickInteractionRef.current = { id: null, timeout: null };
          return;
        }

        const childrenIds = l1Node.children.map((c) => c.id);
        const childrenIdSet = new Set(childrenIds);
        const hasSavedSelection = !!savedSelectionsRef.current[l1ItemId];
        const currentState =
          l1ClickCycleState.current[l1ItemId] || CYCLE_STATES.UNSELECTED;
        let nextState = currentState;

        switch (currentState) {
          case CYCLE_STATES.UNSELECTED:
            const isParentSelected = level2Ids.includes(l1ItemId);
            const areAllChildrenSelected =
              childrenIds.length > 0 &&
              childrenIds.every((id) => level3Ids.includes(id));

            if (isParentSelected && areAllChildrenSelected) {
              nextState = CYCLE_STATES.CHILDREN_VISIBLE_NONE_SELECTED;
            } else if (hasSavedSelection) {
              nextState = CYCLE_STATES.RESTORE_SAVED;
            } else {
              nextState = CYCLE_STATES.CHILDREN_VISIBLE_ALL_SELECTED;
            }
            break;

          case CYCLE_STATES.RESTORE_SAVED:
            const saved = savedSelectionsRef.current[l1ItemId] || [];
            if (areStringArraysEqual(saved, childrenIds)) {
              nextState = CYCLE_STATES.CHILDREN_VISIBLE_NONE_SELECTED;
            } else {
              nextState = CYCLE_STATES.CHILDREN_VISIBLE_ALL_SELECTED;
            }
            break;
          case CYCLE_STATES.CHILDREN_VISIBLE_ALL_SELECTED:
            nextState = CYCLE_STATES.CHILDREN_VISIBLE_NONE_SELECTED;
            break;
          case CYCLE_STATES.CHILDREN_VISIBLE_NONE_SELECTED:
            nextState = CYCLE_STATES.CHILDREN_HIDDEN;
            break;
          case CYCLE_STATES.CHILDREN_HIDDEN:
            nextState = CYCLE_STATES.UNSELECTED;
            break;
        }
        l1ClickCycleState.current[l1ItemId] = nextState;

        let newL3Ids = level3Ids.filter((id) => !childrenIdSet.has(id));
        let newL2Ids = [...level2Ids];
        let newVisibleMap = { ...visibleChildrenMap };

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
          case CYCLE_STATES.CHILDREN_VISIBLE_NONE_SELECTED:
            if (!newL2Ids.includes(l1ItemId)) newL2Ids.push(l1ItemId);
            newVisibleMap[l1ItemId] = true;
            break;
          case CYCLE_STATES.CHILDREN_HIDDEN:
            if (!newL2Ids.includes(l1ItemId)) newL2Ids.push(l1ItemId);
            newVisibleMap[l1ItemId] = false;
            break;
          case CYCLE_STATES.UNSELECTED:
            newL2Ids = newL2Ids.filter((id) => id !== l1ItemId);
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
    ]
  );
  const handleL2SingleClickToggle = useCallback(
    /* ... unchanged ... */
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
    /* ... unchanged ... */
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
