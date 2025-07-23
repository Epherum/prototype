"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import React from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import styles from "./UserAuthDisplay.module.css";
import { usePermissions } from "@/hooks/usePermissions";

const revealVariants: Variants = {
  hidden: { opacity: 0, x: -15 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
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
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
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
    resource: "USERS",
  });

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
              className={styles.authContainer} // Inherit flex layout
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
            >
              {status === "authenticated" && session?.user ? (
                <>
                  {/* Item 1: User Info */}
                  <motion.span
                    variants={itemRevealUpVariants}
                    className={styles.userInfo}
                  >
                    <span className={styles.userName}>
                      {session.user.name || session.user.email}
                    </span>
                  </motion.span>

                  {/* Item 2: Button Group */}
                  <motion.div
                    variants={itemRevealUpVariants}
                    className={styles.buttonGroup}
                  >
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
                  </motion.div>
                </>
              ) : (
                // For the unauthenticated state, the button group is just one item
                <motion.div
                  variants={itemRevealUpVariants}
                  className={styles.buttonGroup}
                  style={{ marginLeft: "auto" }} // Push to the right
                >
                  <Link href="/login" className={styles.authButton}>
                    Login
                  </Link>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
