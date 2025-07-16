"use client";

import { motion } from "framer-motion";
import styles from "./DocumentCreationToolbar.module.css";
import {
  IoCheckmarkDoneCircleOutline,
  IoCloseCircleOutline,
} from "react-icons/io5";

interface DocumentCreationToolbarProps {
  onFinish: () => void;
  onCancel: () => void;
}

const DocumentCreationToolbar: React.FC<DocumentCreationToolbarProps> = ({
  onFinish,
  onCancel,
}) => {
  return (
    // This motion.div is the container our CSS will style
    <motion.div
      className={styles.toolbarContainer}
      initial={{ y: "150%", opacity: 0 }}
      animate={{ y: "0%", opacity: 1 }}
      exit={{ y: "150%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <button
        onClick={onCancel}
        className={`${styles.toolbarButton} ${styles.cancelButton}`}
        title="Cancel document creation"
      >
        <IoCloseCircleOutline />
        Cancel
      </button>
      <button
        onClick={onFinish}
        className={`${styles.toolbarButton} ${styles.finishButton}`}
        title="Finalize and save document"
      >
        <IoCheckmarkDoneCircleOutline />
        Finish Document
      </button>
    </motion.div>
  );
};

export default DocumentCreationToolbar;
