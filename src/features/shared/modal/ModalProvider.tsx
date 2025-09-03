"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import styles from './ModalProvider.module.css';

interface ModalConfig {
  id: string;
  component: ReactNode;
  onClose?: () => void;
  className?: string;
  overlayClassName?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

interface ModalContextType {
  openModal: (config: Omit<ModalConfig, 'id'>) => string;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [modals, setModals] = useState<ModalConfig[]>([]);
  
  // Lock body scroll when any modal is open
  useBodyScrollLock(modals.length > 0);

  const openModal = (config: Omit<ModalConfig, 'id'>): string => {
    const id = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const modalConfig: ModalConfig = {
      id,
      closeOnOverlayClick: true,
      closeOnEscape: true,
      ...config,
    };
    
    setModals(prev => [...prev, modalConfig]);
    return id;
  };

  const closeModal = (id: string) => {
    setModals(prev => {
      const modal = prev.find(m => m.id === id);
      if (modal?.onClose) {
        modal.onClose();
      }
      return prev.filter(m => m.id !== id);
    });
  };

  const closeAllModals = () => {
    modals.forEach(modal => {
      if (modal.onClose) modal.onClose();
    });
    setModals([]);
  };

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modals.length > 0) {
        const topModal = modals[modals.length - 1];
        if (topModal.closeOnEscape !== false) {
          closeModal(topModal.id);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [modals]);

  return (
    <ModalContext.Provider value={{ openModal, closeModal, closeAllModals }}>
      {children}
      
      {/* Modal Layer - Always rendered at app level, no portals needed */}
      <div className={styles.modalLayer}>
        <AnimatePresence mode="multiple">
          {modals.map((modal, index) => (
            <motion.div
              key={modal.id}
              className={`${styles.modalOverlay} ${modal.overlayClassName || ''}`}
              style={{ zIndex: 1000 + index }} // Stack modals properly
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={modal.closeOnOverlayClick !== false ? () => closeModal(modal.id) : undefined}
            >
              <motion.div
                className={`${styles.modalContainer} ${modal.className || ''}`}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
              >
                {modal.component}
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ModalContext.Provider>
  );
};