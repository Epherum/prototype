"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Image from "next/image";
import styles from "./UserAuthDisplay.module.css";
import { usePermissions } from "@/hooks/usePermissions";
import { ThemeSelector } from "@/components/shared/ThemeSelector";

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const [logoState, setLogoState] = useState<'light' | 'dark' | 'text'>('dark');
  const [isMobile, setIsMobile] = useState(false);

  const toggleLogo = () => {
    setLogoState(prev => {
      switch (prev) {
        case 'dark': return 'light';
        case 'light': return 'text';
        case 'text': return 'dark';
        default: return 'dark';
      }
    });
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
                    onClick={toggleLogo}
                  >
                    {logoState === 'text' ? (
                      <span className={styles.logoText}>Insen</span>
                    ) : (
                      <Image
                        src={logoState === 'dark' ? "/insen_logo_dark.jpg" : "/insen_logo.jpg"}
                        alt="Insen Logo"
                        width={32}
                        height={32}
                        className={styles.logo}
                      />
                    )}
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
                          <Link
                            href="/departments"
                            className={styles.dropdownItem}
                            onClick={() => setIsUserDropdownOpen(false)}
                          >
                            Departments
                          </Link>
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
                    >
                      <span>Options</span>
                      <svg
                        className={`${styles.dropdownArrow} ${isDropdownOpen ? styles.dropdownArrowOpen : ''}`}
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
                    onClick={toggleLogo}
                  >
                    {logoState === 'text' ? (
                      <span className={styles.logoText}>Insen</span>
                    ) : (
                      <Image
                        src={logoState === 'dark' ? "/insen_logo_dark.jpg" : "/insen_logo.jpg"}
                        alt="Insen Logo"
                        width={32}
                        height={32}
                        className={styles.logo}
                      />
                    )}
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
