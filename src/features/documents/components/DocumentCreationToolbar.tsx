// src/features/documents/components/DocumentCreationToolbar.tsx
"use client";

import styles from "./DocumentCreationToolbar.module.css";
import {
  IoCheckmarkDoneCircleOutline,
  IoCloseCircleOutline,
} from "react-icons/io5";

interface DocumentCreationToolbarProps {
  onFinish: () => void;
  onCancel: () => void; // --- ADD ONCANCEL PROP ---
}

const DocumentCreationToolbar: React.FC<DocumentCreationToolbarProps> = ({
  onFinish,
  onCancel, // --- DESTRUCTURE IT ---
}) => {
  return (
    <div className={styles.toolbarContainer}>
      {/* --- ADD CANCEL BUTTON --- */}
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
    </div>
  );
};

export default DocumentCreationToolbar;
