// src/store/slices/selectionsSlice.ts

import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import type { SelectionsSlice, SelectionsActions, SliderType } from "../types";

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

// Initial selections state
export const getInitialSelections = (
  restrictedJournalId = ROOT_JOURNAL_ID
): SelectionsSlice => {
  return {
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