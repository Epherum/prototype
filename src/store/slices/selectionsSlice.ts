// src/store/slices/selectionsSlice.ts

import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import type { SelectionsSlice, SelectionsActions, SliderType } from "../types";

const JOURNAL_SELECTION_KEY = 'erp_journal_selection';

// Save journal selection to localStorage
const saveJournalSelection = (journalState: any) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(JOURNAL_SELECTION_KEY, JSON.stringify(journalState));
    } catch (error) {
      console.warn('Failed to save journal selection to localStorage:', error);
    }
  }
};

// Load journal selection from localStorage
const loadJournalSelection = (restrictedJournalId = ROOT_JOURNAL_ID) => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(JOURNAL_SELECTION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure topLevelId matches current user's restriction
        return {
          ...parsed,
          topLevelId: restrictedJournalId,
        };
      }
    } catch (error) {
      console.warn('Failed to load journal selection from localStorage:', error);
    }
  }
  return null;
};

// Get default selections without localStorage (for resets)
export const getDefaultSelections = (
  restrictedJournalId = ROOT_JOURNAL_ID
): SelectionsSlice => ({
  journal: {
    topLevelId: restrictedJournalId,
    level2Ids: [],
    level3Ids: [],
    flatId: null,
    rootFilter: ["affected"],
    selectedJournalId: null,
  },
  partner: null,
  good: null,
  project: null,
  document: null,
  gpgContextJournalId: null,
  effectiveJournalIds: [],
});

// Initial selections state (with localStorage restore on app start)
export const getInitialSelections = (
  restrictedJournalId = ROOT_JOURNAL_ID
): SelectionsSlice => {
  const savedJournal = loadJournalSelection(restrictedJournalId);
  
  return {
    journal: savedJournal || {
      topLevelId: restrictedJournalId,
      level2Ids: [],
      level3Ids: [],
      flatId: null,
      rootFilter: ["affected"],
      selectedJournalId: null,
    },
    partner: null,
    good: null,
    project: null,
    document: null,
    gpgContextJournalId: null,
    effectiveJournalIds: [],
  };
};

// Selections slice actions
export const createSelectionsActions = (set: any, get: any): SelectionsActions => ({
  setSelection: (sliderType, value) =>
    set((state: any) => {
      const newSelections = { ...state.selections };
      let clearSubsequent = true;

      if (sliderType === "journal.rootFilter") {
        // Single-select only: if clicking the same filter, deselect it; otherwise select the new one
        const currentFilter = newSelections.journal.rootFilter[0];
        if (currentFilter === value) {
          newSelections.journal.rootFilter = [];
        } else {
          newSelections.journal.rootFilter = [value];
        }
        clearSubsequent = false;
        
        // Save journal selection to localStorage
        saveJournalSelection(newSelections.journal);
      } else if (sliderType === "journal") {
        const { effectiveJournalIds, selectedJournalId, ...journalUpdates } =
          value;
        newSelections.journal = {
          ...newSelections.journal,
          ...journalUpdates,
          selectedJournalId,
        };

        if (effectiveJournalIds !== undefined) {
          newSelections.effectiveJournalIds = effectiveJournalIds;
        }

        // Save journal selection to localStorage
        saveJournalSelection(newSelections.journal);
      } else {
        (newSelections[sliderType as keyof SelectionsSlice] as any) = value;
      }

      if (clearSubsequent) {
        const order = state.sliderOrder;
        const simpleSliderType = String(sliderType).split(".")[0];
        const currentSliderIndex = order.indexOf(
          simpleSliderType.toUpperCase() as SliderType
        );

        if (currentSliderIndex !== -1) {
          const dependentSliders = order.slice(currentSliderIndex + 1);
          dependentSliders.forEach((depSliderId: SliderType) => {
            const key = depSliderId.toLowerCase() as keyof SelectionsSlice;
            if (key in newSelections && key !== "journal") {
              (newSelections[key] as any) = null;
            } else if (key === "journal") {
              newSelections.journal = getDefaultSelections(
                state.effectiveRestrictedJournalId
              ).journal;
            }
          });
        }
      }

      return { selections: newSelections };
    }),

  resetSelections: () =>
    set((state: any) => {
      // Clear saved journal selection
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(JOURNAL_SELECTION_KEY);
        } catch (error) {
          console.warn('Failed to clear journal selection from localStorage:', error);
        }
      }
      
      return {
        selections: getDefaultSelections(state.effectiveRestrictedJournalId),
      };
    }),
});