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
  const handleConfirmOrAddToList = () => {
    if (!selectedAccountId) {
      // No node is actively selected by single click
      if (onSelectForLinking) {
        alert("Please select a journal account to add to the list.");
      } else {
        // If not linking, and nothing is selected, maybe select ROOT (if that's desired UX)
        // Or simply do nothing / disable button. For now, let's assume selecting ROOT_JOURNAL_ID
        if (onConfirmSelection) onConfirmSelection(ROOT_JOURNAL_ID);
        onClose();
      }
      return;
    }

    // Find the full node object for the selectedAccountId
    // We need to search within the actual children of the conceptual root
    const actualHierarchy = hierarchy[0]?.isConceptualRoot
      ? hierarchy[0].children
      : hierarchy;
    const selectedNode = findNodeById(actualHierarchy || [], selectedAccountId);

    if (!selectedNode) {
      console.error(
        "Selected node not found in hierarchy for ID:",
        selectedAccountId
      );
      return;
    }

    if (selectedNode.isConceptualRoot) {
      // Should not happen if handleSelectNode prevents it
      return;
    }

    if (onSelectForLinking) {
      onSelectForLinking(selectedNode);
      setSelectedAccountId(null); // Clear selection for next pick
      // Do NOT close the JournalModal, LinkPartnerToJournalsModal will handle that via its own "Done" button or this modal's main close.
    } else {
      // Original navigation behavior
      onConfirmSelection(selectedAccountId);
      onClose();
    }
  };

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
          {onSelectForLinking
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
              onClick={onClose}
              className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
            >
              {onSelectForLinking ? "Done Selecting" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleConfirmOrAddToList}
              className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`}
              // Corrected disabled logic:
              disabled={
                onSelectForLinking
                  ? !selectedAccountId // In linking mode, disable if nothing is selected
                  : false // In navigation mode, this button ("Confirm Selection") is generally always enabled,
                // or relies on selectedAccountId for its action if nothing is selected (e.g. confirming root).
                // If you want it disabled in nav mode when nothing is selected, use: !selectedAccountId
              }
            >
              {onSelectForLinking
                ? selectedAccountId
                  ? "Add Selected Journal"
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
