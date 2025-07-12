import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "@/features/shared/components/OptionsMenu.module.css";
import {
  IoAddCircleOutline,
  IoPencilOutline,
  IoTrashOutline,
} from "react-icons/io5";

interface ProjectsOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  selectedProjectId: string | null;
  onAdd: () => void;
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

const ProjectsOptionsMenu: React.FC<ProjectsOptionsMenuProps> = ({
  isOpen,
  onClose,
  anchorEl,
  selectedProjectId,
  onAdd,
}) => {
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
            key="projects-options-overlay"
            className={styles.optionsOverlay}
            onClick={onClose}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          />
          <motion.div
            key="projects-options-menu"
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
                onAdd();
                onClose();
              }}
              className={styles.optionButton}
            >
              <IoAddCircleOutline /> Add New Project
            </button>
            <button
              onClick={onClose} // Non-functional
              disabled={!selectedProjectId}
              className={styles.optionButton}
            >
              <IoPencilOutline /> Edit Selected
            </button>
            <button
              onClick={onClose} // Non-functional
              disabled={!selectedProjectId}
              className={`${styles.optionButton} ${styles.deleteButton}`}
            >
              <IoTrashOutline /> Delete Selected
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProjectsOptionsMenu;
