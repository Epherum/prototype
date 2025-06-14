"use client";

import styles from "./DocumentCreationToolbar.module.css";

interface DocumentCreationToolbarProps {
  onFinish: () => void;
}

const DocumentCreationToolbar: React.FC<DocumentCreationToolbarProps> = ({
  onFinish,
}) => {
  return (
    <div className={styles.finishDocumentContainer}>
      <button onClick={onFinish} className={styles.finishDocumentButton}>
        Finish Document & Review
      </button>
    </div>
  );
};

export default DocumentCreationToolbar;
