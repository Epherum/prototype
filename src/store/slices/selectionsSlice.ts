// src/store/slices/selectionsSlice.ts

import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import type { SelectionsSlice, SelectionsActions, SliderType } from "../types";

// Initial selections state
export const getInitialSelections = (
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

// Selections slice actions
export const createSelectionsActions = (set: any, get: any): SelectionsActions => ({
  setSelection: (sliderType, value) =>
    set((state: any) => {
      const newSelections = { ...state.selections };
      let clearSubsequent = true;

      if (sliderType === "journal.rootFilter") {
        const currentFilters = newSelections.journal.rootFilter;
        const newFilterSet = new Set(currentFilters);
        if (newFilterSet.has(value)) {
          newFilterSet.delete(value);
        } else {
          newFilterSet.add(value);
        }
        newSelections.journal.rootFilter = Array.from(newFilterSet);
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
              newSelections.journal = getInitialSelections(
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
      selections: getInitialSelections(state.effectiveRestrictedJournalId),
    })),
});