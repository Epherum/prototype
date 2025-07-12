// src/features/documents/components/DocumentsOptionsMenu.tsx

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "@/features/shared/components/OptionsMenu.module.css"; // We can reuse the exact same styles
import { IoPencilOutline, IoTrashOutline, IoEyeOutline } from "react-icons/io5";
import { usePermissions } from "@/hooks/usePermissions";

interface DocumentsOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  selectedDocumentId: string | null;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const menuVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: { duration: 0.1, ease: "easeIn" },
  },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const DocumentsOptionsMenu: React.FC<DocumentsOptionsMenuProps> = ({
  isOpen,
  onClose,
  anchorEl,
  selectedDocumentId,
  onView,
  onEdit,
  onDelete,
}) => {
  const { can: canManageDocuments } = usePermissions({
    action: "MANAGE",
    resource: "DOCUMENT",
  });

  const menuStyle: React.CSSProperties | undefined = anchorEl
    ? {
        top: anchorEl.getBoundingClientRect().bottom + 8,
        left: anchorEl.getBoundingClientRect().left,
      }
    : undefined;

  return (
    <AnimatePresence>
      {isOpen && anchorEl && (
        <>
          <motion.div
            key="docs-options-overlay"
            className={styles.optionsOverlay}
            onClick={onClose}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          />
          <motion.div
            key="docs-options-menu"
            className={styles.optionsMenu}
            style={menuStyle}
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                if (selectedDocumentId) onView();
                onClose();
              }}
              disabled={!selectedDocumentId}
              className={styles.optionButton}
            >
              <IoEyeOutline /> View Details
            </button>
            {canManageDocuments && (
              <>
                <div className={styles.menuDivider} />
                <button
                  onClick={() => {
                    if (selectedDocumentId) onEdit();
                    onClose();
                  }}
                  disabled={!selectedDocumentId}
                  className={styles.optionButton}
                >
                  <IoPencilOutline /> Edit Selected
                </button>
                <button
                  onClick={() => {
                    if (selectedDocumentId) onDelete();
                    onClose();
                  }}
                  disabled={!selectedDocumentId}
                  className={`${styles.optionButton} ${styles.deleteButton}`}
                >
                  <IoTrashOutline /> Delete Selected
                </button>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DocumentsOptionsMenu;
