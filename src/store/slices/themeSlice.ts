// src/store/slices/themeSlice.ts

import type { ThemeType, ThemeSlice, ThemeActions } from "../types";

function getStoredTheme(): ThemeType {
  if (typeof window === 'undefined') return "light-orange";
  
  const stored = localStorage.getItem('app-theme');
  if (stored && ['light-orange', 'light-blue', 'dark-orange', 'dark-blue', 'light-pink', 'light-green', 'dark-pink', 'dark-green'].includes(stored)) {
    return stored as ThemeType;
  }
  return "light-orange";
}

export function getInitialThemeState(): ThemeSlice {
  return {
    currentTheme: getStoredTheme(),
  };
}

export function createThemeActions(set: any): ThemeActions {
  return {
    setTheme: (theme: ThemeType) => {
      set({ currentTheme: theme });
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('app-theme', theme);
      }
      
      // Apply theme to document
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }
    },
  };
}