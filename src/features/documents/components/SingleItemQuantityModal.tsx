// src/features/documents/components/SingleItemQuantityModal.tsx
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoClose } from "react-icons/io5";
import styles from "./SingleItemQuantityModal.module.css";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { GoodClient } from "@/lib/types/models.client";

interface SingleItemQuantityModalProps {
  isOpen: boolean;
  onSubmit: (item: { good: GoodClient; quantity: number; price: number }) => void;
  onClose: () => void;
  good: GoodClient | null;
}

const SingleItemQuantityModal: React.FC<SingleItemQuantityModalProps> = ({
  isOpen,
  onSubmit,
  onClose,
  good,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  
  // Lock body scroll when modal is open
  useBodyScrollLock(isOpen);

  // Reset quantity and price when good changes
  useEffect(() => {
    if (good) {
      setQuantity(1);
      setPrice(0);
    }
  }, [good]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (good && quantity > 0 && price >= 0) {
      onSubmit({ good, quantity, price });
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={styles.modalOverlay} onClick={onClose}>
          <motion.div 
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add Item to Document</h2>
              <button
                type="button"
                onClick={onClose}
                className={styles.closeButton}
                aria-label="Close modal"
              >
                <IoClose />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalForm}>
              {!good && <p className={styles.errorText}>Error: No good selected.</p>}
              {good && (
                <>
                  <div className={styles.productInfo}>
                    <h3 className={styles.productName}>{good.label}</h3>
                    {good.description && (
                      <p className={styles.productDescription}>{good.description}</p>
                    )}
                    {good.barcode && (
                      <p className={styles.productBarcode}>Barcode: {good.barcode}</p>
                    )}
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="quantity" className={styles.label}>
                      Quantity:
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        id="quantity"
                        type="number"
                        min="1"
                        step="1"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                        className={styles.quantityInput}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="price" className={styles.label}>
                      Unit Price:
                    </label>
                    <div className={styles.inputWrapper}>
                      <span className={styles.currency}>$</span>
                      <input
                        id="price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                        className={styles.priceInput}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {quantity > 0 && price >= 0 && (
                    <div className={styles.totalInfo}>
                      <span className={styles.totalLabel}>Total: </span>
                      <span className={styles.totalAmount}>${(quantity * price).toFixed(2)}</span>
                    </div>
                  )}

                  <div className={styles.modalActions}>
                    <button 
                      type="button" 
                      onClick={onClose} 
                      className={styles.cancelButton}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className={styles.confirmButton}
                      disabled={quantity <= 0 || price < 0 || !good}
                    >
                      Add Item
                    </button>
                  </div>
                </>
              )}
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SingleItemQuantityModal;