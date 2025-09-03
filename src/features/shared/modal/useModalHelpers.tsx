"use client";

import { useModal } from './ModalProvider';
import styles from './ModalHelpers.module.css';

// Common modal patterns
export const useModalHelpers = () => {
  const { openModal, closeModal } = useModal();

  // Confirmation modal
  const showConfirmation = (config: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }) => {
    return openModal({
      component: (
        <div className={styles.confirmModal}>
          <h3 className={styles.confirmTitle}>{config.title}</h3>
          <p className={styles.confirmMessage}>{config.message}</p>
          <div className={styles.confirmActions}>
            <button 
              className={`${styles.confirmButton} ${styles.cancelButton}`}
              onClick={() => {
                config.onCancel?.();
                // Modal will auto-close via onClose
              }}
            >
              {config.cancelText || 'Cancel'}
            </button>
            <button 
              className={`${styles.confirmButton} ${styles.primaryButton}`}
              onClick={() => {
                config.onConfirm();
                // Modal will auto-close via onClose
              }}
            >
              {config.confirmText || 'Confirm'}
            </button>
          </div>
        </div>
      ),
      onClose: () => config.onCancel?.(),
    });
  };

  // Alert modal
  const showAlert = (config: {
    title: string;
    message: string;
    buttonText?: string;
    onClose?: () => void;
  }) => {
    return openModal({
      component: (
        <div className={styles.alertModal}>
          <h3 className={styles.alertTitle}>{config.title}</h3>
          <p className={styles.alertMessage}>{config.message}</p>
          <div className={styles.alertActions}>
            <button 
              className={`${styles.alertButton} ${styles.primaryButton}`}
              onClick={() => {
                config.onClose?.();
                // Modal will auto-close via onClose
              }}
            >
              {config.buttonText || 'OK'}
            </button>
          </div>
        </div>
      ),
      onClose: config.onClose,
    });
  };

  // Custom modal with standard wrapper
  const showModal = (config: {
    title?: string;
    children: React.ReactNode;
    onClose?: () => void;
    className?: string;
    showCloseButton?: boolean;
    width?: 'sm' | 'md' | 'lg' | 'xl';
  }) => {
    const widthClass = config.width ? styles[`width${config.width.toUpperCase()}`] : styles.widthMD;
    
    return openModal({
      component: (
        <div className={`${styles.standardModal} ${widthClass} ${config.className || ''}`}>
          {config.showCloseButton !== false && (
            <button 
              className={styles.closeButton}
              onClick={() => config.onClose?.()}
              aria-label="Close modal"
            >
              ×
            </button>
          )}
          {config.title && (
            <h2 className={styles.modalTitle}>{config.title}</h2>
          )}
          <div className={styles.modalContent}>
            {config.children}
          </div>
        </div>
      ),
      onClose: config.onClose,
    });
  };

  return {
    showConfirmation,
    showAlert,
    showModal,
    openModal,
    closeModal,
  };
};