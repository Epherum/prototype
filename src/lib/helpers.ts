import { AccountNodeData } from "@/lib/types";

// --- Helper: Find Node in Hierarchy ---
export const findNodeById = (nodes, nodeId) => {
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
