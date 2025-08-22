// src/features/documents/components/SingleItemQuantityModal.tsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./SingleItemQuantityModal.module.css";
// ✅ CHANGED: Import the correct client-side model
import type { GoodClient } from "@/lib/types/models.client";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface SingleItemQuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ✅ CHANGED: onSubmit now expects a GoodClient
  onSubmit: (item: { good: GoodClient; quantity: number }) => void;
  good: GoodClient | null;
}

const SingleItemQuantityModal: React.FC<SingleItemQuantityModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  good,
}) => {
  // Handle body scroll lock
  useBodyScrollLock(isOpen);
  
  const [quantity, setQuantity] = useState(1);

  // No need to fetch - we already have the good data from the slider

  // Reset quantity when modal opens for a new item
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (good && quantity > 0) {
      onSubmit({ good, quantity });
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.modalOverlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose} // Close on overlay click
        >
          <motion.div
            className={styles.modalContent}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside content
          >
            <button
              onClick={onClose}
              className={styles.modalCloseButton}
              aria-label="Close modal"
            >
              ×
            </button>
            <h2 className={styles.modalTitle}>Enter Quantity</h2>

            {!good && <p>Error: No good selected.</p>}
            {good && (
              <form onSubmit={handleSubmit} className={styles.modalForm}>
                <p className={styles.confirmationText}>
                  Enter the quantity for:{" "}
                  <strong>{good.label}</strong>
                </p>
                <div className={styles.formGroup}>
                  <label htmlFor="quantity">Quantity</label>
                  <input
                    id="quantity"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    min="1"
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`${styles.modalActionButton} ${styles.cancelButton}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`${styles.modalActionButton} ${styles.confirmButton}`}
                    disabled={quantity <= 0 || !good}
                  >
                    Confirm
                  </button>
                </div>
              </form>
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
};

export default SingleItemQuantityModal;
