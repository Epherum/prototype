// src/components/layout/UserAuthDisplay.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import styles from "./UserAuthDisplay.module.css"; // Assuming CSS module is in the same folder now
import type { ExtendedUser } from "@/app/api/auth/[...nextauth]/route"; // Import your ExtendedUser type

// Helper function to check permissions from session (can be moved to a shared util)
function hasPermission(
  sessionUser: ExtendedUser | undefined, // Allow undefined for safety
  action: string,
  resource: string
): boolean {
  if (!sessionUser?.roles) {
    return false;
  }
  return sessionUser.roles.some((role) =>
    role.permissions.some(
      (p) =>
        p.action.toUpperCase() === action.toUpperCase() &&
        p.resource.toUpperCase() === resource.toUpperCase()
    )
  );
}

interface UserAuthDisplayProps {
  onOpenCreateUserModal: () => void; // Callback to open the modal
}

export default function UserAuthDisplay({
  onOpenCreateUserModal,
}: UserAuthDisplayProps) {
  const { data: session, status } = useSession();

  const canManageUsers = hasPermission(
    session?.user as ExtendedUser,
    "MANAGE",
    "USERS"
  );

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
          {/* Optionally display company name or role here */}
          {/* <span className={styles.userCompany}>Company: {(session.user as ExtendedUser).companyId}</span> */}
        </span>

        {/* Conditionally render Create User button */}
        {canManageUsers && (
          <button
            onClick={onOpenCreateUserModal}
            className={`${styles.authButton} ${styles.createUserButton}`} // Added specific class for styling if needed
            title="Create a new user for your company"
          >
            Create User
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

  // If not authenticated (and not loading), typically this component might not render,
  // or it might render a Login button if on a public page.
  // Given it's in a protected app, this case might be rare after initial load.
  // If middleware handles redirect, this part might not even be reached.
  return (
    <div className={styles.authContainer}>
      <Link href="/login" className={styles.authButton}>
        Login
      </Link>
    </div>
  );
}
