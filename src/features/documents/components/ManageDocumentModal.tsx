// src/features/documents/components/ManageDocumentModal.tsx

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./ManageDocumentModal.module.css"; // We will create this file next
import type { Document, UpdateDocumentClientData } from "@/lib/types";

interface ManageDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: UpdateDocumentClientData) => void;
  document: Document | null | undefined;
  isLoading: boolean;
  isSaving: boolean;
  isViewOnly: boolean;
}

// Re-using the animation variants from the confirmation modal
const modalVariants = {
  open: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { delay: 0.05, duration: 0.25 },
  },
  closed: {
    opacity: 0,
    scale: 0.95,
    y: "5%",
    transition: { duration: 0.2 },
  },
};

const overlayVariants = {
  open: { opacity: 1 },
  closed: { opacity: 0 },
};

export const ManageDocumentModal: React.FC<ManageDocumentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  document,
  isLoading,
  isSaving,
  isViewOnly,
}) => {
  const [formData, setFormData] = useState<UpdateDocumentClientData>({});

  useEffect(() => {
    if (document) {
      setFormData({
        refDoc: document.refDoc || "",
        // Convert date string to YYYY-MM-DD for the input[type="date"]
        date: document.date
          ? new Date(document.date).toISOString().split("T")[0]
          : "",
      });
    }
  }, [document]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  const getTitle = () => {
    if (isViewOnly) return "Document Details";
    return document ? "Edit Document" : "New Document";
  };

  return (
    <motion.div
      className={baseStyles.modalOverlay}
      key="manage-doc-overlay"
      initial="closed"
      animate="open"
      exit="closed"
      variants={overlayVariants}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className={baseStyles.modalContent}
        onClick={(e) => e.stopPropagation()}
        key="manage-doc-content"
        variants={modalVariants}
      >
        <button className={baseStyles.modalCloseButton} onClick={onClose}>
          ×
        </button>
        <h2 className={baseStyles.modalTitle}>{getTitle()}</h2>

        {isLoading ? (
          <div className={styles.loader}>Loading...</div>
        ) : !document ? (
          <div className={styles.error}>Document data not found.</div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="refDoc">Reference</label>
              <input
                id="refDoc"
                name="refDoc"
                type="text"
                value={formData.refDoc || ""}
                onChange={handleChange}
                readOnly={isViewOnly}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="date">Date</label>
              <input
                id="date"
                name="date"
                type="date"
                value={formData.date || ""}
                onChange={handleChange}
                readOnly={isViewOnly}
                required
              />
            </div>
            <div className={baseStyles.modalActions}>
              <button
                type="button"
                className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
                onClick={onClose}
              >
                {isViewOnly ? "Close" : "Cancel"}
              </button>
              {!isViewOnly && (
                <button
                  type="submit"
                  className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              )}
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
};
