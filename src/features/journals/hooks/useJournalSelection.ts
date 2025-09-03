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
 * Calculates the "effective" journal IDs from multi-level selections.
 * Updated to support dynamic levels beyond just level2Ids and level3Ids.
 * This function implements the business requirement to use the deepest selected level
 * for filtering purposes.
 */
const calculateEffectiveIdsFromLevels = (
  levelSelections: string[][],
  hierarchyData: AccountNodeData[],
  visibleChildrenMap: Record<string, boolean>
): string[] => {
  if (!hierarchyData || hierarchyData.length === 0 || !levelSelections.length) return [];

  const finalPathIds = new Set<string>();
  
  // Find the deepest level with selections - this is the key requirement
  let deepestLevelWithSelections = -1;
  for (let i = levelSelections.length - 1; i >= 0; i--) {
    if (levelSelections[i] && levelSelections[i].length > 0) {
      deepestLevelWithSelections = i;
      break;
    }
  }
  
  if (deepestLevelWithSelections === -1) return [];
  
  // Process each selection at the deepest level
  levelSelections[deepestLevelWithSelections].forEach((nodeId) => {
    const node = findNodeById(hierarchyData, nodeId);
    if (!node) return;
    
    // Check if this is a terminal node (no children)
    const hasChildren = node.children && node.children.length > 0;
    
    if (!hasChildren) {
      // Terminal node - add full path to root
      const path = findFullPathToRootInternal(nodeId, hierarchyData);
      path.forEach((id) => finalPathIds.add(id));
    } else {
      // Non-terminal node - check visibility and child selections
      const childrenVisible = visibleChildrenMap[nodeId] === true;
      const hasSelectedChildren = levelSelections[deepestLevelWithSelections + 1]?.some(childId => {
        const childNode = findNodeById(hierarchyData, childId);
        return childNode && findParentOfNode(childNode.id, hierarchyData)?.id === nodeId;
      }) || false;
      
      // If children are not visible or no children selected, treat as terminal
      if (!childrenVisible || !hasSelectedChildren) {
        const path = findFullPathToRootInternal(nodeId, hierarchyData);
        path.forEach((id) => finalPathIds.add(id));
      }
      // If children are visible and selected, they will be processed instead
    }
  });
  
  return Array.from(finalPathIds);
};

/**
 * Legacy function for backward compatibility
 * Calculates the "effective" journal IDs, with visibility context.
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
    levelSelections = [[], []], // Default to 2 levels for backward compatibility
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
        levelSelections?: string[][];
      },
      visibleChildrenMap: Record<string, boolean> = {}
    ) => {
      let effectiveIds: string[];
      let finalLevelSelections: string[][];
      
      // Use new multi-level system if provided, otherwise fall back to legacy
      if (newRawSelections.levelSelections) {
        finalLevelSelections = newRawSelections.levelSelections;
        
        effectiveIds = calculateEffectiveIdsFromLevels(
          finalLevelSelections,
          hierarchyData,
          visibleChildrenMap
        );
      } else {
        // Convert legacy format to new format
        const finalL2Ids = newRawSelections.level2Ids ?? level2Ids;
        const finalL3Ids = newRawSelections.level3Ids ?? level3Ids;
        
        finalLevelSelections = [finalL2Ids, finalL3Ids];
        
        effectiveIds = calculateEffectiveIds(
          finalL2Ids,
          finalL3Ids,
          hierarchyData,
          visibleChildrenMap
        );
      }

      // Calculate the single terminal ID for the deepest selections
      const terminalId = findTerminalIdFromEffectiveIds(
        effectiveIds,
        hierarchyData
      );
      
      console.log('🔍 updateJournalSelections - terminal ID calculation:', {
        effectiveIds,
        terminalId,
        levelSelections: finalLevelSelections,
        hierarchyDataLength: hierarchyData?.length || 0
      });

      // Always update both new and legacy format
      const updateData = {
        ...newRawSelections,
        levelSelections: finalLevelSelections,
        level2Ids: finalLevelSelections[0] || [],
        level3Ids: finalLevelSelections[1] || [],
        effectiveJournalIds: effectiveIds,
        selectedJournalId: terminalId,
      };

      setSelection("journal", updateData);
    },
    [hierarchyData, setSelection, level2Ids, level3Ids, levelSelections]
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
    const result = isHierarchyMode ? selectedHierarchyId : flatId;
    console.log('🔍 useJournalSelection - selectedJournalId calculation:', {
      isHierarchyMode,
      selectedHierarchyId,
      flatId,
      result,
      levelSelections,
      effectiveJournalIds
    });
    return result;
  }, [isHierarchyMode, selectedHierarchyId, flatId, levelSelections, effectiveJournalIds]);

  return {
    topLevelId,
    level2Ids,
    level3Ids,
    levelSelections,
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

