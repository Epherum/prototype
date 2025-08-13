/**
 * @file src/lib/helpers.ts
 * @description
 * A collection of client-side helper functions for processing and manipulating
 * hierarchical Journal data structures for UI components like trees and dropdowns.
 */

// =================================================================================
// --------------------------------- IMPORTS -------------------------------------
// =================================================================================

import type { AccountNodeData } from "@/lib/types/ui";
import type { Journal } from "@prisma/client"; // Assuming base type comes from Prisma

// =================================================================================
// ------------------------------ TYPE DEFINITIONS -------------------------------
// =================================================================================

/**
 * A type representing the raw Journal data structure as fetched for admin selections.
 * This should align with the return type of `journalService.getJournalsForAdminSelection`.
 */
export type JournalForAdminSelection = Omit<
  Journal,
  "createdAt" | "updatedAt"
> & {
  isSelectable: boolean;
};

/**
 * Enriches a journal with a pre-calculated `displayPath` string for UI dropdowns.
 */
export interface JournalWithDisplayPath extends JournalForAdminSelection {
  displayPath: string;
}

/**
 * Internal type for a map used for efficient lookups when building display paths.
 */
type JournalMap = Record<string, JournalForAdminSelection>;

// =================================================================================
// ------------------------ PRIMARY HIERARCHY BUILDERS ---------------------------
// =================================================================================

/**
 * Builds a nested tree structure from a flat list of journals.
 * The resulting tree is sorted by journal ID/code at each level.
 * @param journals - A flat array of Journal objects.
 * @returns An array of root-level AccountNodeData objects, each with nested children.
 */
export function buildTree(journals: Journal[]): AccountNodeData[] {
  const journalMap: Record<string, AccountNodeData> = {};
  const tree: AccountNodeData[] = [];

  // First pass: Create a map of all journals as AccountNodeData.
  journals.forEach((journal) => {
    journalMap[journal.id] = {
      id: journal.id,
      name: journal.name,
      code: journal.id, // or journal.code if available
      children: [],
    };
  });

  // Second pass: Link children to their parents.
  journals.forEach((journal) => {
    if (journal.parentId && journalMap[journal.parentId]) {
      if (!journalMap[journal.parentId].children) {
        journalMap[journal.parentId].children = [];
      }
      journalMap[journal.parentId].children!.push(journalMap[journal.id]);
    } else {
      tree.push(journalMap[journal.id]);
    }
  });

  // Helper to recursively sort children by code
  const sortChildren = (nodes: AccountNodeData[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((node) => {
      if (node.children?.length) {
        sortChildren(node.children);
      }
    });
  };

  sortChildren(tree);
  return tree;
}

/**
 * Takes a flat list of journals, generates a full "breadcrumb" display path for each,
 * and sorts the entire list alphabetically by that path.
 * @param journals - A flat array of journals for selection.
 * @returns A new array of JournalWithDisplayPath objects, sorted and ready for display.
 */
export const generateJournalDisplayPaths = (
  journals: JournalForAdminSelection[]
): JournalWithDisplayPath[] => {
  if (!journals || journals.length === 0) return [];

  const journalMap = createJournalLookup(journals);

  const buildPath = (journalId: string): string => {
    const path: string[] = [];
    let current = journalMap[journalId];
    let depth = 0; // Infinite loop guard

    while (current && depth < 20) {
      path.unshift(current.name);
      if (!current.parentId || !journalMap[current.parentId]) break;
      current = journalMap[current.parentId];
      depth++;
    }
    return path.join(" > ");
  };

  const journalsWithPaths: JournalWithDisplayPath[] = journals.map((j) => ({
    ...j,
    displayPath: buildPath(j.id),
  }));

  // Sort by the generated display path for a clean, organized list.
  journalsWithPaths.sort((a, b) => a.displayPath.localeCompare(b.displayPath));
  return journalsWithPaths;
};

/**
 * Returns the id of the first item in an array, or null if the array is empty.
 * Used for default selection logic in UI managers.
 */
export function getFirstId<T extends { id: string }>(arr: T[]): string | null {
  return arr.length > 0 ? arr[0].id : null;
}

// =================================================================================
// ----------------- HIERARCHY TRAVERSAL & SEARCH UTILITIES ----------------------
// =================================================================================

/**
 * Recursively finds a single node by its ID within a client-side tree structure.
 * @param nodes - The array of AccountNodeData to search within.
 * @param nodeId - The ID of the node to find.
 * @returns The found AccountNodeData object, or null if not found.
 */
export const findNodeById = (
  nodes: AccountNodeData[] | undefined,
  nodeId: string
): AccountNodeData | null => {
  if (!nodes || !nodeId) return null;
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    if (node.children?.length) {
      const foundInChildren = findNodeById(node.children, nodeId);
      if (foundInChildren) {
        return foundInChildren;
      }
    }
  }
  return null;
};

/**
 * Finds the parent of a given node within a client-side tree structure.
 * @param nodeId - The ID of the child node whose parent is sought.
 * @param hierarchy - The full tree to search within.
 * @returns The parent AccountNodeData object, or null if the node is a root or not found.
 */
export const findParentOfNode = (
  nodeId: string,
  hierarchy: AccountNodeData[]
): AccountNodeData | null => {
  if (!hierarchy || !nodeId) return null;

  // Internal recursive function
  const search = (
    nodes: AccountNodeData[],
    parent: AccountNodeData | null
  ): AccountNodeData | null | undefined => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return parent;
      }
      if (node.children?.length) {
        const result = search(node.children, node);
        // If the result is not 'undefined', it means we found our node.
        // The result itself is the parent (which could be an object or null).
        if (result !== undefined) {
          return result;
        }
      }
    }
    // Return 'undefined' to signal that we haven't found the node in this branch.
    return undefined;
  };

  const result = search(hierarchy, null);
  return result === undefined ? null : result;
};

/**
 * Gets all descendant IDs for a given parent ID from a client-side tree.
 * This function operates on data already in the browser.
 * @param nodes - The full hierarchy or sub-tree to search within.
 * @param parentId - The ID of the node whose descendants are needed.
 * @returns An array of strings representing the IDs of all descendant nodes.
 */
export const getDescendantIds = (
  nodes: AccountNodeData[] | undefined,
  parentId: string
): string[] => {
  if (!nodes) return [];

  const parentNode = findNodeById(nodes, parentId);
  if (!parentNode) return [];

  const allDescendantIds: string[] = [];
  const collect = (childNodes: AccountNodeData[]) => {
    for (const child of childNodes) {
      allDescendantIds.push(child.id);
      if (child.children?.length) {
        collect(child.children);
      }
    }
  };

  collect(parentNode.children);
  return allDescendantIds;
};

/**
 * Gets the path of parent IDs from the root of the tree down to a given node.
 * @param hierarchy - The full client-side tree.
 * @param nodeId - The ID of the node to find the path for.
 * @returns An array of parent IDs, e.g., ["root", "child", "grandchild"]. The array
 * will not include the `nodeId` itself.
 */
export const getParentPathIds = (
  hierarchy: AccountNodeData[] | undefined,
  nodeId: string
): string[] => {
  if (!hierarchy || !nodeId) return [];
  const fullPathToNode = findNodeAndBuildPath(hierarchy, nodeId);
  // Return the full path, excluding the last element (the node itself).
  return fullPathToNode ? fullPathToNode.slice(0, -1) : [];
};

// =================================================================================
// -------------------------- INTERNAL HELPER FUNCTIONS --------------------------
// =================================================================================

/**
 * @internal
 * Creates a lookup map from a flat array of journals for O(1) access by ID.
 * Used by `generateJournalDisplayPaths`.
 */
const createJournalLookup = (
  journals: JournalForAdminSelection[]
): JournalMap => {
  return journals.reduce((map, j) => {
    map[j.id] = j;
    return map;
  }, {} as JournalMap);
};

/**
 * @internal
 * Recursively searches for a node and returns the full path of IDs to it.
 * Used by `getParentPathIds`.
 */
const findNodeAndBuildPath = (
  nodes: AccountNodeData[],
  targetId: string,
  currentPath: string[] = []
): string[] | null => {
  for (const node of nodes) {
    const newPath = [...currentPath, node.id];
    if (node.id === targetId) {
      return newPath;
    }
    if (node.children?.length) {
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
