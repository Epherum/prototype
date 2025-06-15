// src/hooks/useCurrentUser.ts

import { useSession } from "next-auth/react";
// IMPORTANT: Import both the user and the session types
import { ExtendedUser, ExtendedSession } from "@/lib/auth/authOptions";

export const useCurrentUser = (): ExtendedUser | null => {
  // Use a type assertion here to tell TS we know more about our session object
  const { data: session } = useSession() as { data: ExtendedSession | null };

  // This will now pass the type check because `session.user` is correctly typed as ExtendedUser
  return session?.user ?? null;
};
