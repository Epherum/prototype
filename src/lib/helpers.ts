// File: src / lib / helpers.ts;
import { AccountNodeData, Journal } from "@/lib/types";

import type { JournalForAdminSelection as BackendJournalForAdminSelection } from "@/app/services/journalService"; // Or from clientJournalService

export type JournalForAdminSelection = BackendJournalForAdminSelection;

export interface JournalWithDisplayPath extends JournalForAdminSelection {
  displayPath: string;
}

interface JournalMapEntry extends JournalForAdminSelection {}

export function buildTree(journals: Journal[]): AccountNodeData[] {
  const journalMap: Record<
    string,
    AccountNodeData & { childrenFromApi?: Journal[] }
  > = {};
  const tree: AccountNodeData[] = [];

  journals.forEach((journal) => {
    journalMap[journal.id] = {
      ...journal,
      name: journal.name,
      code: journal.id, // Assuming 'id' is used as 'code' if no separate code field
      children: [],
    };
  });

  journals.forEach((journal) => {
    if (journal.parentId && journalMap[journal.parentId]) {
      if (!journalMap[journal.parentId].children) {
        journalMap[journal.parentId].children = [];
      }
      journalMap[journal.parentId].children?.push(journalMap[journal.id]);
    } else {
      // This node is a root (either a true root or the root of a sub-hierarchy)
      tree.push(journalMap[journal.id]);
    }
  });

  const sortChildren = (nodes: AccountNodeData[]) => {
    nodes.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        sortChildren(node.children);
      }
    });
  };
  sortChildren(tree);

  return tree;
}
// --- Helper: Find Node in Hierarchy ---
export const findNodeById = (nodes: AccountNodeData[], nodeId: string) => {
  if (!nodes || !nodeId) return null;
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const foundInChildren = findNodeById(node.children, nodeId);
      if (foundInChildren) {
        return foundInChildren;
      }
    }
  }
  return null;
};

export const findParentOfNode = (nodeId, hierarchy, parent = null) => {
  if (!hierarchy || !nodeId) return null;
  for (const node of hierarchy) {
    if (node.id === nodeId) {
      return parent;
    }
    if (node.children && node.children.length > 0) {
      const foundParentInChild = findParentOfNode(nodeId, node.children, node);
      if (foundParentInChild !== null) {
        if (foundParentInChild) return foundParentInChild;
      }
    }
  }
  return null;
};

export const getFirstId = (arr) =>
  arr && arr.length > 0 && arr[0] ? arr[0].id : null;

// New Helper: Get all descendant IDs of a given node
export const getDescendantIds = (
  nodes: AccountNodeData[] | undefined, // The full hierarchy or a relevant sub-tree
  parentId: string
): string[] => {
  if (!nodes) return [];
  const allDescendantIds: string[] = [];

  // Find the starting parent node in the provided nodes array
  // This recursive search needs to look through the entire initial 'nodes' structure
  // to find the parentId, not just assume it's a top-level entry.

  const findAndCollectDescendants = (
    currentNodes: AccountNodeData[],
    targetParentId: string,
    collecting: boolean
  ) => {
    for (const node of currentNodes) {
      if (collecting) {
        // If we are already under the target parent
        allDescendantIds.push(node.id);
        if (node.children) {
          findAndCollectDescendants(node.children, targetParentId, true);
        }
      } else if (node.id === targetParentId) {
        // Found the target parent
        if (node.children) {
          findAndCollectDescendants(node.children, targetParentId, true); // Start collecting its children
        }
      } else if (node.children) {
        // Not yet collecting, and not the parent, so search deeper
        findAndCollectDescendants(node.children, targetParentId, false);
      }
    }
  };

  findAndCollectDescendants(nodes, parentId, false);
  return allDescendantIds;
};

// New Helper: Get IDs of all parent nodes up to the root of the provided hierarchy
// or up to a specified 'stopAtId' if you want to check ancestry within a sub-context.
// For simplicity, this version finds the path from the true root of 'nodes'.
const findNodeAndBuildPath = (
  nodes: AccountNodeData[] | undefined,
  targetId: string,
  currentPath: string[] = []
): string[] | null => {
  // Returns the path (including targetId) or null if not found
  if (!nodes) return null;
  for (const node of nodes) {
    const newPath = [...currentPath, node.id];
    if (node.id === targetId) {
      return newPath;
    }
    if (node.children) {
      const pathInChildren = findNodeAndBuildPath(
        node.children,
        targetId,
        newPath
      );
      if (pathInChildren) {
        return pathInChildren;
      }
    }
  }
  return null;
};

export const getParentPathIds = (
  hierarchy: AccountNodeData[] | undefined,
  nodeId: string
): string[] => {
  if (!hierarchy || !nodeId) return [];
  const fullPathToNode = findNodeAndBuildPath(hierarchy, nodeId);
  if (fullPathToNode && fullPathToNode.length > 1) {
    return fullPathToNode.slice(0, -1); // Return all IDs in the path *except* the nodeId itself
  }
  return []; // No parents if it's a root node or not found
};

// Interface for journals after processing for display (with full path)
export interface JournalWithDisplayPath extends JournalForAdminSelection {
  displayPath: string;
}

// Internal helper to create a lookup map for efficient path building
interface JournalMapEntry extends JournalForAdminSelection {}
type JournalMap = Record<string, JournalMapEntry>;

const createJournalLookup = (
  journals: JournalForAdminSelection[]
): JournalMap => {
  const map: JournalMap = {};
  journals.forEach((j) => {
    map[j.id] = { ...j };
  });
  return map;
};

// Generates a display path for a single journal ID given a flat list and its map
// This could be used if you need to look up a path on demand for a single item.
export const getJournalDisplayPath = (
  journalId: string,
  allJournalsFlat: JournalForAdminSelection[],
  journalMap?: JournalMap // Optional: pass precomputed map for efficiency
): string => {
  const map = journalMap || createJournalLookup(allJournalsFlat);
  let current = map[journalId];
  if (!current) return "Unknown Journal";

  const path: string[] = [];
  while (current) {
    path.unshift(current.name); // Add name to the beginning of the path
    if (!current.parentId) break; // Reached a root node
    current = map[current.parentId];
    if (!current) break; // Parent not found (should not happen in a consistent dataset)
  }
  return path.join(" > ");
};

// Pre-calculates display paths for all journals and sorts them
export const generateJournalDisplayPaths = (
  journals: JournalForAdminSelection[]
): JournalWithDisplayPath[] => {
  if (!journals || journals.length === 0) return [];

  const journalMap = createJournalLookup(journals);
  const journalsWithPaths: JournalWithDisplayPath[] = [];

  const buildPath = (journalId: string): string => {
    let current = journalMap[journalId];
    const path: string[] = [];
    let depth = 0; // To prevent infinite loops in case of cyclic data (defensive)
    while (current && depth < 20) {
      // Max depth of 20
      path.unshift(current.name);
      if (!current.parentId) break;
      current = journalMap[current.parentId];
      if (!current) break;
      depth++;
    }
    if (depth >= 20)
      console.warn(
        `Max depth reached for journal ${journalId}. Path might be incomplete.`
      );
    return path.join(" > ");
  };

  journals.forEach((j) => {
    journalsWithPaths.push({
      ...j,
      displayPath: buildPath(j.id),
    });
  });

  // Sort by the display path for a more organized dropdown
  journalsWithPaths.sort((a, b) => a.displayPath.localeCompare(b.displayPath));
  return journalsWithPaths;
};
