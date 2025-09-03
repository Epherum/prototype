// src/app/providers.tsx (or a similar client component)
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeInitializer } from "@/components/layout/ThemeInitializer";
import { SessionValidator } from "@/components/auth/SessionValidator";
import { ToastProvider } from "@/contexts/ToastContext";
import { ToastContainer } from "@/components/notifications/ToastContainer";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ThemeInitializer />
          <SessionValidator />
          {children}
          <ToastContainer />
          <ReactQueryDevtools initialIsOpen={false} />
        </ToastProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
