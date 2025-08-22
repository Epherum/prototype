"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Image from "next/image";
import styles from "./UserAuthDisplay.module.css";
import { usePermissions } from "@/hooks/usePermissions";
import { ThemeSelector } from "@/components/shared/ThemeSelector";
import { useAppStore } from "@/store/appStore";

const revealVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // Stagger the two main groups
    },
  },
};

const itemRevealUpVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

interface UserAuthDisplayProps {
  onOpenCreateUserModal: () => void;
}

export default function UserAuthDisplay({
  onOpenCreateUserModal,
}: UserAuthDisplayProps) {
  const { data: session, status } = useSession();
  const { can: canManageUsers } = usePermissions({
    action: "MANAGE",
    resource: "USER",
  });
  const currentTheme = useAppStore((state) => state.currentTheme);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Function to get logo source based on theme
  const getLogoSource = () => {
    const isDark = currentTheme?.includes('dark') || false;
    return isDark ? "/insen_logo_dark.png" : "/insen_logo.png";
  };

  // Function to get logo filter based on theme accent color
  const getLogoFilter = () => {
    switch (currentTheme) {
      case 'light-orange':
      case 'dark-orange':
        return 'hue-rotate(-60deg) saturate(1.2)'; // Shift green more toward orange
      case 'light-blue':
      case 'dark-blue':
        return 'hue-rotate(180deg) saturate(1.1)'; // Shift green toward blue spectrum
      case 'light-pink':
      case 'dark-pink':
        return 'hue-rotate(-80deg) saturate(0.8)'; // Adjust towards pink from green base
      case 'light-green':
      case 'dark-green':
        return 'none'; // Keep the original green
      case 'light-purple':
      case 'dark-purple':
        return 'hue-rotate(-120deg) saturate(0.9)'; // Adjust towards purple from green base
      default:
        return 'none';
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;
      
      // Only proceed if we have a valid target
      if (!target) return;
      
      // Check if the click is outside the options dropdown
      if (isDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }
      
      // Check if the click is outside the user dropdown
      if (isUserDropdownOpen && userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setIsUserDropdownOpen(false);
      }
    };

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 480);
    };

    // Set initial mobile state
    handleResize();
    window.addEventListener('resize', handleResize);

    // Only add event listeners if dropdowns are open
    if (isDropdownOpen || isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, [isDropdownOpen, isUserDropdownOpen]);

  return (
    <motion.div variants={revealVariants} initial="hidden" animate="visible">
      <div className={styles.authContainer}>
        <AnimatePresence>
          {status === "loading" && (
            <motion.div
              key="loading-overlay"
              className={styles.stateOverlay}
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              Loading User...
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status !== "loading" && (
            <motion.div
              key={status}
              className={styles.authContainer}
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
            >
              {status === "authenticated" && session?.user ? (
                <>
                  {/* Logo on the left */}
                  <motion.div
                    variants={itemRevealUpVariants}
                    className={styles.logoContainer}
                  >
                    <Link href="/departments">
                      <Image
                        src={getLogoSource()}
                        alt="Insen Logo"
                        width={32}
                        height={32}
                        className={styles.logo}
                        style={{
                          filter: getLogoFilter()
                        }}
                      />
                    </Link>
                  </motion.div>

                  {/* Username dropdown in the middle */}
                  <motion.div
                    variants={itemRevealUpVariants}
                    className={styles.dropdownContainer}
                    ref={userDropdownRef}
                  >
                    <button
                      onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                      className={`${styles.userDropdownTrigger} ${styles.userName}`}
                      aria-expanded={isUserDropdownOpen}
                      aria-haspopup="true"
                    >
                      <span>{session.user.name || session.user.email}</span>
                      <svg
                        className={`${styles.dropdownArrow} ${isUserDropdownOpen ? styles.dropdownArrowOpen : ''}`}
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M3 4.5L6 7.5L9 4.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    
                    <AnimatePresence>
                      {isUserDropdownOpen && (
                        <motion.div
                          className={`${styles.dropdownMenu} ${styles.userDropdownMenu}`}
                          initial={{ 
                            opacity: 0, 
                            y: -10, 
                            scale: 0.95, 
                            x: isMobile ? 0 : "-50%" 
                          }}
                          animate={{ 
                            opacity: 1, 
                            y: 0, 
                            scale: 1, 
                            x: isMobile ? 0 : "-50%" 
                          }}
                          exit={{ 
                            opacity: 0, 
                            y: -10, 
                            scale: 0.95, 
                            x: isMobile ? 0 : "-50%" 
                          }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                        >
                          {canManageUsers && (
                            <button
                              onClick={() => {
                                onOpenCreateUserModal();
                                setIsUserDropdownOpen(false);
                              }}
                              className={styles.dropdownItem}
                            >
                              Manage Users
                            </button>
                          )}
                          <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className={styles.dropdownItem}
                          >
                            Logout
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Dropdown menu on the right */}
                  <motion.div
                    variants={itemRevealUpVariants}
                    className={styles.dropdownContainer}
                    ref={dropdownRef}
                  >
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={styles.dropdownTrigger}
                      aria-expanded={isDropdownOpen}
                      aria-haspopup="true"
                      aria-label="Theme options"
                    >
                      <svg
                        className={styles.settingsIcon}
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    
                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          className={styles.dropdownMenu}
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                        >
                          <ThemeSelector />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </>
              ) : (
                <>
                  {/* Logo for unauthenticated state */}
                  <motion.div
                    variants={itemRevealUpVariants}
                    className={styles.logoContainer}
                  >
                    <Image
                      src={getLogoSource()}
                      alt="Insen Logo"
                      width={32}
                      height={32}
                      className={styles.logo}
                      style={{
                        filter: getLogoFilter()
                      }}
                    />
                  </motion.div>
                  
                  {/* Spacer */}
                  <div className={styles.spacer} />
                  
                  {/* Login button on the right */}
                  <motion.div
                    variants={itemRevealUpVariants}
                    className={styles.buttonGroup}
                  >
                    <Link href="/login" className={styles.authButton}>
                      Login
                    </Link>
                  </motion.div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
