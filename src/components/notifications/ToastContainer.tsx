// src/components/notifications/ToastContainer.tsx
"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IoClose, IoCheckmarkCircle, IoWarning, IoInformationCircle, IoAlert } from "react-icons/io5";
import { useToast, type Toast, type ToastType } from "@/contexts/ToastContext";
import styles from "./ToastContainer.module.css";

const toastIcons: Record<ToastType, React.ComponentType> = {
  success: IoCheckmarkCircle,
  error: IoAlert,
  warning: IoWarning,
  info: IoInformationCircle,
};

const toastVariants = {
  initial: {
    opacity: 0,
    x: 100,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    x: 100,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    },
  },
};

interface ToastItemProps {
  toast: Toast;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast }) => {
  const { removeToast } = useToast();
  const [progress, setProgress] = useState(100);
  const IconComponent = toastIcons[toast.type];

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;

    const startTime = Date.now();
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, toast.duration! - elapsed);
      const progressPercent = (remaining / toast.duration!) * 100;
      
      setProgress(progressPercent);
      
      if (remaining > 0) {
        requestAnimationFrame(updateProgress);
      }
    };
    
    updateProgress();
  }, [toast.duration]);

  const handleClose = () => {
    removeToast(toast.id);
  };

  return (
    <motion.div
      className={`${styles.toast} ${styles[toast.type]}`}
      variants={toastVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      <div className={styles.toastIcon}>
        <IconComponent />
      </div>
      
      <div className={styles.toastContent}>
        <div className={styles.toastTitle}>
          {toast.title}
        </div>
        {toast.message && (
          <p className={styles.toastMessage}>
            {toast.message}
          </p>
        )}
      </div>

      {toast.isClosable && (
        <button
          className={styles.toastCloseButton}
          onClick={handleClose}
          aria-label="Close notification"
        >
          <IoClose />
        </button>
      )}

      {toast.duration && toast.duration > 0 && (
        <div 
          className={styles.toastProgressBar}
          style={{ width: `${progress}%` }}
        />
      )}
    </motion.div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  return (
    <div className={styles.toastContainer}>
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};