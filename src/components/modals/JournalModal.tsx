// src/components/modals/JournalModal.js
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import baseStyles from "./ModalBase.module.css";
import styles from "./JournalModal.module.css";
import AccountNode from "./AccountNode"; // Assuming AccountNodeData type is implicitly handled or defined elsewhere
import { ROOT_JOURNAL_ID } from "@/lib/constants"; // Assuming this is your actual root ID constant
import { findNodeById } from "@/lib/helpers"; // If needed for getting selected node details

// Interface for props (if you were using TypeScript, good for clarity)
// interface JournalModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   onConfirmSelection: (selectedId: string, childToSelectInL2?: string | null) => void;
//   onSetShowRoot: () => void;
//   hierarchy: AccountNodeData[];
//   isLoading?: boolean;
//   onTriggerAddChild: (parentId: string | null, parentCode: string | null) => void;
//   onDeleteAccount: (accountId: string) => void;
//   onSelectForLinking?: (selectedNode: AccountNodeData) => void;
// }

function JournalModal({
  isOpen,
  onClose,
  onConfirmSelection,
  onSetShowRoot,
  hierarchy = [],
  onDeleteAccount,
  onTriggerAddChild,
  isLoading,
  onSelectForLinking, // New prop
  modalTitle,
}) {
  const [openNodes, setOpenNodes] = useState({});
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const conceptualRootId = hierarchy[0]?.id; // The ID of the conceptual root node passed in

  useEffect(() => {
    if (!isOpen) {
      setOpenNodes({});
      setSelectedAccountId(null);
    } else {
      // Auto-open and select the conceptual root when modal opens
      if (hierarchy.length > 0 && hierarchy[0]?.isConceptualRoot) {
        setOpenNodes({ [hierarchy[0].id]: true });
        // Don't auto-select the conceptual root for actual selection, let user click
        setSelectedAccountId(null);
      }
    }
  }, [isOpen, hierarchy]);

  const toggleNode = useCallback((nodeId) => {
    setOpenNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }, []);

  const handleSelectNode = useCallback((nodeId, node) => {
    // Pass the full node object
    // Do not allow selecting the conceptual root for any action
    if (node?.isConceptualRoot) {
      setSelectedAccountId(null);
      return;
    }
    setSelectedAccountId(nodeId);
    console.log(
      "JournalModal: Single Click - Selected Account Node ID:",
      nodeId
    );
  }, []);

  const handleDoubleClickNode = useCallback(
    (nodeId, nodeIsConceptualRoot, nodeIsActualL1, node) => {
      // Pass the full node object
      console.log(
        "JournalModal: Double Click on Node ID:",
        nodeId,
        "Is Linking:",
        !!onSelectForLinking
      );

      if (nodeIsConceptualRoot) {
        // Double-clicking "Show All" / Conceptual Root
        if (onSelectForLinking) {
          // In linking mode, double-clicking conceptual root does nothing for selection
          return;
        }
        if (onSetShowRoot) onSetShowRoot(); // For navigation, go to actual root
        onClose();
        return;
      }

      // If a valid node (not conceptual root) is double-clicked
      if (onSelectForLinking) {
        // In linking mode, a double click is treated like a selection and confirm
        if (node) {
          // Ensure node object is available
          onSelectForLinking(node);
          setSelectedAccountId(null); // Reset for next potential selection
          // Do NOT close the modal, allow multiple selections
        }
      } else {
        // In navigation mode, a double click confirms selection and closes
        if (onConfirmSelection) {
          onConfirmSelection(nodeId);
        }
        onClose();
      }
    },
    [onSetShowRoot, onConfirmSelection, onClose, onSelectForLinking]
  );

  // New handler for the main action button
  const handleConfirmOrAddToList = useCallback(() => {
    // Scenario 1: Linking mode (`onSelectForLinking` is provided)
    if (onSelectForLinking) {
      if (selectedAccountId) {
        // An item is actively selected via single-click
        const actualHierarchy = hierarchy[0]?.isConceptualRoot
          ? hierarchy[0].children
          : hierarchy;
        const selectedNode = findNodeById(
          actualHierarchy || [],
          selectedAccountId
        );

        if (selectedNode && !selectedNode.isConceptualRoot) {
          onSelectForLinking(selectedNode); // Pass the full node object
          setSelectedAccountId(null); // Clear internal selection for next potential pick
          // Modal closure is handled by the component calling onSelectForLinking
          // (e.g., page.tsx for GPG, or Link...Modals)
          return; // Action handled, exit function
        } else {
          // Selected item was conceptual root or not found (should be prevented by handleSelectNode)
          alert("Please select a valid journal account.");
          return; // Prevent further action
        }
      } else {
        // `onSelectForLinking` is active, but no item is currently single-clicked selected.
        // The "Add/Use Selected Journal" button might be disabled, or we can alert.
        alert(
          "Please click on a journal account in the list first to select it."
        );
        return; // Prevent further action
      }
    }

    // Scenario 2: Navigation mode (`onSelectForLinking` is NOT provided)
    // This button acts as "Confirm Selection" for navigation.
    if (onConfirmSelection) {
      if (selectedAccountId) {
        // If a specific node was single-clicked, confirm that one.
        const actualHierarchy = hierarchy[0]?.isConceptualRoot
          ? hierarchy[0].children
          : hierarchy;
        const selectedNode = findNodeById(
          actualHierarchy || [],
          selectedAccountId
        );
        if (selectedNode && !selectedNode.isConceptualRoot) {
          onConfirmSelection(selectedAccountId, null); // Second arg for childToSelectInL2, null here
        } else {
          // Fallback or if conceptual root was somehow selected for navigation (unlikely path)
          // Decide what ROOT_JOURNAL_ID means in your context if it's not part of hierarchyData
          // For safety, confirm the selectedTopLevelJournalId from journalManager if no specific node chosen
          // However, onConfirmSelection typically expects a node ID.
          // If `page.tsx` passes ROOT_JOURNAL_ID, that's what it'll use.
          onConfirmSelection(ROOT_JOURNAL_ID, null); // Default to root if no valid selection
        }
      } else {
        // No specific node single-clicked, confirm the "current view" or root.
        // The parent component (page.tsx's journalManager) usually handles what this means.
        // Often, it means confirming the current top-level selection or ROOT_JOURNAL_ID.
        onConfirmSelection(ROOT_JOURNAL_ID, null); // Default to root or current top-level view
      }
    }
    onClose(); // Close the modal in navigation mode after confirming
  }, [
    selectedAccountId,
    onSelectForLinking,
    onConfirmSelection,
    onClose,
    hierarchy,
    // ROOT_JOURNAL_ID, // If used as a fallback
  ]);

  if (!isOpen) return null;

  return (
    <motion.div
      className={baseStyles.modalOverlay}
      onClick={onClose}
      key="journal-modal-overlay"
      initial="closed"
      animate="open"
      exit="closed"
      variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className={`${baseStyles.modalContent} ${styles.journalModalContentSizing}`} // Added specific sizing class
        onClick={(e) => e.stopPropagation()}
        key="journal-modal-content"
        initial={{ opacity: 0, scale: 0.95, y: "2%" }}
        animate={{ opacity: 1, scale: 1, y: "0%" }}
        exit={{ opacity: 0, scale: 0.95, y: "2%" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <button
          className={baseStyles.modalCloseButton}
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>
        <h2 className={baseStyles.modalTitle}>
          {/* Use custom title if provided, else default based on mode */}
          {modalTitle
            ? modalTitle
            : onSelectForLinking
            ? "Select Journal(s) to Link"
            : "Manage & Select Journals"}
        </h2>

        {isLoading && (
          <div className={styles.loadingIndicator}>Loading Journals...</div>
        )}
        {!isLoading && (
          <div className={styles.accountHierarchyContainer}>
            {hierarchy.length > 0 ? (
              hierarchy.map(
                (
                  conceptualRootNode // Assumes hierarchy[0] is conceptual root
                ) => (
                  <AccountNode
                    key={conceptualRootNode.id}
                    node={conceptualRootNode}
                    level={0}
                    openNodes={openNodes}
                    toggleNode={toggleNode}
                    selectedAccountId={selectedAccountId}
                    onSelectNode={(nodeId, nodeObj) =>
                      handleSelectNode(nodeId, nodeObj)
                    } // Pass full node
                    onDoubleClickNode={(nodeId, isConceptual, isL1, nodeObj) =>
                      handleDoubleClickNode(nodeId, isConceptual, isL1, nodeObj)
                    } // Pass full node
                    onTriggerAddChildToNode={onTriggerAddChild}
                    onDeleteNode={onDeleteAccount}
                    conceptualRootId={conceptualRootId}
                    // Pass onSelectForLinking to AccountNode if it needs to change its behavior/appearance in linking mode
                    // isLinkingMode={!!onSelectForLinking}
                  />
                )
              )
            ) : (
              <p className={styles.noAccountsMessage}>
                No accounts to display.
              </p>
            )}
          </div>
        )}

        {/* Action Buttons Area */}
        {!isLoading && (
          <div className={baseStyles.modalActions}>
            <button
              type="button"
              onClick={onClose} // This button now consistently means "Cancel" or "Done with this modal view"
              className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
            >
              {onSelectForLinking ? "Done Selecting" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleConfirmOrAddToList}
              className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`}
              disabled={onSelectForLinking ? !selectedAccountId : false}
            >
              {onSelectForLinking
                ? selectedAccountId
                  ? "Use Selected Journal"
                  : "Select an Item"
                : "Confirm Selection"}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default JournalModal;
