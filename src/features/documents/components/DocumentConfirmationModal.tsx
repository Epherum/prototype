import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

// Import styles
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./DocumentConfirmationModal.module.css";
import type { Document, Good } from "@/lib/types";

// --- NEW --- Define more specific props
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onValidate: (data: {
    refDoc: string;
    date: Date;
    type: Document["type"];
  }) => void;
  goods: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    amount: number;
  }[];
  isLoading: boolean;
  isDestructive?: boolean;
  title?: string;
  message?: string;
  confirmButtonText?: string;
}

export const DocumentConfirmationModal = ({
  isOpen,
  onClose,
  onValidate,
  goods,
  isLoading,
  isDestructive = false,
  title = "Finalize Document",
  confirmButtonText = "Validate Document",
  message, // Allow optional message
}: ConfirmationModalProps) => {
  // --- NEW --- State to manage the form inputs for the document header
  const [refDoc, setRefDoc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]); // Default to today
  const [type, setType] = useState<Document["type"]>("INVOICE");

  // Reset form when the modal is opened
  useEffect(() => {
    if (isOpen) {
      setRefDoc("");
      setDate(new Date().toISOString().split("T")[0]);
      setType("INVOICE");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- MODIFIED --- The handler now collects state and calls onValidate with it
  const handleValidateClick = () => {
    if (!refDoc) {
      alert("Please enter a document reference.");
      return;
    }
    onValidate({ refDoc, date: new Date(date), type });
  };

  const totalAmount = (goods || [])
    .reduce((acc, good) => acc + good.amount, 0)
    .toFixed(2);

  return (
    <motion.div
      className={baseStyles.modalOverlay}
      key="doc-confirm-modal-overlay"
      initial="closed"
      animate="open"
      exit="closed"
      variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
      transition={{ duration: 0.2 }}
      style={{ zIndex: 1002 }}
      onClick={onClose}
    >
      <motion.div
        className={baseStyles.modalContent}
        onClick={(e) => e.stopPropagation()}
        key="doc-confirm-modal-content"
        variants={{
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
        }}
      >
        <button
          className={baseStyles.modalCloseButton}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className={baseStyles.modalTitle}>{title}</h2>

        {message && <p className={styles.confirmationMessage}>{message}</p>}

        {/* --- NEW --- Form for document header */}
        <div className={styles.formSection}>
          <div className={styles.formGroup}>
            <label htmlFor="refDoc">Reference</label>
            <input
              id="refDoc"
              type="text"
              value={refDoc}
              onChange={(e) => setRefDoc(e.target.value)}
              placeholder="e.g., INV-2025-001"
              className={baseStyles.formInput} // Using a generic form input style
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={baseStyles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="type">Type</label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as Document["type"])}
              className={baseStyles.formInput}
            >
              <option value="INVOICE">Invoice</option>
              <option value="CREDIT_NOTE">Credit Note</option>
              <option value="QUOTE">Quote</option>
            </select>
          </div>
        </div>

        {/* Section for displaying goods remains */}
        {goods && goods.length > 0 && (
          <div className={styles.confirmationSection}>
            <h3>
              Summary ({goods.length} items) - Total: ${totalAmount}
            </h3>
            <ul className={styles.confirmationGoodsList}>
              {goods.map((good) => (
                <li key={good.id}>
                  <span>{good.name}</span>
                  <span className={styles.lineItemDetails}>
                    {good.quantity} x ${good.price?.toFixed(2)} = $
                    {good.amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={baseStyles.modalActions}>
          <button
            type="button"
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            // --- MODIFIED --- Calls the new handler
            onClick={handleValidateClick}
            className={`${baseStyles.modalActionButton} ${
              isDestructive
                ? baseStyles.modalButtonDestructive
                : baseStyles.modalButtonPrimary
            }`}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : confirmButtonText}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Exporting as both default and named for flexibility
export default DocumentConfirmationModal;
