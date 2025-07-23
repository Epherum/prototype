"use client";

import React, { useState, useRef } from "react";
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

// FIX: New variants copied from the OptionsMenu components for consistency.
// This animates the entire menu as a single block.
const menuVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: { duration: 0.1, ease: "easeIn" },
  },
};

// FIX: Added overlay variants for the background dimmer effect.
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  actions,
  trigger,
  isCreating,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // FIX: Simplified closing logic. The overlay now handles clicks outside.
  const handleClose = () => setIsOpen(false);

  // FIX: The useEffect for 'click outside' is no longer needed.

  const handleActionClick = (action: DropdownAction) => {
    if (!action.disabled) {
      action.onClick();
      handleClose();
    }
  };

  return (
    // FIX: Changed container from div with menuRef to just div.
    <div className={styles.dropdownContainer}>
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

      {/* FIX: Wrap the entire conditional render in AnimatePresence */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* FIX: Added the overlay div */}
            <motion.div
              key="dropdown-overlay"
              className={styles.overlay}
              onClick={handleClose}
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            />
            {/* FIX: Changed motion.ul to motion.div and applied new variants */}
            <motion.div
              className={styles.menuList}
              variants={menuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              // Stop clicks inside the menu from closing it
              onClick={(e) => e.stopPropagation()}
            >
              {/* FIX: Removed motion from the li. No more staggering. */}
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
