// src/components/layout/UserAuthDisplay.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import styles from "./UserAuthDisplay.module.css";
import { usePermissions } from "@/hooks/usePermissions"; // Import the centralized hook

interface UserAuthDisplayProps {
  onOpenCreateUserModal: () => void;
}

export default function UserAuthDisplay({
  onOpenCreateUserModal,
}: UserAuthDisplayProps) {
  const { data: session, status } = useSession();

  // This is the key change. Use the centralized hook.
  // It reads directly from the app's global state (Zustand).
  const { can: canManageUsers } = usePermissions({
    action: "MANAGE",
    resource: "USERS",
  });

  if (status === "loading") {
    return (
      <div className={styles.authContainer}>
        <div className={styles.loadingText}>Loading...</div>
      </div>
    );
  }

  if (status === "authenticated" && session?.user) {
    return (
      <div className={styles.authContainer}>
        <span className={styles.userInfo}>
          <span className={styles.userName}>
            {session.user.name || session.user.email}
          </span>
        </span>

        {/* This conditional rendering now uses the state from our clean hook */}
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
      </div>
    );
  }

  // Fallback for non-authenticated state
  return (
    <div className={styles.authContainer}>
      <Link href="/login" className={styles.authButton}>
        Login
      </Link>
    </div>
  );
}
