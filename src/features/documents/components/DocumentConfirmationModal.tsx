// src/features/documents/components/DocumentConfirmationModal.tsx
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

// Import styles
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./DocumentConfirmationModal.module.css";

// ✅ CHANGED: Import the Zod schema payload type for strong typing
import type { CreateDocumentPayload } from "@/lib/schemas/document.schema";

// --- Prop definitions ---
// ✅ CHANGED: onValidate uses a Pick from the Zod payload for header data
type DocumentHeaderData = Pick<
  CreateDocumentPayload,
  "refDoc" | "date" | "type"
>;

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onValidate: (data: DocumentHeaderData) => void;
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
  confirmButtonText?: string;
  message?: string;
  // Multiple document workflow props
  currentPartner?: { id: string; name: string; email?: string };
  totalDocuments?: number;
  currentDocumentIndex?: number;
  allPartners?: Array<{ id: string; name: string; email?: string }>;
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
  message,
  currentPartner,
  totalDocuments,
  currentDocumentIndex,
  allPartners,
}: ConfirmationModalProps) => {
  const [refDoc, setRefDoc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  // ✅ CHANGED: The type is now correctly inferred from the payload type
  const [type, setType] = useState<CreateDocumentPayload["type"]>("INVOICE");

  useEffect(() => {
    if (isOpen) {
      setRefDoc("");
      setDate(new Date().toISOString().split("T")[0]);
      setType("INVOICE");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onValidate({ refDoc: refDoc || null, date: new Date(date), type });
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
        <button className={baseStyles.modalCloseButton} onClick={onClose}>
          ×
        </button>
        <h2 className={baseStyles.modalTitle}>{title}</h2>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalLayout}>
            <div className={styles.formContainer}>
              {/* Document Creation Information */}
              {currentPartner && (
                <div className={styles.multiDocumentInfo}>
                  {/* Multiple Document Workflow Progress - only show for multi-document mode */}
                  {totalDocuments && currentDocumentIndex !== undefined && (
                    <div className={styles.progressSection}>
                      <div className={styles.progressHeader}>
                        <h3>Multiple Document Creation</h3>
                        <span className={styles.progressBadge}>
                          {currentDocumentIndex + 1} of {totalDocuments}
                        </span>
                      </div>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${
                              ((currentDocumentIndex + 1) / totalDocuments) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Partner Information - always show when partner is available */}
                  <div className={styles.currentPartnerSection}>
                    <h4>Creating document for:</h4>
                    <div className={styles.partnerCard}>
                      <div className={styles.partnerName}>
                        {currentPartner.name}
                      </div>
                      {currentPartner.email && (
                        <div className={styles.partnerEmail}>
                          {currentPartner.email}
                        </div>
                      )}
                      <div className={styles.partnerId}>
                        ID: {currentPartner.id}
                      </div>
                    </div>
                    {totalDocuments && totalDocuments > 1 ? (
                      <div className={styles.referenceNote}>
                        <strong>Note:</strong> Please enter a unique reference
                        for this partner's document below.
                      </div>
                    ) : (
                      <div className={styles.referenceNote}>
                        <strong>Note:</strong> Please enter a reference for this
                        document below.
                      </div>
                    )}
                  </div>

                  {/* All Partners List - only show for multi-document mode */}
                  {allPartners &&
                    allPartners.length > 1 &&
                    totalDocuments &&
                    currentDocumentIndex !== undefined && (
                      <div className={styles.allPartnersSection}>
                        <h4>All Selected Partners:</h4>
                        <div className={styles.partnersList}>
                          {allPartners.map((partner, index) => (
                            <div
                              key={partner.id}
                              className={`${styles.partnerChip} ${
                                index === currentDocumentIndex
                                  ? styles.currentPartnerChip
                                  : ""
                              } ${
                                index < currentDocumentIndex
                                  ? styles.completedPartnerChip
                                  : ""
                              }`}
                            >
                              {index < currentDocumentIndex && "✓ "}
                              {partner.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {message && (
                <div className={styles.messageSection}>
                  <p>{message}</p>
                </div>
              )}

              <div className={styles.formSection}>
                <div className={styles.formGroup}>
                  <label htmlFor="refDoc">Reference (Optional)</label>
                  <input
                    id="refDoc"
                    type="text"
                    value={refDoc || ""}
                    onChange={(e) => setRefDoc(e.target.value)}
                    placeholder="e.g., INV-2025-001"
                    className={styles.formInput}
                    autoFocus
                  />
                </div>
                <div className={styles.formGroupGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="date">Date</label>
                    <input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className={styles.formInput}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="type">Type</label>
                    <select
                      id="type"
                      value={type}
                      // ✅ CHANGED: Type cast is now strongly typed
                      onChange={(e) =>
                        setType(e.target.value as CreateDocumentPayload["type"])
                      }
                      className={styles.formInput}
                    >
                      <option value="INVOICE">Invoice</option>
                      <option value="QUOTE">Quote</option>
                      <option value="PURCHASE_ORDER">Purchase Order</option>
                      <option value="CREDIT_NOTE">Credit Note</option>
                    </select>
                  </div>
                </div>
              </div>

              {goods && goods.length > 0 && (
                <div className={styles.confirmationSection}>
                  <h3 className={styles.sectionHeader}>
                    <span>Summary</span>
                    <span>Total: ${totalAmount}</span>
                  </h3>
                  <ul className={styles.confirmationGoodsList}>
                    {goods.map((good) => (
                      <li key={good.id}>
                        <span className={styles.itemName}>{good.name}</span>
                        <span className={styles.lineItemDetails}>
                          {good.quantity} x ${good.price?.toFixed(2)} ={" "}
                          <strong>${good.amount.toFixed(2)}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className={styles.footerActions}>
              <button
                type="button"
                className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`}
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : confirmButtonText}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default DocumentConfirmationModal;
