// src/store/index.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AppState } from "./types";

// Import slice creators
import { getInitialAuthState, createAuthActions } from "./slices/authSlice";
import { getInitialSelections, createSelectionsActions } from "./slices/selectionsSlice";
import { getInitialDocumentCreationState, createDocumentCreationActions } from "./slices/documentCreationSlice";
import { getInitialUiState, createUiActions } from "./slices/uiSlice";
import { getInitialThemeState, createThemeActions } from "./slices/themeSlice";

// ✅ OPTIMIZATION: Add state persistence for user preferences
interface PersistedState {
  sliderOrder?: string[];
  visibility?: Record<string, boolean>;
  currentTheme?: string;
}

// Create the main store with persistence
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
  // Create all action sets
  const authActions = createAuthActions(set);
  const selectionsActions = createSelectionsActions(set, get);
  const documentCreationActions = createDocumentCreationActions(set, get);
  const uiActions = createUiActions(set, get);
  const themeActions = createThemeActions(set);

  // Get initial states
  const initialAuth = getInitialAuthState();
  const initialUi = getInitialUiState();
  const initialTheme = getInitialThemeState();
  
  // Return the complete store state and actions
  return {
    // Auth state at root level
    sessionStatus: initialAuth.sessionStatus,
    user: initialAuth.user,
    effectiveRestrictedJournalId: initialAuth.effectiveRestrictedJournalId,
    isAdmin: initialAuth.isAdmin,
    
    // UI state at root level  
    sliderOrder: initialUi.sliderOrder,
    visibility: initialUi.visibility,
    accordionState: initialUi.accordionState,
    
    // Theme state at root level
    currentTheme: initialTheme.currentTheme,
    
    // Nested state objects
    ui: {
      ...initialUi,
      documentCreationState: getInitialDocumentCreationState(),
    },
    selections: getInitialSelections(initialAuth.effectiveRestrictedJournalId),

    // All actions
    ...authActions,
    ...selectionsActions,
    ...documentCreationActions,
    ...uiActions,
    ...themeActions,
  };
},
{
  name: 'erp-user-preferences',
  storage: createJSONStorage(() => localStorage),
  partialize: (state): PersistedState => ({
    // Only persist user preferences, not sensitive data
    sliderOrder: state.sliderOrder,
    visibility: state.visibility,
    currentTheme: state.currentTheme,
  }),
  // Merge persisted state safely
  merge: (persistedState, currentState) => {
    const persisted = persistedState as PersistedState;
    const mergedState: AppState = { ...currentState };
    if (persisted?.sliderOrder) mergedState.sliderOrder = persisted.sliderOrder;
    if (persisted?.visibility) mergedState.visibility = persisted.visibility;
    if (persisted?.currentTheme) mergedState.currentTheme = persisted.currentTheme as any;
    return mergedState;
  },
  // Skip hydration during SSR
  skipHydration: true,
}
)
);

// Export types for consumers
export type * from "./types";

// Re-export specific types that are commonly used
export type { 
  SliderType, 
  SliderVisibility, 
  DocumentCreationMode,
  SessionStatus,
  ThemeType
} from "./types";

// Note: Memoized selectors can be added later when needed for specific components