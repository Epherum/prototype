// src/features/documents/components/SingleItemQuantityModal.tsx
"use client";

import { useState, useEffect } from "react";
import { useModalHelpers } from "@/features/shared/modal";
import styles from "./SingleItemQuantityModal.module.css";
import type { GoodClient } from "@/lib/types/models.client";

interface SingleItemQuantityModalProps {
  onSubmit: (item: { good: GoodClient; quantity: number }) => void;
  good: GoodClient | null;
}

// This is no longer a modal component - just the content!
const SingleItemQuantityContent: React.FC<SingleItemQuantityModalProps & { onClose: () => void }> = ({
  onSubmit,
  good,
  onClose,
}) => {
  const [quantity, setQuantity] = useState(1);

  // Reset quantity when good changes
  useEffect(() => {
    if (good) {
      setQuantity(1);
    }
  }, [good]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (good && quantity > 0) {
      onSubmit({ good, quantity });
      onClose(); // Close the modal after successful submit
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.modalForm}>
      {!good && <p>Error: No good selected.</p>}
      {good && (
        <>
          <p className={styles.confirmationText}>
            Enter the quantity for: <strong>{good.label}</strong>
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
              disabled={quantity <= 0 || !good}
            >
              Confirm
            </button>
          </div>
        </>
      )}
    </form>
  );
};

// Hook to open the modal - much cleaner API!
export const useSingleItemQuantityModal = () => {
  const { showModal } = useModalHelpers();

  const openQuantityModal = (
    good: GoodClient | null,
    onSubmit: (item: { good: GoodClient; quantity: number }) => void
  ) => {
    let modalId: string;
    
    modalId = showModal({
      title: "Enter Quantity",
      width: 'sm',
      children: (
        <SingleItemQuantityContent
          good={good}
          onSubmit={onSubmit}
          onClose={() => {
            // Modal auto-closes when onClose is called
          }}
        />
      ),
    });

    return modalId;
  };

  return { openQuantityModal };
};

export default SingleItemQuantityContent;
