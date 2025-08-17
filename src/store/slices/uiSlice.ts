// src/store/slices/uiSlice.ts

import { SLIDER_TYPES, INITIAL_ORDER } from "@/lib/constants";
import type { 
  UiSlice, 
  UiActions, 
  SliderType, 
  SliderVisibility, 
  AccordionState 
} from "../types";
import { getInitialDocumentCreationState } from "./documentCreationSlice";
import { getInitialSelections } from "./selectionsSlice";

// Initial UI state
export const getInitialUiState = (): Omit<UiSlice, 'documentCreationState'> => ({
  sliderOrder: INITIAL_ORDER,
  visibility: {
    [SLIDER_TYPES.JOURNAL]: true,
    [SLIDER_TYPES.PARTNER]: true,
    [SLIDER_TYPES.GOODS]: true,
    [SLIDER_TYPES.PROJECT]: false,
    [SLIDER_TYPES.DOCUMENT]: true,
  },
  accordionState: {
    [SLIDER_TYPES.PARTNER]: false,
    [SLIDER_TYPES.GOODS]: false,
  },
});

// UI slice actions
export const createUiActions = (set: any, get: any): UiActions => ({
  setSliderOrder: (order) =>
    set((state: any) => ({ 
      sliderOrder: order,
      ui: { ...state.ui, sliderOrder: order } 
    })),

  moveSlider: (sliderId, direction) =>
    set((state: any) => {
      const { sliderOrder, visibility } = state.ui;
      const visibleOrder = sliderOrder.filter((id: SliderType) => visibility[id]);
      const currentIndex = visibleOrder.indexOf(sliderId);

      if (
        currentIndex === -1 ||
        (direction === "up" && currentIndex === 0) ||
        (direction === "down" && currentIndex === visibleOrder.length - 1)
      ) {
        return state;
      }

      const oldVisibleOrder = [...visibleOrder];
      const newVisibleOrder = [...oldVisibleOrder];
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      
      [newVisibleOrder[currentIndex], newVisibleOrder[targetIndex]] = [
        newVisibleOrder[targetIndex],
        newVisibleOrder[currentIndex],
      ];

      const newFullSliderOrder = [...sliderOrder];
      let visibleIndex = 0;
      for (let i = 0; i < newFullSliderOrder.length; i++) {
        if (visibility[newFullSliderOrder[i]]) {
          newFullSliderOrder[i] = newVisibleOrder[visibleIndex];
          visibleIndex++;
        }
      }

      let breakPointIndex = -1;
      for (let i = 0; i < newVisibleOrder.length; i++) {
        if (newVisibleOrder[i] !== oldVisibleOrder[i]) {
          breakPointIndex = i;
          break;
        }
      }

      if (breakPointIndex === -1) {
        return {
          sliderOrder: newFullSliderOrder,
          ui: { ...state.ui, sliderOrder: newFullSliderOrder },
        };
      }

      const slidersToReset = newVisibleOrder.slice(breakPointIndex);
      const newSelections = { ...state.selections };
      const initialSelectionsForReset = getInitialSelections(
        state.effectiveRestrictedJournalId
      );

      slidersToReset.forEach((sliderIdToReset: SliderType) => {
        const key = sliderIdToReset === SLIDER_TYPES.GOODS
          ? "good"
          : (sliderIdToReset.toLowerCase() as keyof typeof newSelections);
        
        if (key === "journal") {
          newSelections.journal = initialSelectionsForReset.journal;
        } else if (key in newSelections) {
          (newSelections[key as keyof typeof newSelections] as any) =
            initialSelectionsForReset[key as keyof typeof initialSelectionsForReset];
        }
      });

      return {
        sliderOrder: newFullSliderOrder,
        ui: { ...state.ui, sliderOrder: newFullSliderOrder },
        selections: newSelections,
      };
    }),

  setSliderVisibility: (visibility) =>
    set((state: any) => ({ 
      visibility,
      ui: { ...state.ui, visibility } 
    })),

  toggleSliderVisibility: (sliderId) =>
    set((state: any) => {
      const newVisibility = {
        ...state.visibility,
        [sliderId]: !state.visibility[sliderId],
      };
      return {
        visibility: newVisibility,
        ui: {
          ...state.ui,
          visibility: newVisibility,
        },
      };
    }),

  toggleAccordion: (sliderId) =>
    set((state: any) => {
      const newAccordionState = {
        ...state.accordionState,
        [sliderId]: !state.accordionState[sliderId],
      };
      return {
        accordionState: newAccordionState,
        ui: {
          ...state.ui,
          accordionState: newAccordionState,
        },
      };
    }),
});