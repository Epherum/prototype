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
