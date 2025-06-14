// src/store/appStore.ts

import { create } from "zustand";
import { type Session } from "next-auth";
import { SLIDER_TYPES, ROOT_JOURNAL_ID, INITIAL_ORDER } from "@/lib/constants";

// Import types from your existing files
import type { ExtendedUser } from "@/lib/authOptions";
import type { PartnerGoodFilterStatus } from "@/lib/types";

// Define slider-specific types
export type SliderType = (typeof SLIDER_TYPES)[keyof typeof SLIDER_TYPES];
export type SliderVisibility = Record<SliderType, boolean>;
export type AccordionState = Partial<Record<SliderType, boolean>>;

// --- State Slice Interfaces ---

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthSlice {
  sessionStatus: SessionStatus;
  user: Partial<ExtendedUser>;
  companyId: string | null;
  /** The most specific journal ID a user is allowed to see as their root. */
  effectiveRestrictedJournalId: string;
  /** The company ID associated with the restricted journal. */
  effectiveRestrictedJournalCompanyId: string | null;
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
  // +++ NEW ACTIONS +++
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
    companyId: null,
    effectiveRestrictedJournalId: ROOT_JOURNAL_ID,
    effectiveRestrictedJournalCompanyId: null,
    isAdmin: false, // Default to false
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
    isCreatingDocument: false, // <<< INITIALIZE NEW STATE
    accordionState: {
      [SLIDER_TYPES.PARTNER]: false, // Default to closed
      [SLIDER_TYPES.GOODS]: false, // Default to closed
    },
  },
  selections: getInitialSelections(),

  // --- Actions Implementation ---

  setAuth: (session, status) =>
    set((state) => {
      if (status === "authenticated" && session?.user) {
        const user = session.user as ExtendedUser;
        let restrictedId = ROOT_JOURNAL_ID;
        let restrictedCompanyId = null;

        // NEW: Determine if the user has an "ADMIN" role
        const userIsAdmin =
          user.roles?.some((role) => role.name.toUpperCase() === "ADMIN") ??
          false;

        if (user.roles && user.roles.length > 0) {
          const roleWithRestriction = user.roles.find(
            (role) => !!role.restrictedTopLevelJournalId
          );
          if (roleWithRestriction) {
            restrictedId =
              roleWithRestriction.restrictedTopLevelJournalId ||
              ROOT_JOURNAL_ID;
            restrictedCompanyId =
              roleWithRestriction.restrictedTopLevelJournalCompanyId || null;
          }
        }

        return {
          auth: {
            sessionStatus: "authenticated",
            user: user,
            companyId: user.companyId || null,
            effectiveRestrictedJournalId: restrictedId,
            effectiveRestrictedJournalCompanyId: restrictedCompanyId,
            isAdmin: userIsAdmin, // Set the derived admin flag
          },
          selections: getInitialSelections(restrictedId),
        };
      }
      // Handle loading and unauthenticated states
      return {
        auth: {
          sessionStatus: "loading",
          user: {},
          companyId: null,
          effectiveRestrictedJournalId: ROOT_JOURNAL_ID,
          effectiveRestrictedJournalCompanyId: null,
          isAdmin: false, // Ensure isAdmin is false when not authenticated
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
      // FIX: Preserve the partner and journal context.
      // Only clear the selections that will be made *during* document creation.
      selections: {
        ...state.selections,
        goods: null, // Clear any previously selected good.
        // DO NOT clear partner. It's the context for the new document.
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
