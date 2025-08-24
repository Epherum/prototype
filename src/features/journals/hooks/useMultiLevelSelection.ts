// src/features/journals/hooks/useMultiLevelSelection.ts
"use client";

import { useMemo, useCallback, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import type { AccountNodeData } from "@/lib/types/ui";
import { findNodeById, findParentOfNode } from "@/lib/helpers";

const MAX_LEVELS = 6; // Reasonable limit for performance

// Helper function to find full path to root
const findFullPathToRoot = (nodeId: string, hierarchyData: AccountNodeData[]): string[] => {
  const path: string[] = [];
  let currentId: string | null = nodeId;
  
  while (currentId) {
    path.unshift(currentId);
    const parent = findParentOfNode(currentId, hierarchyData);
    currentId = parent ? parent.id : null;
  }
  
  return path;
};

// Clear 4-step cycle for all non-terminal nodes:
// 1. Click: Select parent, show children unselected
// 2. Click: Keep parent selected, select all children
// 3. Click: Keep parent selected, hide children
// 4. Click: Unselect parent
const CYCLE_STATES = {
  STEP_1_PARENT_SELECTED_CHILDREN_VISIBLE_UNSELECTED: "STEP_1",  // Select parent, show children unselected
  STEP_2_PARENT_SELECTED_CHILDREN_VISIBLE_SELECTED: "STEP_2",    // Parent + all children selected
  STEP_3_PARENT_SELECTED_CHILDREN_HIDDEN: "STEP_3",             // Parent selected, children hidden
  STEP_4_UNSELECTED: "STEP_4",                                  // Everything unselected
} as const;

type CycleState = (typeof CYCLE_STATES)[keyof typeof CYCLE_STATES];

export interface LevelData {
  nodes: AccountNodeData[];
  selectedIds: string[];
  visibleChildrenMap: Record<string, boolean>;
  shouldShowLevel: boolean; // Whether this level should be displayed
}

export const useMultiLevelSelection = (
  hierarchyData: AccountNodeData[],
  topLevelId: string
) => {
  const { levelSelections } = useAppStore(
    (state) => state.selections.journal
  );
  const setSelection = useAppStore((state) => state.setSelection);
  
  console.log('📖 useMultiLevelSelection - reading from store:', {
    levelSelections,
    level0: levelSelections[0],
    level1: levelSelections[1], 
    level2: levelSelections[2]
  });
  
  
  // Calculate the hierarchy levels based on current selections
  const levelsData = useMemo<LevelData[]>(() => {
    const levels: LevelData[] = [];
    
    // Level 0 (1st Row) - children of topLevelId
    const topNode = topLevelId === "ROOT" ? null : findNodeById(hierarchyData, topLevelId);
    const level0Nodes = topNode?.children || hierarchyData;
    
    levels.push({
      nodes: level0Nodes,
      selectedIds: levelSelections[0] || [],
      visibleChildrenMap: {},
      shouldShowLevel: true, // First level always visible
    });

    // Helper function to search for a node in the full hierarchy
    const findNodeInHierarchy = (nodes: AccountNodeData[], id: string): AccountNodeData | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNodeInHierarchy(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    // Calculate subsequent levels dynamically - unlimited expansion
    let levelIndex = 1;
    while (levelIndex < MAX_LEVELS) {
      const parentLevelSelections = levelSelections[levelIndex - 1] || [];
      
      // If no parent selections, we don't need more levels
      if (parentLevelSelections.length === 0) {
        break;
      }
      
      const currentLevelNodes: AccountNodeData[] = [];
      const visibleChildrenMap: Record<string, boolean> = {};
      let hasAnyChildren = false;

      // Aggregate children from all selected parents
      parentLevelSelections.forEach(parentId => {
        // Search in the full hierarchy data
        const parentNode = findNodeInHierarchy(hierarchyData, parentId);
        
        if (parentNode?.children && parentNode.children.length > 0) {
          currentLevelNodes.push(...parentNode.children);
          visibleChildrenMap[parentId] = true;
          hasAnyChildren = true;
        } else {
          // Parent has no children, but we still mark it as processed
          visibleChildrenMap[parentId] = false;
        }
      });

      // Remove duplicates by id
      const uniqueNodes = currentLevelNodes.filter(
        (node, index, self) => self.findIndex(n => n.id === node.id) === index
      );

      // Only add the level if we have selections at the parent level
      // Show level even if empty to indicate no children available
      levels.push({
        nodes: uniqueNodes,
        selectedIds: levelSelections[levelIndex] || [],
        visibleChildrenMap,
        shouldShowLevel: parentLevelSelections.length > 0,
      });

      // If no children at this level, we can stop (no deeper levels possible)
      if (!hasAnyChildren) {
        break;
      }

      levelIndex++;
    }

    console.log('🔍 levelsData calculated:', levels.map((level, index) => ({
      levelIndex: index,
      nodesCount: level.nodes.length,
      selectedIds: level.selectedIds,
      shouldShowLevel: level.shouldShowLevel,
      nodeIds: level.nodes.map(n => n.id)
    })));

    return levels;
  }, [hierarchyData, topLevelId, levelSelections]);

  // Get the deepest level with selections for filtering
  const deepestSelectedLevel = useMemo(() => {
    for (let i = levelSelections.length - 1; i >= 0; i--) {
      if (levelSelections[i] && levelSelections[i].length > 0) {
        return i;
      }
    }
    return -1;
  }, [levelSelections]);

  // Get combined visibility map from all levels for proper effective ID calculation
  const combinedVisibilityMap = useMemo(() => {
    const combined: Record<string, boolean> = {};
    
    levelsData.forEach(levelData => {
      Object.assign(combined, levelData.visibleChildrenMap);
    });
    
    return combined;
  }, [levelsData]);

  // Get all selected IDs from the deepest level for effective journal IDs
  const effectiveJournalIds = useMemo(() => {
    if (deepestSelectedLevel === -1) return [];
    return levelSelections[deepestSelectedLevel] || [];
  }, [levelSelections, deepestSelectedLevel]);

  // Track cycle states for each node at each level
  const nodeCycleStates = useRef<Record<string, CycleState>>({});
  
  // Helper to get unique key for node at specific level
  const getNodeKey = (levelIndex: number, nodeId: string) => `${levelIndex}-${nodeId}`;
  
  // Calculate next cycle state - simply moves to next step in sequence
  const calculateNextCycleState = useCallback((levelIndex: number, nodeId: string) => {
    const nodeKey = getNodeKey(levelIndex, nodeId);
    const lastState = nodeCycleStates.current[nodeKey];
    
    // Simple 4-step cycle - always go to next step
    const cycle = [
      CYCLE_STATES.STEP_1_PARENT_SELECTED_CHILDREN_VISIBLE_UNSELECTED,
      CYCLE_STATES.STEP_2_PARENT_SELECTED_CHILDREN_VISIBLE_SELECTED,
      CYCLE_STATES.STEP_3_PARENT_SELECTED_CHILDREN_HIDDEN,
      CYCLE_STATES.STEP_4_UNSELECTED,
    ];
    
    if (!lastState) {
      // First click - go to step 1
      return cycle[0];
    }
    
    // Find current position and move to next
    const currentIndex = cycle.indexOf(lastState);
    const nextIndex = (currentIndex + 1) % cycle.length;
    return cycle[nextIndex];
  }, []);
  
  // Handle selection at a specific level with cycle logic
  const handleLevelSelection = useCallback((levelIndex: number, nodeId: string) => {
    console.log(`🔍 handleLevelSelection called: levelIndex=${levelIndex}, nodeId=${nodeId}`);
    console.log('🔍 hierarchyData length:', hierarchyData.length);
    console.log('🔍 current levelSelections:', levelSelections);
    
    // Find the node - search in all hierarchy data, not just levelsData
    const findNodeInHierarchy = (nodes: AccountNodeData[], id: string): AccountNodeData | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNodeInHierarchy(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    const node = findNodeInHierarchy(hierarchyData, nodeId);
    console.log('🔍 Found node:', node ? `${node.code} (${node.children?.length || 0} children)` : 'NOT FOUND');
    
    if (!node) {
      console.log('❌ Node not found, aborting selection');
      return;
    }
    
    const hasChildren = node.children && node.children.length > 0;
    const nodeKey = getNodeKey(levelIndex, nodeId);
    
    // Clone current level selections and ensure we have enough levels
    const updatedLevelSelections = [...levelSelections];
    while (updatedLevelSelections.length <= Math.max(levelIndex + 1, 1)) {
      updatedLevelSelections.push([]);
    }
    
    if (!hasChildren) {
      // Terminal node - simple toggle
      const currentSelections = updatedLevelSelections[levelIndex] || [];
      const newSelections = currentSelections.includes(nodeId)
        ? currentSelections.filter(id => id !== nodeId)
        : [...currentSelections, nodeId];
      
      updatedLevelSelections[levelIndex] = newSelections;
      
      // Clear all levels below this one
      for (let i = levelIndex + 1; i < updatedLevelSelections.length; i++) {
        updatedLevelSelections[i] = [];
      }
      
      
      // Calculate effective IDs from the deepest level with selections
      const allEffectiveIds = new Set<string>();
      let deepestLevel = -1;
      for (let i = updatedLevelSelections.length - 1; i >= 0; i--) {
        if (updatedLevelSelections[i] && updatedLevelSelections[i].length > 0) {
          deepestLevel = i;
          break;
        }
      }
      
      if (deepestLevel >= 0) {
        updatedLevelSelections[deepestLevel].forEach(id => {
          const path = findFullPathToRoot(id, hierarchyData);
          path.forEach(pathId => allEffectiveIds.add(pathId));
        });
      }
      
      // Update the store with the complete level selections structure
      const updateData = {
        levelSelections: updatedLevelSelections,
        level2Ids: updatedLevelSelections[0] || [],
        level3Ids: updatedLevelSelections[1] || [],
        selectedJournalId: null, // Will be calculated by the selection hook
        effectiveJournalIds: Array.from(allEffectiveIds),
      };
      
      console.log('🔄 Terminal node - updating store with:', updateData);
      console.log('🔄 Specifically, levelSelections:', updateData.levelSelections);
      console.log('🔄 Level 0 selections:', updateData.levelSelections[0]);
      console.log('🔄 Level 1 selections:', updateData.levelSelections[1]); 
      console.log('🔄 Level 2 selections:', updateData.levelSelections[2]);
      setSelection("journal", updateData);
      return;
    }
    
    // Parent node - use simple cycle logic
    const nextState = calculateNextCycleState(levelIndex, nodeId);
    
    // Store the state we're about to execute
    nodeCycleStates.current[nodeKey] = nextState;
    
    const childrenIds = node.children!.map(child => child.id);
    
    switch (nextState) {
      case CYCLE_STATES.STEP_1_PARENT_SELECTED_CHILDREN_VISIBLE_UNSELECTED:
        // Select parent, deselect all children
        if (!updatedLevelSelections[levelIndex].includes(nodeId)) {
          updatedLevelSelections[levelIndex] = [...updatedLevelSelections[levelIndex], nodeId];
        }
        updatedLevelSelections[levelIndex + 1] = updatedLevelSelections[levelIndex + 1].filter(
          id => !childrenIds.includes(id)
        );
        // Clear all levels below
        for (let i = levelIndex + 2; i < updatedLevelSelections.length; i++) {
          updatedLevelSelections[i] = [];
        }
        break;
        
      case CYCLE_STATES.STEP_2_PARENT_SELECTED_CHILDREN_VISIBLE_SELECTED:
        // Keep parent selected, select all children
        if (!updatedLevelSelections[levelIndex].includes(nodeId)) {
          updatedLevelSelections[levelIndex] = [...updatedLevelSelections[levelIndex], nodeId];
        }
        const existingChildSelections = updatedLevelSelections[levelIndex + 1].filter(
          id => !childrenIds.includes(id)
        );
        updatedLevelSelections[levelIndex + 1] = [...existingChildSelections, ...childrenIds];
        // Clear all levels below
        for (let i = levelIndex + 2; i < updatedLevelSelections.length; i++) {
          updatedLevelSelections[i] = [];
        }
        break;
        
      case CYCLE_STATES.STEP_3_PARENT_SELECTED_CHILDREN_HIDDEN:
        // Keep parent selected, clear children
        if (!updatedLevelSelections[levelIndex].includes(nodeId)) {
          updatedLevelSelections[levelIndex] = [...updatedLevelSelections[levelIndex], nodeId];
        }
        updatedLevelSelections[levelIndex + 1] = updatedLevelSelections[levelIndex + 1].filter(
          id => !childrenIds.includes(id)
        );
        // Clear all levels below
        for (let i = levelIndex + 2; i < updatedLevelSelections.length; i++) {
          updatedLevelSelections[i] = [];
        }
        break;
        
      case CYCLE_STATES.STEP_4_UNSELECTED:
        // Deselect parent and all children
        updatedLevelSelections[levelIndex] = updatedLevelSelections[levelIndex].filter(
          id => id !== nodeId
        );
        updatedLevelSelections[levelIndex + 1] = updatedLevelSelections[levelIndex + 1].filter(
          id => !childrenIds.includes(id)
        );
        // Clear all levels below
        for (let i = levelIndex + 2; i < updatedLevelSelections.length; i++) {
          updatedLevelSelections[i] = [];
        }
        break;
    }
    
    
    // Calculate effective IDs from the deepest level with selections
    const allEffectiveIds = new Set<string>();
    let deepestLevel = -1;
    for (let i = updatedLevelSelections.length - 1; i >= 0; i--) {
      if (updatedLevelSelections[i] && updatedLevelSelections[i].length > 0) {
        deepestLevel = i;
        break;
      }
    }
    
    if (deepestLevel >= 0) {
      updatedLevelSelections[deepestLevel].forEach(id => {
        const path = findFullPathToRoot(id, hierarchyData);
        path.forEach(pathId => allEffectiveIds.add(pathId));
      });
    }
    
    // Update the store with the complete level selections (unlimited levels)
    const updateData = {
      levelSelections: updatedLevelSelections,
      // Also update legacy format for backward compatibility
      level2Ids: updatedLevelSelections[0] || [],
      level3Ids: updatedLevelSelections[1] || [],
      selectedJournalId: null, // Will be calculated by the selection hook
      effectiveJournalIds: Array.from(allEffectiveIds),
    };
    
    console.log('🔄 Parent node - updating store with:', updateData);
    console.log('🔄 Specifically, levelSelections:', updateData.levelSelections);
    console.log('🔄 Level 0 selections:', updateData.levelSelections[0]);
    console.log('🔄 Level 1 selections:', updateData.levelSelections[1]); 
    console.log('🔄 Level 2 selections:', updateData.levelSelections[2]);
    setSelection("journal", updateData);
  }, [levelSelections, calculateNextCycleState, setSelection, hierarchyData]);

  // Handle expanding to show more levels (no longer needed - automatic)
  const expandToLevel = useCallback((targetLevel: number) => {
    // No-op - levels expand automatically based on selections
    console.log(`Automatic expansion to level ${targetLevel}`);
  }, []);

  // Check if a level has any child nodes to show
  const hasChildrenAtLevel = useCallback((levelIndex: number) => {
    if (levelIndex >= levelsData.length - 1) return false;
    return levelsData[levelIndex + 1]?.nodes.length > 0;
  }, [levelsData]);

  // Get color for a node based on its top-level parent
  const getNodeColor = useCallback((nodeId: string, levelIndex: number) => {
    if (levelIndex === 0) return null; // Top level nodes get colors from component
    
    // Find the top-level parent for color inheritance
    let currentNode = findNodeById(levelsData[levelIndex]?.nodes || [], nodeId);
    let currentLevel = levelIndex;
    
    while (currentLevel > 0 && currentNode) {
      const parent = findParentOfNode(currentNode.id, hierarchyData);
      if (!parent) break;
      
      if (currentLevel === 1) {
        // This is a level 1 parent, find its color from level 0 selections
        const level0Index = levelsData[0]?.nodes.findIndex(n => n.id === parent.id) ?? -1;
        return level0Index >= 0 ? level0Index : null;
      }
      
      currentNode = parent;
      currentLevel--;
    }
    
    return null;
  }, [levelsData, hierarchyData]);

  return {
    levelsData,
    deepestSelectedLevel,
    effectiveJournalIds,
    combinedVisibilityMap,
    handleLevelSelection,
    expandToLevel, // Keep for backward compatibility but it's now a no-op
    hasChildrenAtLevel,
    getNodeColor,
  };
};