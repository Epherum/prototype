// src/features/journals/hooks/useJournalSelection.ts

import { useCallback, useMemo } from "react";
import { useAppStore } from "@/store/appStore";
import { ROOT_JOURNAL_ID } from "@/lib/constants";
import type { AccountNodeData } from "@/lib/types/ui";

// --- Co-located Hierarchical Logic Helpers ---

const findNodeById = (
  nodes: AccountNodeData[],
  id: string
): AccountNodeData | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const findParentOfNode = (
  nodeId: string,
  nodes: AccountNodeData[],
  parent: AccountNodeData | null = null
): AccountNodeData | null => {
  for (const node of nodes) {
    if (node.id === nodeId) return parent;
    if (node.children) {
      const found = findParentOfNode(nodeId, node.children, node);
      if (found) return found;
    }
  }
  return null;
};

const findFullPathToRootInternal = (
  nodeId: string,
  hierarchy: AccountNodeData[]
): string[] => {
  const path: string[] = [];
  let currentId: string | null = nodeId;
  while (currentId) {
    path.unshift(currentId);
    const parent = findParentOfNode(currentId, hierarchy);
    currentId = parent ? parent.id : null;
  }
  return path;
};

/**
 * ✅ --- NEW HELPER TO FIX THE BUG --- ✅
 * Derives the single terminal selection ID from the array of effective path IDs.
 * A terminal ID is one that is present in the effective set but is not a parent
 * to any other ID also in the set.
 *
 * @param effectiveIds - The array of all IDs in the selection paths.
 * @param hierarchyData - The full journal hierarchy for lookups.
 * @returns The single terminal ID, or null if there isn't exactly one.
 */
const findTerminalIdFromEffectiveIds = (
  effectiveIds: string[],
  hierarchyData: AccountNodeData[]
): string | null => {
  if (effectiveIds.length === 0) {
    return null;
  }

  const effectiveIdSet = new Set(effectiveIds);
  const terminalNodes = effectiveIds.filter((id) => {
    const node = findNodeById(hierarchyData, id);
    // A node with no children is always a terminal node in the path.
    if (!node?.children) return true;
    // A node is terminal if none of its children are also in the effective path.
    return !node.children.some((child) => effectiveIdSet.has(child.id));
  });

  // If there is exactly one terminal node, we have a valid single selection.
  if (terminalNodes.length === 1) {
    return terminalNodes[0];
  }

  return null;
};

/**
 * Calculates the "effective" journal IDs, with visibility context.
 * This function remains unchanged as its path-based output is correct for filtering.
 */
const calculateEffectiveIds = (
  level2Ids: string[],
  level3Ids: string[],
  hierarchyData: AccountNodeData[],
  visibleChildrenMap: Record<string, boolean>
): string[] => {
  if (!hierarchyData || hierarchyData.length === 0) return [];

  const finalPathIds = new Set<string>();
  const level3IdSet = new Set(level3Ids);

  level3Ids.forEach((l3Id) => {
    const path = findFullPathToRootInternal(l3Id, hierarchyData);
    path.forEach((id) => finalPathIds.add(id));
  });

  level2Ids.forEach((l2Id) => {
    const node = findNodeById(hierarchyData, l2Id);
    if (!node) return;

    const isTrueTerminal = !node.children || node.children.length === 0;
    if (isTrueTerminal) {
      const path = findFullPathToRootInternal(l2Id, hierarchyData);
      path.forEach((id) => finalPathIds.add(id));
      return;
    }

    const hasSelectedChildren =
      node.children?.some((child) => level3IdSet.has(child.id)) ?? false;
    if (hasSelectedChildren) {
      return;
    }

    const childrenAreVisible = visibleChildrenMap[l2Id] === true;
    if (childrenAreVisible) {
      return;
    }

    const path = findFullPathToRootInternal(l2Id, hierarchyData);
    path.forEach((id) => finalPathIds.add(id));
  });

  return Array.from(finalPathIds);
};

// --- The Main Hook ---

export const useJournalSelection = (
  isHierarchyMode: boolean,
  hierarchyData: AccountNodeData[]
) => {
  const journalSelection = useAppStore((state) => state.selections.journal);
  const effectiveJournalIds = useAppStore(
    (state) => state.selections.effectiveJournalIds
  );
  const setSelection = useAppStore((state) => state.setSelection);
  const effectiveRestrictedJournalId = useAppStore((state) => state.effectiveRestrictedJournalId);

  const {
    topLevelId,
    level2Ids,
    level3Ids,
    flatId,
    rootFilter,
    selectedJournalId: selectedHierarchyId,
  } = journalSelection;

  const updateJournalSelections = useCallback(
    (
      newRawSelections: {
        topLevelId?: string;
        level2Ids?: string[];
        level3Ids?: string[];
      },
      visibleChildrenMap: Record<string, boolean>
    ) => {
      const finalL2Ids = newRawSelections.level2Ids ?? level2Ids;
      const finalL3Ids = newRawSelections.level3Ids ?? level3Ids;

      const effectiveIds = calculateEffectiveIds(
        finalL2Ids,
        finalL3Ids,
        hierarchyData,
        visibleChildrenMap
      );

      // ✅ FIX: Calculate the single terminal ID and pass it to the store.
      const terminalId = findTerminalIdFromEffectiveIds(
        effectiveIds,
        hierarchyData
      );

      setSelection("journal", {
        ...newRawSelections,
        effectiveJournalIds: effectiveIds,
        selectedJournalId: terminalId, // Pass the new, correctly derived ID
      });
    },
    [hierarchyData, setSelection, level2Ids, level3Ids]
  );

  const resetJournalSelections = useCallback(() => {
    // Use the store's resetSelections which handles localStorage properly
    const resetSelections = useAppStore.getState().resetSelections;
    resetSelections();
  }, []);

  const setSelectedFlatJournalId = useCallback(
    (id: string | null) => {
      setSelection("journal", {
        flatId: id,
        topLevelId: effectiveRestrictedJournalId || ROOT_JOURNAL_ID,
        level2Ids: [],
        level3Ids: [],
        selectedJournalId: null, // Flat mode does not have a hierarchical selection
        effectiveJournalIds: id ? [id] : [],
      });
    },
    [setSelection, effectiveRestrictedJournalId]
  );

  // ✅ FIX: The final `selectedJournalId` is now correctly derived from the stored
  // hierarchical value or the flat mode ID.
  const selectedJournalId = useMemo((): string | null => {
    return isHierarchyMode ? selectedHierarchyId : flatId;
  }, [isHierarchyMode, selectedHierarchyId, flatId]);

  return {
    topLevelId,
    level2Ids,
    level3Ids,
    flatId,
    rootFilter,
    effectiveJournalIds,
    selectedJournalId, // This is now correct!
    updateJournalSelections,
    resetJournalSelections,
    setSelectedFlatJournalId,
    setSelection,
  };
};

