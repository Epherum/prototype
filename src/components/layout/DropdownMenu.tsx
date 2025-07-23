// src/components/layout/DropdownMenu.tsx

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

// A professional, non-spring ease-out curve
const gentleEase = [0.22, 1, 0.36, 1];

// Variants for the menu container to stagger its children
const menuVariants = {
  hidden: {
    opacity: 0,
    transition: {
      when: "afterChildren",
      staggerChildren: 0.04,
      staggerDirection: -1,
    },
  },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.05,
    },
  },
};

// Variants for each individual menu item
const itemVariants = {
  hidden: {
    y: -10,
    opacity: 0,
    transition: { duration: 0.2, ease: gentleEase },
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: gentleEase },
  },
};

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

      {isOpen && (
        <motion.ul
          className={styles.menuList}
          variants={menuVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {actions.map((action) => (
            <motion.li key={action.label} variants={itemVariants}>
              <button
                className={styles.menuItem}
                onClick={() => handleActionClick(action)}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
};
