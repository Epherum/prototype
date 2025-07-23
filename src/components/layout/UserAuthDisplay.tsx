"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import React from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import styles from "./UserAuthDisplay.module.css";
import { usePermissions } from "@/hooks/usePermissions";

// Variants for the initial reveal of the component
const revealVariants: Variants = {
  hidden: { opacity: 0, y: -15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

// Variants for the overlay fade in/out
const overlayVariants: Variants = {
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
    resource: "USERS",
  });

  return (
    // This outer div handles the initial reveal animation
    <motion.div variants={revealVariants} initial="hidden" animate="visible">
      {/* 
        This is the STABLE layout container. It is always present and defines 
        the layout, border, and background.
      */}
      <div className={styles.authContainer}>
        <AnimatePresence>
          {status === "loading" && (
            <motion.div
              key="loading-overlay"
              className={styles.stateOverlay}
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              Loading User...
            </motion.div>
          )}
        </AnimatePresence>

        {/* The actual content is rendered here, it will be covered by the overlay */}
        {status === "authenticated" && session?.user ? (
          <>
            <span className={styles.userInfo}>
              <span className={styles.userName}>
                {session.user.name || session.user.email}
              </span>
            </span>
            {canManageUsers && (
              <button
                onClick={onOpenCreateUserModal}
                className={`${styles.authButton} ${styles.createUserButton}`}
                title="Create a new user"
              >
                + Create User
              </button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className={styles.authButton}
            >
              Logout
            </button>
          </>
        ) : (
          <Link href="/login" className={styles.authButton}>
            Login
          </Link>
        )}
      </div>
    </motion.div>
  );
}
