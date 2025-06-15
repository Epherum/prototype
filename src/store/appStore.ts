// src/store/appStore.ts

import { create } from "zustand";
import { type Session } from "next-auth";
import { SLIDER_TYPES, ROOT_JOURNAL_ID, INITIAL_ORDER } from "@/lib/constants";
import type { ExtendedUser } from "@/lib/authOptions";

// Define slider-specific types
export type SliderType = (typeof SLIDER_TYPES)[keyof typeof SLIDER_TYPES];
export type SliderVisibility = Record<SliderType, boolean>;
export type AccordionState = Partial<Record<SliderType, boolean>>;

// --- State Slice Interfaces ---
type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthSlice {
  sessionStatus: SessionStatus;
  user: Partial<ExtendedUser>;
  /** The most specific journal ID a user is allowed to see as their root. */
  effectiveRestrictedJournalId: string;
  /** A derived boolean for easy admin checks across the app. */
  isAdmin: boolean;
}

interface SelectionsSlice {
  journal: {
    topLevelId: string;
    level2Ids: string[];
    level3Ids: string[];
    flatId: string | null;
    rootFilter: string[];
  };
  partner: string | null;
  goods: string | null;
  project: string | null;
  document: string | null;
  gpgContextJournalId: string | null;
}

interface UiSlice {
  sliderOrder: SliderType[];
  visibility: SliderVisibility;
  isCreatingDocument: boolean;
  accordionState: AccordionState;
}

// --- Combined State and Actions ---

interface AppState {
  auth: AuthSlice;
  ui: UiSlice;
  selections: SelectionsSlice;
  setAuth: (session: Session | null, status: SessionStatus) => void;
  setSliderOrder: (order: SliderType[]) => void;
  moveSlider: (sliderId: SliderType, direction: "up" | "down") => void;
  setSliderVisibility: (visibility: SliderVisibility) => void;
  toggleSliderVisibility: (sliderId: SliderType) => void;
  setSelection: (
    sliderType:
      | keyof Omit<SelectionsSlice, "journal">
      | "journal"
      | "journal.rootFilter",
    value: any
  ) => void;
  resetSelections: () => void;
  enterDocumentCreationMode: () => void;
  exitDocumentCreationMode: () => void;
  toggleAccordion: (sliderId: SliderType) => void;
}

// --- Helper Functions ---

const getInitialSelections = (
  restrictedJournalId = ROOT_JOURNAL_ID
): SelectionsSlice => ({
  journal: {
    topLevelId: restrictedJournalId,
    level2Ids: [],
    level3Ids: [],
    flatId: null,
    rootFilter: [],
  },
  partner: null,
  goods: null,
  project: null,
  document: null,
  gpgContextJournalId: null,
});

// --- Zustand Store Definition ---

export const useAppStore = create<AppState>()((set, get) => ({
  // --- Initial State ---
  auth: {
    sessionStatus: "loading",
    user: {},
    effectiveRestrictedJournalId: ROOT_JOURNAL_ID,
    isAdmin: false,
  },
  ui: {
    sliderOrder: INITIAL_ORDER as SliderType[],
    visibility: {
      [SLIDER_TYPES.JOURNAL]: true,
      [SLIDER_TYPES.PARTNER]: true,
      [SLIDER_TYPES.GOODS]: true,
      [SLIDER_TYPES.PROJECT]: false,
      [SLIDER_TYPES.DOCUMENT]: false,
    },
    isCreatingDocument: false,
    accordionState: {
      [SLIDER_TYPES.PARTNER]: false,
      [SLIDER_TYPES.GOODS]: false,
    },
  },
  selections: getInitialSelections(),

  // --- Actions Implementation ---

  setAuth: (session, status) =>
    set(() => {
      if (status === "authenticated" && session?.user) {
        const user = session.user as ExtendedUser;
        let restrictedId = ROOT_JOURNAL_ID;

        const userIsAdmin =
          user.roles?.some((role) => role.name.toUpperCase() === "ADMIN") ??
          false;

        if (user.restrictedTopLevelJournalId) {
          restrictedId = user.restrictedTopLevelJournalId;
        }

        return {
          auth: {
            sessionStatus: "authenticated",
            user: user,
            effectiveRestrictedJournalId: restrictedId,
            isAdmin: userIsAdmin,
          },
          selections: getInitialSelections(restrictedId),
        };
      }
      // Handle loading and unauthenticated states
      return {
        auth: {
          sessionStatus: "loading",
          user: {},
          effectiveRestrictedJournalId: ROOT_JOURNAL_ID,
          isAdmin: false,
        },
        selections: getInitialSelections(),
      };
    }),

  setSliderOrder: (order) =>
    set((state) => ({
      ui: { ...state.ui, sliderOrder: order },
      selections: getInitialSelections(state.auth.effectiveRestrictedJournalId),
    })),

  moveSlider: (sliderId, direction) =>
    set((state) => {
      const { sliderOrder, visibility } = state.ui;
      const visibleOrderedIds = sliderOrder.filter((id) => visibility[id]);
      const currentIndex = visibleOrderedIds.indexOf(sliderId);

      if (
        (direction === "up" && currentIndex <= 0) ||
        (direction === "down" && currentIndex >= visibleOrderedIds.length - 1)
      ) {
        return state;
      }

      const newOrderedVisibleIds = [...visibleOrderedIds];
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      [newOrderedVisibleIds[currentIndex], newOrderedVisibleIds[targetIndex]] =
        [newOrderedVisibleIds[targetIndex], newOrderedVisibleIds[currentIndex]];

      const newSliderOrder = [...sliderOrder];
      let visibleIndex = 0;
      for (let i = 0; i < newSliderOrder.length; i++) {
        if (visibility[newSliderOrder[i]]) {
          newSliderOrder[i] = newOrderedVisibleIds[visibleIndex];
          visibleIndex++;
        }
      }

      return {
        ui: { ...state.ui, sliderOrder: newSliderOrder },
        selections: getInitialSelections(
          state.auth.effectiveRestrictedJournalId
        ),
      };
    }),

  setSliderVisibility: (visibility) =>
    set((state) => ({ ui: { ...state.ui, visibility } })),

  toggleSliderVisibility: (sliderId) =>
    set((state) => ({
      ui: {
        ...state.ui,
        visibility: {
          ...state.ui.visibility,
          [sliderId]: !state.ui.visibility[sliderId],
        },
      },
    })),

  setSelection: (sliderType, value) =>
    set((state) => {
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
        newSelections.journal = { ...newSelections.journal, ...value };
      } else {
        (newSelections[sliderType as keyof SelectionsSlice] as any) = value;
      }

      if (clearSubsequent) {
        const order = state.ui.sliderOrder;
        const simpleSliderType = String(sliderType).split(".")[0];
        const currentSliderIndex = order.indexOf(
          simpleSliderType.toUpperCase() as SliderType
        );

        if (currentSliderIndex !== -1) {
          const dependentSliders = order.slice(currentSliderIndex + 1);
          dependentSliders.forEach((depSliderId) => {
            const key = depSliderId.toLowerCase() as keyof SelectionsSlice;
            if (key in newSelections && key !== "journal") {
              (newSelections[key] as any) = null;
            } else if (key === "journal") {
              newSelections.journal.flatId = null;
            }
          });
        }
      }

      return { selections: newSelections };
    }),

  resetSelections: () =>
    set((state) => ({
      selections: getInitialSelections(state.auth.effectiveRestrictedJournalId),
    })),

  enterDocumentCreationMode: () =>
    set((state) => ({
      ui: { ...state.ui, isCreatingDocument: true },
      selections: {
        ...state.selections,
        goods: null,
      },
    })),

  exitDocumentCreationMode: () =>
    set((state) => ({
      ui: { ...state.ui, isCreatingDocument: false },
    })),

  toggleAccordion: (sliderId) =>
    set((state) => ({
      ui: {
        ...state.ui,
        accordionState: {
          ...state.ui.accordionState,
          [sliderId]: !state.ui.accordionState[sliderId],
        },
      },
    })),
}));
