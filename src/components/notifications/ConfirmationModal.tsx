// src/components/notifications/ConfirmationModal.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { IoClose, IoWarning, IoTrash, IoInformationCircle, IoCheckmarkCircle } from "react-icons/io5";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./ConfirmationModal.module.css";

export type ConfirmationType = "info" | "warning" | "danger";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmationType;
  isLoading?: boolean;
}

const confirmationIcons = {
  info: IoInformationCircle,
  warning: IoWarning,
  danger: IoTrash,
};

const modalVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const contentVariants = {
  hidden: { scale: 0.95, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "info",
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const IconComponent = confirmationIcons[type];

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <motion.div
      className={baseStyles.modalOverlay}
      variants={modalVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      onClick={onClose}
    >
      <motion.div
        className={baseStyles.modalContent}
        variants={contentVariants}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "450px" }}
      >
        <button
          className={baseStyles.modalCloseButton}
          onClick={onClose}
          disabled={isLoading}
          aria-label="Close"
        >
          <IoClose />
        </button>

        <div className={styles.confirmationContent}>
          <div className={`${styles.confirmationIcon} ${styles[type]}`}>
            <IconComponent />
          </div>

          <h3 className={styles.confirmationTitle}>
            {title}
          </h3>

          <p className={styles.confirmationMessage}>
            {message}
          </p>

          <div className={styles.confirmationActions}>
            <button
              className={`${styles.confirmationButton} ${styles.confirmationButtonSecondary}`}
              onClick={onClose}
              disabled={isLoading}
            >
              {cancelText}
            </button>
            
            <button
              className={`${styles.confirmationButton} ${
                type === "danger" 
                  ? styles.confirmationButtonDanger 
                  : styles.confirmationButtonPrimary
              }`}
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : confirmText}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};