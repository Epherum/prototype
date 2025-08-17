//src/features/journals/components/AccountNode.tsx
import {
  IoChevronDownOutline,
  IoChevronForwardOutline,
  IoAddCircleOutline,
  IoTrashBinOutline,
} from "react-icons/io5";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./JournalModal.module.css";

// Helper function to capitalize only the first letter
const capitalizeFirstLetter = (text: string): string => {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

function AccountNode({
  node,
  level = 0,
  openNodes,
  toggleNode,
  selectedAccountId,
  onSelectNode,
  onDoubleClickNode,
  onTriggerAddChildToNode,
  onDeleteNode,
  conceptualRootId,
}) {
  const isOpen =
    openNodes[node.id] ?? (level === 0 && node.id === conceptualRootId);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedAccountId;
  const isConceptualRootNode = node.id === conceptualRootId;
  const isActualL1Account = level === 1 && !isConceptualRootNode;

  const handleRowSingleClick = (e) => {
    if (e.target.closest(`.${styles.accountNodeToggle}`)) {
      e.stopPropagation();
      return;
    }
    onSelectNode(node.id, node);
  };

  const handleRowDoubleClick = () => {
    if (onDoubleClickNode) {
      onDoubleClickNode(node.id, isConceptualRootNode, isActualL1Account, node);
    }
  };

  const handleToggleIconClick = (e) => {
    e.stopPropagation();
    if (hasChildren) {
      toggleNode(node.id);
    }
  };

  const handleAddChildClick = (e) => {
    e.stopPropagation();
    if (onTriggerAddChildToNode) {
      onTriggerAddChildToNode(node.id, node.code);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (isConceptualRootNode) return;
    if (onDeleteNode) {
      if (
        window.confirm(
          `Are you sure you want to delete "${node.code} - ${capitalizeFirstLetter(node.name)}"? This will also delete all its sub-accounts.`
        )
      ) {
        onDeleteNode(node.id);
      }
    }
  };
  const indentSize = 15;

  return (
    <>
      <div
        className={`${styles.accountNodeRow} ${
          isSelected ? styles.accountNodeSelected : ""
        }`}
        style={{ paddingLeft: `${level * indentSize}px` }}
        onClick={handleRowSingleClick}
        onDoubleClick={handleRowDoubleClick}
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isOpen : undefined}
      >
        <span
          className={styles.accountNodeToggle}
          onClick={handleToggleIconClick}
          role="button"
          tabIndex={-1}
          aria-hidden="true"
        >
          {hasChildren ? (
            isOpen ? (
              <IoChevronDownOutline />
            ) : (
              <IoChevronForwardOutline />
            )
          ) : (
            <span className={styles.accountNodeIconPlaceholder}></span>
          )}
        </span>
        <span className={styles.accountNodeCode}>{node.code}</span>
        <span className={styles.accountNodeName}>{capitalizeFirstLetter(node.name)}</span>

        <div className={styles.accountNodeActions}>
          {isSelected && onTriggerAddChildToNode && (
            <button
              onClick={handleAddChildClick}
              className={`${styles.accountNodeActionButton} ${styles.accountNodeAddChildButton}`}
              title={`Add sub-account to ${capitalizeFirstLetter(node.name)}${
                isConceptualRootNode ? " (New Top-Level)" : ""
              }`}
            >
              <IoAddCircleOutline />
            </button>
          )}
          {isSelected && !isConceptualRootNode && onDeleteNode && (
            <button
              onClick={handleDeleteClick}
              className={`${styles.accountNodeActionButton} ${styles.accountNodeDeleteButton}`}
              title={`Delete account ${capitalizeFirstLetter(node.name)}`}
            >
              <IoTrashBinOutline />
            </button>
          )}
        </div>
      </div>
      <div className={styles.accountNodeChildrenContainer}>
        <AnimatePresence initial={false}>
          {hasChildren && isOpen && (
            <motion.div
              key={`${node.id}-children`}
              initial="collapsed"
              animate="open"
              exit="collapsed"
              variants={{
                open: { opacity: 1, height: "auto" },
                collapsed: { opacity: 0, height: 0 },
              }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{
                overflow: "hidden",
                position: "relative",
              }}
              className={styles.accountNodeChildrenMotionWrapper}
            >
              {node.children.map((childNode) => (
                <AccountNode
                  key={childNode.id}
                  node={childNode}
                  level={level + 1}
                  openNodes={openNodes}
                  toggleNode={toggleNode}
                  selectedAccountId={selectedAccountId}
                  onSelectNode={onSelectNode}
                  onDoubleClickNode={onDoubleClickNode}
                  onTriggerAddChildToNode={onTriggerAddChildToNode}
                  onDeleteNode={onDeleteNode}
                  conceptualRootId={conceptualRootId}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default AccountNode;
