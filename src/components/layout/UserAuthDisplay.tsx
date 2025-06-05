// src/components/auth/UserAuthDisplay.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import styles from "./UserAuthDisplay.module.css"; // We'll create this CSS module

export default function UserAuthDisplay() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className={styles.authContainer}>
        <div className={styles.loadingText}>Loading user...</div>
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
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={styles.authButton}
        >
          Logout
        </button>
      </div>
    );
  }
}
