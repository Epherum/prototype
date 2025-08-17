// src/store/slices/authSlice.ts

import { type Session } from "next-auth";
import { ROOT_JOURNAL_ID } from "@/lib/constants";
import type { AuthSlice, AuthActions, SessionStatus } from "../types";

// Initial auth state
export const getInitialAuthState = (): AuthSlice => ({
  sessionStatus: "loading" as SessionStatus,
  user: {},
  effectiveRestrictedJournalId: ROOT_JOURNAL_ID,
  isAdmin: false,
});

// Auth slice actions
export const createAuthActions = (set: any): AuthActions => ({
  setAuth: (session: Session | null, status: SessionStatus) =>
    set(() => {
      if (status === "authenticated" && session?.user) {
        const user = session.user as any; // Cast to handle extended user properties
        const restrictedJournalId = user.restrictedTopLevelJournalId || ROOT_JOURNAL_ID;
        const isAdmin = user.roles?.some((role: any) => role.role?.name === "admin") ?? false;

        return {
          sessionStatus: status,
          user,
          effectiveRestrictedJournalId: restrictedJournalId,
          isAdmin,
        };
      } else {
        return {
          sessionStatus: status,
          user: {},
          effectiveRestrictedJournalId: ROOT_JOURNAL_ID,
          isAdmin: false,
        };
      }
    }),
});