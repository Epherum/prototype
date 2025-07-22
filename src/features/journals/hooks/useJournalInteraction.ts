import { useState, useCallback, useRef, useEffect } from "react";
import { findNodeById, findParentOfNode } from "@/lib/helpers";
import { ROOT_JOURNAL_ID } from "@/lib/constants";
import type { AccountNodeData } from "@/lib/types";

const DOUBLE_CLICK_DELAY = 200;

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
  // This is the corrected signature that the hook expects
  updateJournalSelections: (
    newSelections: {
      topLevelId?: string;
      level2Ids?: string[];
      level3Ids?: string[];
    },
    visibleChildrenMap: Record<string, boolean>
  ) => void;
}
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
  const savedTopLevelSelectionRef = useRef<{
    level2Ids: string[];
    level3Ids: string[];
  } | null>(null);

  const l1ClickInteractionRef = useRef<{
    id: string | null;
    timeout: NodeJS.Timeout | null;
  }>({ id: null, timeout: null });
  const l2ClickInteractionRef = useRef<{
    id: string | null;
    timeout: NodeJS.Timeout | null;
  }>({ id: null, timeout: null });
  const topButtonInteractionRef = useRef<{ timeout: NodeJS.Timeout | null }>({
    timeout: null,
  });

  const l1ClickCycleState = useRef<Record<string, JournalItemCycleState>>({});
  const topButtonClickCycleState = useRef<JournalItemCycleState>(
    CYCLE_STATES.UNSELECTED
  );

  useEffect(() => {
    const currentTopLevelNode =
      topLevelId === ROOT_JOURNAL_ID
        ? { id: ROOT_JOURNAL_ID, children: hierarchyData }
        : findNodeById(hierarchyData, topLevelId);

    if (!currentTopLevelNode?.children) {
      savedTopLevelSelectionRef.current = { level2Ids: [], level3Ids: [] };
      return;
    }

    const visibleL1Ids = new Set(
      currentTopLevelNode.children.map((node) => node.id)
    );

    const relevantL2Ids = level2Ids.filter((id) => visibleL1Ids.has(id));
    const relevantL3Ids = [...level3Ids];

    savedTopLevelSelectionRef.current = {
      level2Ids: relevantL2Ids,
      level3Ids: relevantL3Ids,
    };
  }, [level2Ids, level3Ids, hierarchyData, topLevelId]);

  const handleSelectTopLevelJournal = useCallback(
    (newTopLevelId: string, childToSelectInL2: string | null = null) => {
      const newL2Ids = childToSelectInL2 ? [childToSelectInL2] : [];
      const newVisibleMap = {}; // Visibility is being reset
      updateJournalSelections(
        {
          topLevelId: newTopLevelId,
          level2Ids: newL2Ids,
          level3Ids: [],
        },
        newVisibleMap // Pass the new, empty map
      );
      setVisibleChildrenMap(newVisibleMap);
      l1ClickCycleState.current = {};
      savedSelectionsRef.current = {};
      savedTopLevelSelectionRef.current = null;
      topButtonClickCycleState.current = CYCLE_STATES.UNSELECTED;
    },
    [updateJournalSelections]
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

  const handleTopButtonInteraction = useCallback(() => {
    const topLevelNode =
      topLevelId === ROOT_JOURNAL_ID
        ? { id: ROOT_JOURNAL_ID, children: hierarchyData }
        : findNodeById(hierarchyData, topLevelId);
    if (!topLevelNode?.children) return;
    const allL1ChildrenIds = topLevelNode.children.map((c) => c.id);
    const allL2GrandchildrenIds = topLevelNode.children.flatMap(
      (c) => c.children?.map((gc) => gc.id) || []
    );

    const hasSavedSelection =
      savedTopLevelSelectionRef.current &&
      (savedTopLevelSelectionRef.current.level2Ids.length > 0 ||
        savedTopLevelSelectionRef.current.level3Ids.length > 0);

    let currentState = topButtonClickCycleState.current;
    let nextState = currentState;
    switch (currentState) {
      case CYCLE_STATES.UNSELECTED:
        nextState = hasSavedSelection
          ? CYCLE_STATES.RESTORE_SAVED
          : CYCLE_STATES.CHILDREN_VISIBLE_ALL_SELECTED;
        break;
      case CYCLE_STATES.RESTORE_SAVED:
        nextState = CYCLE_STATES.CHILDREN_VISIBLE_ALL_SELECTED;
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
    topButtonClickCycleState.current = nextState;
    let newL2Ids: string[] = [];
    let newL3Ids: string[] = [];
    const newVisibleMap: Record<string, boolean> = {};
    switch (nextState) {
      case CYCLE_STATES.RESTORE_SAVED:
        if (savedTopLevelSelectionRef.current) {
          newL2Ids = savedTopLevelSelectionRef.current.level2Ids;
          newL3Ids = savedTopLevelSelectionRef.current.level3Ids;
        }
        allL1ChildrenIds.forEach((id) => (newVisibleMap[id] = true));
        break;
      case CYCLE_STATES.CHILDREN_VISIBLE_ALL_SELECTED:
        newL2Ids = allL1ChildrenIds;
        newL3Ids = allL2GrandchildrenIds;
        allL1ChildrenIds.forEach((id) => (newVisibleMap[id] = true));
        break;
      case CYCLE_STATES.CHILDREN_VISIBLE_NONE_SELECTED:
        newL2Ids = allL1ChildrenIds;
        allL1ChildrenIds.forEach((id) => (newVisibleMap[id] = true));
        break;
      case CYCLE_STATES.CHILDREN_HIDDEN:
        newL2Ids = allL1ChildrenIds;
        break;
      case CYCLE_STATES.UNSELECTED:
        savedTopLevelSelectionRef.current = null;
        break;
    }
    l1ClickCycleState.current = {};
    savedSelectionsRef.current = {};
    setVisibleChildrenMap(newVisibleMap);
    // ✅ Pass the newly calculated visibility map with the selection update
    updateJournalSelections(
      { level2Ids: newL2Ids, level3Ids: newL3Ids },
      newVisibleMap
    );
  }, [hierarchyData, topLevelId, updateJournalSelections]);

  const handleTopButtonClick = useCallback(() => {
    if (topButtonInteractionRef.current.timeout) {
      clearTimeout(topButtonInteractionRef.current.timeout);
      topButtonInteractionRef.current.timeout = null;
      handleNavigateUpOneLevel();
      return;
    }
    const newTimeout = setTimeout(() => {
      handleTopButtonInteraction();
      topButtonInteractionRef.current.timeout = null;
    }, DOUBLE_CLICK_DELAY);
    topButtonInteractionRef.current.timeout = newTimeout;
  }, [handleNavigateUpOneLevel, handleTopButtonInteraction]);

  const handleL1Interaction = useCallback(
    (l1ItemId: string) => {
      if (l1ClickInteractionRef.current.timeout)
        clearTimeout(l1ClickInteractionRef.current.timeout);
      if (l1ClickInteractionRef.current.id === l1ItemId) {
        handleSelectTopLevelJournal(l1ItemId);
        l1ClickInteractionRef.current = { id: null, timeout: null };
        return;
      }
      const newTimeout = setTimeout(() => {
        const l1Node = findNodeById(hierarchyData, l1ItemId);
        if (!l1Node) return;

        // Handle true terminal nodes (no children)
        if (!l1Node.children || l1Node.children.length === 0) {
          const newL2Ids = level2Ids.includes(l1ItemId)
            ? level2Ids.filter((id) => id !== l1ItemId)
            : [...level2Ids, l1ItemId];
          // ✅ Pass the current visibility map
          updateJournalSelections({ level2Ids: newL2Ids }, visibleChildrenMap);
          return;
        }

        const childrenIds = l1Node.children.map((c) => c.id);
        const childrenIdSet = new Set(childrenIds);
        const hasSavedSelection = !!savedSelectionsRef.current[l1ItemId];
        let currentState =
          l1ClickCycleState.current[l1ItemId] || CYCLE_STATES.UNSELECTED;
        let nextState = currentState;
        switch (currentState) {
          case CYCLE_STATES.UNSELECTED:
            nextState = hasSavedSelection
              ? CYCLE_STATES.RESTORE_SAVED
              : CYCLE_STATES.CHILDREN_VISIBLE_ALL_SELECTED;
            break;
          case CYCLE_STATES.RESTORE_SAVED:
            nextState = CYCLE_STATES.CHILDREN_VISIBLE_ALL_SELECTED;
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
            delete savedSelectionsRef.current[l1ItemId];
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
        topButtonClickCycleState.current = CYCLE_STATES.UNSELECTED;
        setVisibleChildrenMap(newVisibleMap);
        // ✅ Pass the newly calculated visibility map with the selection update
        updateJournalSelections(
          { level2Ids: newL2Ids, level3Ids: newL3Ids },
          newVisibleMap
        );
        l1ClickInteractionRef.current = { id: null, timeout: null };
      }, DOUBLE_CLICK_DELAY);
      l1ClickInteractionRef.current = { id: l1ItemId, timeout: newTimeout };
    },
    [
      hierarchyData,
      level2Ids,
      level3Ids,
      visibleChildrenMap,
      handleSelectTopLevelJournal,
      updateJournalSelections,
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
      topButtonClickCycleState.current = CYCLE_STATES.UNSELECTED;
      // ✅ Pass the current visibility map
      updateJournalSelections({ level3Ids: newL3s }, visibleChildrenMap);
    },
    [level3Ids, hierarchyData, updateJournalSelections, visibleChildrenMap]
  );

  const handleL2Interaction = useCallback(
    (l2ItemId: string) => {
      if (l2ClickInteractionRef.current.timeout)
        clearTimeout(l2ClickInteractionRef.current.timeout);

      if (l2ClickInteractionRef.current.id === l2ItemId) {
        const parent = findParentOfNode(l2ItemId, hierarchyData);
        if (parent) handleSelectTopLevelJournal(parent.id, l2ItemId);
        l2ClickInteractionRef.current = { id: null, timeout: null };
        return;
      }

      const newTimeout = setTimeout(() => {
        handleL2SingleClickToggle(l2ItemId);

        l2ClickInteractionRef.current.id = null;
        l2ClickInteractionRef.current.timeout = null;
      }, DOUBLE_CLICK_DELAY);

      l2ClickInteractionRef.current = { id: l2ItemId, timeout: newTimeout };
    },
    [hierarchyData, handleSelectTopLevelJournal, handleL2SingleClickToggle]
  );

  return {
    visibleChildrenMap,
    handleSelectTopLevelJournal,
    handleL1Interaction,
    handleL2Interaction,
    handleTopButtonClick,
  };
};
