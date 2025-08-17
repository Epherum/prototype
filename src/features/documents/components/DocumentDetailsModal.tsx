// src/features/documents/components/DocumentDetailsModal.tsx

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./DocumentDetailsModal.module.css";
import { DocumentClient } from "@/lib/types/models.client";
import { IoDocumentTextOutline, IoCalendarOutline, IoPersonOutline, IoReceiptOutline } from "react-icons/io5";

interface DocumentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentClient | null;
  isLoading?: boolean;
}


const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const DocumentDetailsModal: React.FC<DocumentDetailsModalProps> = ({
  isOpen,
  onClose,
  document,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const calculateLineTotal = (quantity: string, unitPrice: string, discountPercentage: string = "0") => {
    const qty = parseFloat(quantity);
    const price = parseFloat(unitPrice);
    const discount = parseFloat(discountPercentage);
    const subtotal = qty * price;
    const discountAmount = subtotal * (discount / 100);
    return subtotal - discountAmount;
  };

  const calculateDocumentTotal = () => {
    if (!document?.lines) return 0;
    return document.lines.reduce((total, line) => {
      const lineTotal = calculateLineTotal(
        line.quantity.toString(),
        line.unitPrice.toString(),
        line.discountPercentage?.toString()
      );
      return total + lineTotal;
    }, 0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={baseStyles.modalOverlay}
          key="doc-details-modal-overlay"
          initial="closed"
          animate="open"
          exit="closed"
          variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
          transition={{ duration: 0.2 }}
          style={{ zIndex: 1002 }}
          onClick={onClose}
        >
          <motion.div
            className={`${baseStyles.modalContent} ${styles.wideModal}`}
            onClick={(e) => e.stopPropagation()}
            key="doc-details-modal-content"
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
            <h2 className={baseStyles.modalTitle}>
              <IoDocumentTextOutline style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Document Details
              {document && (
                <div className={styles.subtitle}>
                  {document.refDoc} • {formatDate(document.date)}
                </div>
              )}
            </h2>

            <div className={styles.contentContainer}>
              {isLoading ? (
                <div className={styles.loading}>Loading document details...</div>
              ) : document ? (
                <>
                  <div className={styles.headerInfo}>
                    <div className={styles.documentInfo}>
                      <h3 className={styles.sectionTitle}>
                        <IoDocumentTextOutline style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                        Document Information
                      </h3>
                      <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>
                            <IoReceiptOutline style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            Reference
                          </span>
                          <span className={styles.value}>{document.refDoc}</span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Type</span>
                          <span className={styles.value}>{document.type}</span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>
                            <IoCalendarOutline style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            Date
                          </span>
                          <span className={styles.value}>{formatDate(document.date)}</span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Status</span>
                          <span className={`${styles.value} ${styles.status} ${styles[document.state.toLowerCase()]}`}>
                            {document.state}
                          </span>
                        </div>
                        {document.description && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Description</span>
                            <span className={styles.value}>{document.description}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {document.partner && (
                      <div className={styles.partnerInfo}>
                        <h3 className={styles.sectionTitle}>
                          <IoPersonOutline style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                          Partner Information
                        </h3>
                        <div className={styles.infoGrid}>
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Name</span>
                            <span className={styles.value}>{document.partner.name}</span>
                          </div>
                          {document.partner.registrationNumber && (
                            <div className={styles.infoItem}>
                              <span className={styles.label}>Registration #</span>
                              <span className={styles.value}>{document.partner.registrationNumber}</span>
                            </div>
                          )}
                          {document.partner.taxId && (
                            <div className={styles.infoItem}>
                              <span className={styles.label}>Tax ID</span>
                              <span className={styles.value}>{document.partner.taxId}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {document.lines && document.lines.length > 0 && (
                    <div className={styles.lineItemsSection}>
                      <h3 className={styles.sectionHeader}>
                        <span>Line Items</span>
                        <span>Total: {formatCurrency(calculateDocumentTotal())}</span>
                      </h3>
                      <div className={styles.lineItemsList}>
                        {document.lines.map((line) => (
                          <div key={line.id} className={styles.lineItem}>
                            <div className={styles.lineItemHeader}>
                              <span className={styles.itemName}>{line.designation}</span>
                              <span className={styles.lineItemTotal}>
                                {formatCurrency(
                                  calculateLineTotal(
                                    line.quantity.toString(),
                                    line.unitPrice.toString(),
                                    line.discountPercentage?.toString()
                                  )
                                )}
                              </span>
                            </div>
                            <div className={styles.lineItemDetails}>
                              <span>
                                <strong>{parseFloat(line.quantity.toString()).toLocaleString()}</strong>
                                {line.unitOfMeasure && ` ${line.unitOfMeasure}`}
                              </span>
                              <span>×</span>
                              <span>{formatCurrency(line.unitPrice.toString())}</span>
                              {line.discountPercentage && parseFloat(line.discountPercentage.toString()) > 0 && (
                                <span className={styles.discount}>
                                  -{parseFloat(line.discountPercentage.toString())}% off
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.error}>
                  Unable to load document details. Please try again.
                </div>
              )}
            </div>
            
            <div className={baseStyles.modalActions}>
              <button
                type="button"
                className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DocumentDetailsModal;