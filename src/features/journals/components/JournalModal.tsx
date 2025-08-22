import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./JournalModal.module.css";
import AccountNode from "./AccountNode";
import { ROOT_JOURNAL_ID } from "@/lib/constants";
import { findNodeById } from "@/lib/helpers";
import { AccountNodeData } from "@/lib/types/ui";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

// Define props interface for better type checking and to make certain props optional.
interface JournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  modalTitle?: string;
  hierarchy?: (AccountNodeData & {
    isConceptualRoot?: boolean;
    children?: AccountNodeData[];
  })[];
  isLoading?: boolean;
  zIndex?: number;
  onConfirmSelection?: (
    nodeId: string,
    childToSelectInL2?: string | null
  ) => void;
  onSetShowRoot?: () => void;
  onDeleteAccount?: (accountId: string) => void;
  onTriggerAddChild?: (parentId: string, parentCode: string) => void;
  onSelectForLinking?: (node: AccountNodeData) => void;
}

function JournalModal({
  isOpen,
  onClose,
  onConfirmSelection,
  onSetShowRoot,
  hierarchy = [],
  onDeleteAccount,
  onTriggerAddChild,
  isLoading,
  onSelectForLinking,
  modalTitle,
  zIndex,
}: JournalModalProps) {
  // Handle body scroll lock
  useBodyScrollLock(isOpen);
  
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const conceptualRootId = hierarchy[0]?.id;

  useEffect(() => {
    if (!isOpen) {
      setOpenNodes({});
      setSelectedAccountId(null);
    } else {
      if (hierarchy.length > 0 && (hierarchy[0] as any)?.isConceptualRoot) {
        setOpenNodes({ [hierarchy[0].id]: true });
        setSelectedAccountId(null);
      }
    }
  }, [isOpen, hierarchy]);

  const toggleNode = useCallback((nodeId: string) => {
    setOpenNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }, []);

  const handleSelectNode = useCallback(
    (nodeId: string, node?: AccountNodeData) => {
      if ((node as any)?.isConceptualRoot) {
        setSelectedAccountId(null);
        return;
      }
      setSelectedAccountId(nodeId);
    },
    []
  );

  const handleDoubleClickNode = useCallback(
    (
      nodeId: string,
      nodeIsConceptualRoot: boolean,
      nodeIsActualL1: boolean,
      node: AccountNodeData
    ) => {
      if (nodeIsConceptualRoot) {
        if (onSelectForLinking) return;
        if (onSetShowRoot) onSetShowRoot();
        onClose();
        return;
      }

      if (onSelectForLinking) {
        if (node) {
          onSelectForLinking(node);
          setSelectedAccountId(null);
        }
      } else if (onConfirmSelection) {
        onConfirmSelection(nodeId);
        onClose();
      }
    },
    [onSetShowRoot, onConfirmSelection, onClose, onSelectForLinking]
  );

  const handleConfirmOrAddToList = useCallback(() => {
    if (onSelectForLinking) {
      if (selectedAccountId) {
        const actualHierarchy = (hierarchy[0] as any)?.isConceptualRoot
          ? hierarchy[0].children
          : hierarchy;
        const selectedNode = findNodeById(
          actualHierarchy || [],
          selectedAccountId
        );

        if (selectedNode && !(selectedNode as any).isConceptualRoot) {
          onSelectForLinking(selectedNode);
          setSelectedAccountId(null);
          return;
        } else {
          alert("Please select a valid journal account.");
          return;
        }
      } else {
        alert(
          "Please click on a journal account in the list first to select it."
        );
        return;
      }
    }

    if (onConfirmSelection) {
      if (selectedAccountId) {
        const actualHierarchy = (hierarchy[0] as any)?.isConceptualRoot
          ? hierarchy[0].children
          : hierarchy;
        const selectedNode = findNodeById(
          actualHierarchy || [],
          selectedAccountId
        );
        if (selectedNode && !(selectedNode as any).isConceptualRoot) {
          onConfirmSelection(selectedAccountId, null);
        } else {
          onConfirmSelection(ROOT_JOURNAL_ID, null);
        }
      } else {
        onConfirmSelection(ROOT_JOURNAL_ID, null);
      }
    }
    onClose();
  }, [
    selectedAccountId,
    onSelectForLinking,
    onConfirmSelection,
    onClose,
    hierarchy,
  ]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`${baseStyles.modalOverlay} ${styles.journalModalOverlay}`}
          onClick={onClose}
          key="journal-modal-overlay"
          initial="closed"
          animate="open"
          exit="closed"
          variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
          style={zIndex ? { zIndex } : {}}
          transition={{ duration: 0.2 }}
        >
      <motion.div
        className={`${baseStyles.modalContent} ${styles.journalModalContentSizing}`}
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
              hierarchy.map((conceptualRootNode) => (
                <AccountNode
                  key={conceptualRootNode.id}
                  node={conceptualRootNode}
                  level={0}
                  openNodes={openNodes}
                  toggleNode={toggleNode}
                  selectedAccountId={selectedAccountId}
                  onSelectNode={handleSelectNode}
                  onDoubleClickNode={handleDoubleClickNode}
                  onTriggerAddChildToNode={onTriggerAddChild}
                  onDeleteNode={onDeleteAccount}
                  conceptualRootId={conceptualRootId}
                />
              ))
            ) : (
              <p className={styles.noAccountsMessage}>
                No accounts to display.
              </p>
            )}
          </div>
        )}

        {!isLoading && (
          <div className={baseStyles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
            >
              {onSelectForLinking ? "Done" : "Cancel"}
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
      )}
    </AnimatePresence>
  );

  // Ensure this code only runs on the client
  if (typeof window === "object") {
    return createPortal(modalContent, document.body);
  }
  return null;
}

export default JournalModal;
