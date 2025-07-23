"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./DropdownMenu.module.css";

export interface DropdownAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface DropdownMenuProps {
  actions: DropdownAction[];
  trigger: React.ReactNode;
  isCreating?: boolean;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  actions,
  trigger,
  isCreating,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => setIsOpen(false), []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClose]);

  const handleActionClick = (action: DropdownAction) => {
    if (!action.disabled) {
      action.onClick();
      handleClose();
    }
  };

  return (
    <div className={styles.dropdownContainer} ref={menuRef}>
      <button
        ref={triggerRef}
        className={styles.triggerButton}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        disabled={isCreating}
      >
        {trigger}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.ul
            className={styles.menuList}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {actions.map((action) => (
              <li key={action.label}>
                <button
                  className={styles.menuItem}
                  onClick={() => handleActionClick(action)}
                  disabled={action.disabled}
                >
                  {action.label}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};
