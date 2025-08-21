"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef } from "react";
import type { ExtendedSession } from "@/lib/auth/authOptions";

export function SessionValidator() {
  const { data: session, status } = useSession();
  const hasValidated = useRef(false);

  useEffect(() => {
    const validateSession = async () => {
      const extendedSession = session as ExtendedSession;
      // Only validate once when we first get a session
      if (status !== "authenticated" || !extendedSession?.user?.id || hasValidated.current) {
        return;
      }

      hasValidated.current = true;

      try {
        // Make a simple API call to check if the user still exists
        const response = await fetch('/api/users/validate-session', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 401) {
          // User no longer exists, log them out
          console.warn('Session user no longer exists in database, logging out...');
          await signOut({ callbackUrl: '/login' });
        }
      } catch (error) {
        console.error('Error validating session:', error);
        // On error, also log out to be safe
        await signOut({ callbackUrl: '/login' });
      }
    };

    validateSession();
  }, [status]); // Only depend on status, not session object

  // This component doesn't render anything
  return null;
}