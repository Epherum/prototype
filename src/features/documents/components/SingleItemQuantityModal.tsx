// src/features/documents/components/SingleItemQuantityModal.tsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchGoodById } from "@/services/clientGoodService";
import { goodKeys } from "@/lib/queryKeys";
import styles from "./SingleItemQuantityModal.module.css";
import type { Good } from "@/lib/types";

// Assume fetchGoodById exists in your client service. If not:
// export async function fetchGoodById(id: string): Promise<Good> {
//   const response = await fetch(`/api/goods/${id}`);
//   if (!response.ok) throw new Error("Failed to fetch good details");
//   return response.json();
// }

interface SingleItemQuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (item: { good: Good; quantity: number }) => void;
  goodId: string | null;
}

const SingleItemQuantityModal: React.FC<SingleItemQuantityModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  goodId,
}) => {
  const [quantity, setQuantity] = useState(1);

  const goodQuery = useQuery({
    queryKey: goodKeys.detail(goodId!),
    queryFn: () => fetchGoodById(goodId!),
    enabled: isOpen && !!goodId,
    staleTime: Infinity,
  });

  // Reset quantity when modal opens for a new item
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goodQuery.data && quantity > 0) {
      onSubmit({ good: goodQuery.data, quantity });
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

            {goodQuery.isLoading && <p>Loading good details...</p>}
            {goodQuery.isError && <p>Error loading good details.</p>}
            {goodQuery.data && (
              <form onSubmit={handleSubmit} className={styles.modalForm}>
                <p className={styles.confirmationText}>
                  Enter the quantity for:{" "}
                  <strong>{goodQuery.data.label || goodQuery.data.name}</strong>
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
                    autoFocus
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
                    disabled={quantity <= 0 || goodQuery.isLoading}
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
