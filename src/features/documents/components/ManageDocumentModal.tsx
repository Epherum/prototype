// src/features/documents/components/ManageDocumentModal.tsx
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./ManageDocumentModal.module.css";
// ✅ CHANGED: Import the new, correct types
import type { DocumentClient } from "@/lib/types/models.client";
import type { UpdateDocumentPayload } from "@/lib/schemas/document.schema";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface ManageDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ✅ CHANGED: onSave now uses the Zod-inferred payload type
  onSave: (data: UpdateDocumentPayload) => void;
  // ✅ CHANGED: document prop is now the client-side model
  document: DocumentClient | null | undefined;
  isLoading: boolean;
  isSaving: boolean;
  isViewOnly: boolean;
}

const modalVariants = {
  open: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { delay: 0.05, duration: 0.25 },
  },
  closed: { opacity: 0, scale: 0.95, y: "5%", transition: { duration: 0.2 } },
};
const overlayVariants = { open: { opacity: 1 }, closed: { opacity: 0 } };

export const ManageDocumentModal: React.FC<ManageDocumentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  document,
  isLoading,
  isSaving,
  isViewOnly,
}) => {
  // Handle body scroll lock
  useBodyScrollLock(isOpen);
  
  // ✅ CHANGED: State is now correctly typed
  const [formData, setFormData] = useState<UpdateDocumentPayload>({});

  useEffect(() => {
    if (document) {
      setFormData({
        refDoc: document.refDoc || undefined,
        date: document.date
          ? new Date(document.date).toISOString().split("T")[0]
          : undefined,
        description: document.description || undefined,
        paymentMode: document.paymentMode || undefined,
        state: document.state || undefined,
      });
    }
  }, [document]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
    return "Edit Document";
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
          {" "}
          ×{" "}
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
                placeholder="Document reference number"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="date">Date</label>
              <input
                id="date"
                name="date"
                type="date"
                value={
                  typeof formData.date === 'string' 
                    ? formData.date 
                    : formData.date instanceof Date 
                      ? formData.date.toISOString().split("T")[0]
                      : ""
                }
                onChange={handleChange}
                readOnly={isViewOnly}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description || ""}
                onChange={handleChange}
                readOnly={isViewOnly}
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="paymentMode">Payment Mode</label>
              <input
                id="paymentMode"
                name="paymentMode"
                type="text"
                value={formData.paymentMode || ""}
                onChange={handleChange}
                readOnly={isViewOnly}
                placeholder="e.g., Cash, Credit Card, Bank Transfer"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="state">Document Status</label>
              <select
                id="state"
                name="state"
                value={formData.state || ""}
                onChange={handleChange}
                disabled={isViewOnly}
              >
                <option value="">Select Status</option>
                <option value="DRAFT">Draft</option>
                <option value="FINALIZED">Finalized</option>
                <option value="PAID">Paid</option>
                <option value="VOID">Void</option>
              </select>
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
