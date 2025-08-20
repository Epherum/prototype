// src/hooks/useThemeInitializer.ts

import { useEffect } from "react";
import { useAppStore } from "@/store";

export function useThemeInitializer() {
  const { currentTheme, setTheme } = useAppStore();

  useEffect(() => {
    // Apply the current theme from store to the document
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", currentTheme);
    }
  }, [currentTheme]);

  useEffect(() => {
    // Initialize theme on mount - this will load from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("app-theme");
      if (stored && ["light-orange", "light-blue", "dark-orange", "dark-blue"].includes(stored)) {
        setTheme(stored as any);
      }
    }
  }, [setTheme]);
}