// src/features/journals/hooks/useJournalSelection.ts

import { useCallback, useMemo } from "react";
import { useAppStore } from "@/store/appStore";
import { ROOT_JOURNAL_ID } from "@/lib/constants";
import type { AccountNodeData } from "@/lib/types";

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
 * ✅ --- BUG FIX IMPLEMENTED HERE --- ✅
 * Calculates the "effective" journal IDs, now with visibility context.
 *
 * @param visibleChildrenMap - The crucial new parameter. A map indicating which L2 nodes have their children expanded in the UI.
 */
const calculateEffectiveIds = (
  level2Ids: string[],
  level3Ids: string[],
  hierarchyData: AccountNodeData[],
  visibleChildrenMap: Record<string, boolean> // The new context
): string[] => {
  if (!hierarchyData || hierarchyData.length === 0) return [];

  const finalPathIds = new Set<string>();
  const level3IdSet = new Set(level3Ids);

  // 1. All selected 3rd-level nodes are always terminal selections.
  level3Ids.forEach((l3Id) => {
    const path = findFullPathToRootInternal(l3Id, hierarchyData);
    path.forEach((id) => finalPathIds.add(id));
  });

  // 2. A 2nd-level node is a terminal selection if it meets specific criteria.
  level2Ids.forEach((l2Id) => {
    const node = findNodeById(hierarchyData, l2Id);
    if (!node) return;

    // A. Is it a true terminal node (no children)? If so, it's always effective.
    const isTrueTerminal = !node.children || node.children.length === 0;
    if (isTrueTerminal) {
      const path = findFullPathToRootInternal(l2Id, hierarchyData);
      path.forEach((id) => finalPathIds.add(id));
      return; // Continue to next l2Id
    }

    // B. Does it have selected children? If so, it's just a container and not terminal.
    const hasSelectedChildren =
      node.children?.some((child) => level3IdSet.has(child.id)) ?? false;
    if (hasSelectedChildren) {
      return; // Skip, as the L3 selections are the terminal ones.
    }

    // C. Are its children VISIBLE in the UI? If so, the user has expanded it but
    //    not selected a child, making the selection incomplete. It is NOT terminal.
    const childrenAreVisible = visibleChildrenMap[l2Id] === true;
    if (childrenAreVisible) {
      return; // Skip, this is an incomplete selection.
    }

    // D. If it has children, none are selected, AND its children are hidden,
    //    then the user intends for the L2 node itself to be the terminal selection.
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
  const selections = useAppStore((state) => state.selections);
  const setSelection = useAppStore((state) => state.setSelection);
  const auth = useAppStore((state) => state.auth);

  const { topLevelId, level2Ids, level3Ids, flatId, rootFilter } =
    selections.journal;
  const effectiveJournalIds = selections.effectiveJournalIds;

  /**
   * ✅ The hook's update function now accepts the visibility map to pass to the calculator.
   */
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
        visibleChildrenMap // Pass the context down
      );

      setSelection("journal", {
        ...newRawSelections,
        effectiveJournalIds: effectiveIds,
      });
    },
    [hierarchyData, setSelection, level2Ids, level3Ids] // Dependencies are correct
  );

  // ... (rest of the hook is unchanged)
  const resetJournalSelections = useCallback(() => {
    const initialSelections = getInitialSelections(
      auth.effectiveRestrictedJournalId
    );
    setSelection("journal", initialSelections.journal);
    setSelection("effectiveJournalIds", initialSelections.effectiveJournalIds);
  }, [setSelection, auth.effectiveRestrictedJournalId]);

  const setSelectedFlatJournalId = useCallback(
    (id: string | null) => {
      setSelection("journal", {
        flatId: id,
        topLevelId: auth.effectiveRestrictedJournalId || ROOT_JOURNAL_ID,
        level2Ids: [],
        level3Ids: [],
        effectiveJournalIds: id ? [id] : [],
      });
    },
    [setSelection, auth.effectiveRestrictedJournalId]
  );

  const selectedJournalId = useMemo((): string | null => {
    if (!isHierarchyMode) {
      return flatId;
    }
    if (effectiveJournalIds.length === 1) {
      return effectiveJournalIds[0];
    }
    return null;
  }, [isHierarchyMode, flatId, effectiveJournalIds]);

  return {
    topLevelId,
    level2Ids,
    level3Ids,
    flatId,
    rootFilter,
    effectiveJournalIds,
    selectedJournalId,
    updateJournalSelections, // This now has the new signature
    resetJournalSelections,
    setSelectedFlatJournalId,
    setSelection,
  };
};

const getInitialSelections = (restrictedJournalId = ROOT_JOURNAL_ID) => ({
  journal: {
    topLevelId: restrictedJournalId,
    level2Ids: [],
    level3Ids: [],
    flatId: null,
    rootFilter: ["affected"],
  },
  effectiveJournalIds: [],
});
