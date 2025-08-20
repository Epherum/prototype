// src/store/index.ts

import { create } from "zustand";
import type { AppState } from "./types";

// Import slice creators
import { getInitialAuthState, createAuthActions } from "./slices/authSlice";
import { getInitialSelections, createSelectionsActions } from "./slices/selectionsSlice";
import { getInitialDocumentCreationState, createDocumentCreationActions } from "./slices/documentCreationSlice";
import { getInitialUiState, createUiActions } from "./slices/uiSlice";
import { getInitialThemeState, createThemeActions } from "./slices/themeSlice";

// Create the main store
export const useAppStore = create<AppState>()((set, get) => {
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
});

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