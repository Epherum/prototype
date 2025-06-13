// src/store/appStore.ts
import { create } from "zustand";
import { type Session } from "next-auth";
import type { SessionProviderProps } from "next-auth/react";
import { SLIDER_TYPES, ROOT_JOURNAL_ID, INITIAL_ORDER } from "@/lib/constants";

// Import types from your existing files
import type { ExtendedUser } from "@/lib/authOptions"; // <-- CORRECTED IMPORT
import type { PartnerGoodFilterStatus } from "@/lib/types"; // <-- CORRECTED IMPORT

// Define slider-specific types that were not in the global types.ts
export type SliderType = (typeof SLIDER_TYPES)[keyof typeof SLIDER_TYPES];
export type SliderVisibility = Record<SliderType, boolean>;
// --- State Slice Interfaces ---

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthSlice {
  sessionStatus: SessionStatus;
  user: Partial<ExtendedUser>; // Use Partial to handle loading/unauthenticated states
  companyId: string | null;
  /** The most specific journal ID a user is allowed to see as their root. */
  effectiveRestrictedJournalId: string;
  /** The company ID associated with the restricted journal. */
  effectiveRestrictedJournalCompanyId: string | null;
}

interface SelectionsSlice {
  journal: {
    topLevelId: string;
    level2Ids: string[];
    level3Ids: string[];
    flatId: string | null;
    rootFilter: string[]; // e.g., ['affected', 'inProcess']
  };
  partner: string | null;
  goods: string | null;
  project: string | null;
  document: string | null;
  // Contextual selections
  gpgContextJournalId: string | null;
}

interface UiSlice {
  sliderOrder: SliderType[];
  visibility: SliderVisibility;
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
  // --- CORRECTED SIGNATURE ---
  setSelection: (
    sliderType:
      | keyof Omit<SelectionsSlice, "journal">
      | "journal"
      | "journal.rootFilter",
    value: any
  ) => void;
  resetSelections: () => void;
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
    rootFilter: [], // Default to no filters
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
    effectiveRestrictedJournalId: ROOT_JOURNAL_ID, // Default to conceptual root
    effectiveRestrictedJournalCompanyId: null,
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
  },
  selections: getInitialSelections(),

  // --- Actions Implementation ---

  setAuth: (session, status) =>
    set((state) => {
      if (status === "authenticated" && session?.user) {
        const user = session.user as ExtendedUser;
        let restrictedId = ROOT_JOURNAL_ID;
        let restrictedCompanyId = null;

        // This logic is moved directly from page.tsx to here.
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
          },
          // When auth changes, reset selections to respect the new restriction
          selections: getInitialSelections(restrictedId),
        };
      }
      // Handle loading and unauthenticated states
      return {
        auth: {
          sessionStatus: status,
          user: {},
          companyId: null,
          effectiveRestrictedJournalId: ROOT_JOURNAL_ID,
          effectiveRestrictedJournalCompanyId: null,
        },
        selections: getInitialSelections(),
      };
    }),

  setSliderOrder: (order) =>
    set((state) => {
      // When slider order changes, reset all selections to prevent invalid contexts
      return {
        ui: { ...state.ui, sliderOrder: order },
        selections: getInitialSelections(
          state.auth.effectiveRestrictedJournalId
        ),
      };
    }),

  moveSlider: (sliderId, direction) =>
    set((state) => {
      const { sliderOrder, visibility } = state.ui;
      const visibleOrderedIds = sliderOrder.filter((id) => visibility[id]);
      const currentIndex = visibleOrderedIds.indexOf(sliderId);

      if (
        (direction === "up" && currentIndex <= 0) ||
        (direction === "down" && currentIndex >= visibleOrderedIds.length - 1)
      ) {
        return state; // Cannot move
      }

      const newOrderedVisibleIds = [...visibleOrderedIds];
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      [newOrderedVisibleIds[currentIndex], newOrderedVisibleIds[targetIndex]] =
        [newOrderedVisibleIds[targetIndex], newOrderedVisibleIds[currentIndex]];

      // Reconstruct the full sliderOrder array
      const newSliderOrder = [...sliderOrder];
      let visibleIndex = 0;
      for (let i = 0; i < newSliderOrder.length; i++) {
        if (visibility[newSliderOrder[i]]) {
          newSliderOrder[i] = newOrderedVisibleIds[visibleIndex];
          visibleIndex++;
        }
      }

      // Moving sliders also resets selections due to changed dependencies
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

  /**
   * This is the most important action in the refactor.
   * It updates a selection and automatically resets dependent selections
   * based on the slider order, replacing the need for complex useEffect chains.
   */
  setSelection: (sliderType, value) =>
    set((state) => {
      const newSelections = { ...state.selections };
      let clearSubsequent = true; // Assume we clear subsequent sliders by default

      // 1. Update the selection for the target slider type
      if (sliderType === "journal.rootFilter") {
        const currentFilters = newSelections.journal.rootFilter;
        const newFilterSet = new Set(currentFilters);
        if (newFilterSet.has(value)) {
          newFilterSet.delete(value);
        } else {
          newFilterSet.add(value);
        }
        newSelections.journal.rootFilter = Array.from(newFilterSet);
        clearSubsequent = false; // <<< IMPORTANT: Do NOT clear subsequent sliders for a filter change
      } else if (sliderType === "journal") {
        newSelections.journal = { ...newSelections.journal, ...value };
      } else {
        // This handles 'partner', 'goods', 'gpgContextJournalId', etc.
        (newSelections[sliderType as keyof SelectionsSlice] as any) = value;
      }

      if (clearSubsequent) {
        // This part remains the same, but is now only triggered for actual selections
        const order = state.ui.sliderOrder;
        // Handle the case where sliderType is 'journal.rootFilter' which is not in the order
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
}));
