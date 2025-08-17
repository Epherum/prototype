// src/hooks/useAuthStoreInitializer.ts
"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useAppStore } from "@/store/appStore";

/**
 * A headless hook that initializes and syncs the Zustand auth slice with the NextAuth session.
 * This should be called once in a top-level client component (e.g., page.tsx or a layout).
 * It does not render any UI.
 */
export const useAuthStoreInitializer = () => {
  const { data: session, status } = useSession();
  const setAuth = useAppStore((state) => state.setAuth);
  const wasSet = useAppStore((state) => state.sessionStatus !== "loading");

  useEffect(() => {
    // We only want to set the auth state if it has changed, or if it's the initial load.
    // This prevents unnecessary re-renders if the session object reference changes but the status is the same.
    if (status !== useAppStore.getState().sessionStatus) {
      setAuth(session, status);
    }
  }, [session, status, setAuth]);

  // This hook has no return value as it's purely for side effects.
  return null;
};
