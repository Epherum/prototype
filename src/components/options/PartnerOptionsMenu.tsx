// src/components/options/PartnerOptionsMenu.tsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./PartnerOptionsMenu.module.css";
import {
  IoAddCircleOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoLinkOutline,
} from "react-icons/io5";

interface PartnerOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  selectedPartnerId: string | null;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLinkToJournals: () => void; // New prop
  onUnlinkFromJournals: () => void; // +++ NEW PROP
}

const menuVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" }, // Smoother ease for enter
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: { duration: 0.1, ease: "easeIn" }, // Quicker ease for exit
  },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const PartnerOptionsMenu: React.FC<PartnerOptionsMenuProps> = ({
  isOpen,
  onClose,
  anchorEl,
  selectedPartnerId,
  onAdd,
  onEdit,
  onDelete,
  onLinkToJournals,
  onUnlinkFromJournals, // +++ DESTRUCTURE
}) => {
  // Calculate style only if anchorEl exists
  const menuStyle: React.CSSProperties | undefined = anchorEl
    ? {
        position: "absolute",
        top: anchorEl.getBoundingClientRect().bottom + window.scrollY + 8,
        left: anchorEl.getBoundingClientRect().left + window.scrollX,
      }
    : undefined;

  return (
    <AnimatePresence>
      {isOpen &&
        anchorEl && ( // Ensure anchorEl is present before attempting to render
          <>
            {/* Animated Overlay */}
            <motion.div
              key="options-overlay" // Stable key for the overlay
              className={styles.optionsOverlay}
              onClick={onClose}
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            />

            {/* Animated Menu */}
            <motion.div
              key="options-menu" // Stable key for the menu
              className={styles.optionsMenu}
              style={menuStyle} // Apply calculated style
              variants={menuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  onAdd();
                  onClose();
                }}
                className={styles.optionButton}
              >
                <IoAddCircleOutline /> Add New Partner
              </button>
              <button
                onClick={() => {
                  if (selectedPartnerId) {
                    onEdit();
                  }
                  onClose();
                }}
                disabled={!selectedPartnerId}
                className={styles.optionButton}
              >
                <IoPencilOutline /> Edit Selected
              </button>
              <button
                onClick={() => {
                  if (selectedPartnerId) {
                    onDelete();
                  }
                  onClose();
                }}
                disabled={!selectedPartnerId}
                className={`${styles.optionButton} ${styles.deleteButton}`}
              >
                <IoTrashOutline /> Delete Selected
              </button>
              <div className={styles.menuDivider} /> {/* Optional divider */}
              <button
                onClick={() => {
                  onLinkToJournals();
                  onClose();
                }}
                disabled={!selectedPartnerId} // Only needs a partner to be selected
                className={styles.optionButton}
              >
                <IoLinkOutline /> Link to a Journal
              </button>
              <button
                onClick={() => {
                  onUnlinkFromJournals();
                  onClose();
                }}
                disabled={!selectedPartnerId} // Only needs a partner to be selected
                className={styles.optionButton}
              >
                <IoLinkOutline /> Unlink from Journals
              </button>
            </motion.div>
          </>
        )}
    </AnimatePresence>
  );
};

export default PartnerOptionsMenu;
