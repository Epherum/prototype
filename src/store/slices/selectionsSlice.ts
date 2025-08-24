// src/store/slices/selectionsSlice.ts

import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import type { SelectionsSlice, SelectionsActions, SliderType } from "../types";

// Helper functions for dynamic level management
export const ensureLevelExists = (levelSelections: string[][], levelIndex: number): string[][] => {
  const newLevelSelections = [...levelSelections];
  while (newLevelSelections.length <= levelIndex) {
    newLevelSelections.push([]);
  }
  return newLevelSelections;
};

export const updateLevelSelection = (
  levelSelections: string[][],
  levelIndex: number,
  selectedIds: string[]
): string[][] => {
  const newLevelSelections = ensureLevelExists(levelSelections, levelIndex);
  newLevelSelections[levelIndex] = [...selectedIds];
  
  // Clear all levels below this one when making a selection
  for (let i = levelIndex + 1; i < newLevelSelections.length; i++) {
    newLevelSelections[i] = [];
  }
  
  return newLevelSelections;
};

export const syncBackwardCompatibility = (levelSelections: string[][]) => {
  return {
    level2Ids: levelSelections[0] || [],
    level3Ids: levelSelections[1] || [],
  };
};

// Get default selections without localStorage (for resets)
export const getDefaultSelections = (
  restrictedJournalId = ROOT_JOURNAL_ID
): SelectionsSlice => ({
  journal: {
    topLevelId: restrictedJournalId,
    levelSelections: [[], []], // Start with 2 levels for backward compatibility
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

// Initial selections state
export const getInitialSelections = (
  restrictedJournalId = ROOT_JOURNAL_ID
): SelectionsSlice => {
  return {
    journal: {
      topLevelId: restrictedJournalId,
      levelSelections: [[], []], // Start with 2 levels for backward compatibility
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
        // Multi-select: toggle the filter on/off
        const currentFilters = new Set(newSelections.journal.rootFilter);
        if (currentFilters.has(value)) {
          currentFilters.delete(value);
        } else {
          currentFilters.add(value);
        }
        newSelections.journal.rootFilter = Array.from(currentFilters);
        clearSubsequent = false;
      } else if (sliderType === "journal") {
        const { effectiveJournalIds, selectedJournalId, levelIndex, levelSelections: levelSelectionsUpdate, ...journalUpdates } =
          value;
        
        // Handle dynamic level selections (new multi-level system)
        if (levelIndex !== undefined && levelSelectionsUpdate !== undefined) {
          const updatedLevelSelections = updateLevelSelection(
            newSelections.journal.levelSelections,
            levelIndex,
            levelSelectionsUpdate
          );
          
          const backwardCompatibility = syncBackwardCompatibility(updatedLevelSelections);
          
          newSelections.journal = {
            ...newSelections.journal,
            levelSelections: updatedLevelSelections,
            ...backwardCompatibility,
            selectedJournalId,
          };
        } else if (levelSelectionsUpdate) {
          // Direct level selections update (from multi-level hook)
          const backwardCompatibility = syncBackwardCompatibility(levelSelectionsUpdate);
          
          newSelections.journal = {
            ...newSelections.journal,
            ...journalUpdates,
            levelSelections: levelSelectionsUpdate, // ✅ Use the correct variable
            ...backwardCompatibility,
            selectedJournalId,
          };
        } else {
          // Legacy update path
          newSelections.journal = {
            ...newSelections.journal,
            ...journalUpdates,
            selectedJournalId,
          };
          
          // Sync legacy changes to new format
          if (journalUpdates.level2Ids || journalUpdates.level3Ids) {
            const updatedLevelSelections = [...newSelections.journal.levelSelections];
            if (journalUpdates.level2Ids) updatedLevelSelections[0] = journalUpdates.level2Ids;
            if (journalUpdates.level3Ids) updatedLevelSelections[1] = journalUpdates.level3Ids;
            newSelections.journal.levelSelections = updatedLevelSelections;
          }
        }

        if (effectiveJournalIds !== undefined) {
          newSelections.effectiveJournalIds = effectiveJournalIds;
        }
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
    set((state: any) => ({
      selections: getDefaultSelections(state.effectiveRestrictedJournalId),
    })),

  clearSelectionsFromIndex: (startIndex: number) =>
    set((state: any) => {
      const newSelections = { ...state.selections };
      const initialSelectionsForReset = getDefaultSelections(
        state.effectiveRestrictedJournalId
      );
      const order = state.sliderOrder;
      const slidersToReset = order.slice(startIndex);

      slidersToReset.forEach((sliderIdToReset: any) => {
        const key = sliderIdToReset === "GOODS"
          ? "good"
          : (sliderIdToReset.toLowerCase() as keyof typeof newSelections);
        
        if (key === "journal") {
          newSelections.journal = initialSelectionsForReset.journal;
        } else if (key in newSelections) {
          (newSelections[key as keyof typeof newSelections] as any) =
            initialSelectionsForReset[key as keyof typeof initialSelectionsForReset];
        }
      });

      return { selections: newSelections };
    }),
});