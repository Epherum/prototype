// src/store/appStore.ts
import { create } from "zustand";
import { type Session } from "next-auth";
import { SLIDER_TYPES, ROOT_JOURNAL_ID, INITIAL_ORDER } from "@/lib/constants";
import type { ExtendedUser } from "@/lib/auth/authOptions";
import type { DocumentCreationMode, DocumentItem, Good } from "@/lib/types";

// --- (Interfaces are unchanged) ---
export type SliderType = (typeof SLIDER_TYPES)[keyof typeof SLIDER_TYPES];
export type SliderVisibility = Record<SliderType, boolean>;
export type AccordionState = Partial<Record<SliderType, boolean>>;
type SessionStatus = "loading" | "authenticated" | "unauthenticated";
interface AuthSlice {
  sessionStatus: SessionStatus;
  user: Partial<ExtendedUser>;
  effectiveRestrictedJournalId: string;
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
interface DocumentCreationSlice {
  isCreating: boolean;
  mode: DocumentCreationMode;
  lockedPartnerIds: string[];
  lockedGoodIds: string[];
  lockedJournalId: string | null;
  items: DocumentItem[];
}
interface UiSlice {
  sliderOrder: SliderType[];
  visibility: SliderVisibility;
  documentCreationState: DocumentCreationSlice;
  accordionState: AccordionState;
}
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
  startDocumentCreation: (
    mode: DocumentCreationMode,
    initialState: Partial<DocumentCreationSlice>
  ) => void;
  cancelDocumentCreation: () => void;
  toggleEntityForDocument: (type: "partner" | "good", id: string) => void;
  updateDocumentItem: (goodId: string, updates: Partial<DocumentItem>) => void;
  setDocumentItems: (items: DocumentItem[]) => void;
  toggleAccordion: (sliderId: SliderType) => void;
  prepareDocumentForFinalization: (allGoodsInSlider: Good[]) => boolean;
}

const getInitialSelections = (
  restrictedJournalId = ROOT_JOURNAL_ID
): SelectionsSlice => ({
  journal: {
    topLevelId: restrictedJournalId,
    level2Ids: [],
    level3Ids: [],
    flatId: null,
    rootFilter: ["affected"],
  },
  partner: null,
  goods: null,
  project: null,
  document: null,
  gpgContextJournalId: null,
});

const getInitialDocumentCreationState = (): DocumentCreationSlice => ({
  isCreating: false,
  mode: "IDLE",
  lockedPartnerIds: [],
  lockedGoodIds: [],
  lockedJournalId: null,
  items: [],
});

export const useAppStore = create<AppState>()((set, get) => ({
  // --- (Initial State and other actions are unchanged) ---
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
      [SLIDER_TYPES.DOCUMENT]: true,
      [SLIDER_TYPES.PROJECT]: false,
    },
    documentCreationState: getInitialDocumentCreationState(),
    accordionState: {
      [SLIDER_TYPES.PARTNER]: false,
      [SLIDER_TYPES.GOODS]: false,
    },
  },
  selections: getInitialSelections(),

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
      const oldVisibleOrder = sliderOrder.filter((id) => visibility[id]);
      const currentIndex = oldVisibleOrder.indexOf(sliderId);

      if (
        currentIndex === -1 ||
        (direction === "up" && currentIndex <= 0) ||
        (direction === "down" && currentIndex >= oldVisibleOrder.length - 1)
      ) {
        return state;
      }

      const newVisibleOrder = [...oldVisibleOrder];
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
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
          ui: { ...state.ui, sliderOrder: newFullSliderOrder },
        };
      }

      const slidersToReset = newVisibleOrder.slice(breakPointIndex);
      const newSelections = { ...state.selections };
      const initialSelectionsForReset = getInitialSelections(
        state.auth.effectiveRestrictedJournalId
      );

      slidersToReset.forEach((sliderIdToReset) => {
        const key = sliderIdToReset.toLowerCase() as keyof SelectionsSlice;
        if (key === "journal") {
          newSelections.journal = initialSelectionsForReset.journal;
        } else if (key in newSelections) {
          (newSelections[
            key as keyof Omit<SelectionsSlice, "journal">
          ] as any) =
            initialSelectionsForReset[
              key as keyof Omit<SelectionsSlice, "journal">
            ];
        }
      });

      return {
        ui: { ...state.ui, sliderOrder: newFullSliderOrder },
        selections: newSelections,
      };
    }),

  prepareDocumentForFinalization: (allGoodsInSlider) => {
    const { mode, lockedGoodIds } = get().ui.documentCreationState;
    let itemsToFinalize: DocumentItem[] = [];
    if (
      mode === "LOCK_PARTNER" ||
      mode === "INTERSECT_FROM_PARTNER" ||
      mode === "INTERSECT_FROM_GOOD"
    ) {
      itemsToFinalize = lockedGoodIds.map((goodId) => {
        const goodData = allGoodsInSlider.find((g) => g.id === goodId);
        return {
          goodId: goodId,
          goodLabel: goodData?.name || "Unknown Good",
          quantity: 1,
          unitPrice: goodData?.price || 0,
          journalPartnerGoodLinkId: goodData?.jpqLinkId,
        };
      });
    } else if (mode === "LOCK_GOOD") {
      const lockedGoodId = lockedGoodIds[0];
      const goodData = allGoodsInSlider.find((g) => g.id === lockedGoodId);
      if (lockedGoodId && goodData) {
        itemsToFinalize = [
          {
            goodId: lockedGoodId,
            goodLabel: goodData.name || "Unknown Good",
            quantity: 1,
            unitPrice: goodData.price || 0,
            journalPartnerGoodLinkId: goodData.jpqLinkId,
          },
        ];
      }
    }
    if (itemsToFinalize.length === 0) {
      alert("No items have been selected for the document.");
      return false;
    }
    set((state) => ({
      ui: {
        ...state.ui,
        documentCreationState: {
          ...state.ui.documentCreationState,
          items: itemsToFinalize,
        },
      },
    }));
    return true;
  },

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

  startDocumentCreation: (mode, initialState) => {
    set((state) => {
      // FIX: The logic to reset selections for downstream sliders has been removed.
      // REASON: This was the root cause of the bug. When entering creation mode,
      // the downstream sliders' data sources change entirely (from `selections` to
      // `documentCreationState`). Their manager hooks are already designed to handle
      // this by switching their active TanStack Query.
      // Manually resetting their `selections` to `null` in this action was creating
      // a transient state where the slider appeared "empty" before the new data arrived
      // and the multi-select UI could take over. Removing this reset simplifies the
      // state transition and allows the manager hooks to react cleanly to the change in `mode`.
      // The `selections` for those sliders will naturally become invalid and will be ignored
      // by the UI controllers when `isCreating` is true and a multi-select mode is active.
      const newSelections = { ...state.selections };
      newSelections.document = null; // Still correct to reset the document selection itself.

      const finalState = {
        ui: {
          ...state.ui,
          documentCreationState: {
            ...getInitialDocumentCreationState(),
            isCreating: true,
            mode,
            ...initialState,
          },
        },
        selections: newSelections,
      };

      return finalState;
    });
  },

  cancelDocumentCreation: () =>
    set((state) => ({
      ui: {
        ...state.ui,
        documentCreationState: getInitialDocumentCreationState(),
      },
    })),

  toggleEntityForDocument: (type, id) => {
    set((state) => {
      const { documentCreationState } = state.ui;
      const key = type === "partner" ? "lockedPartnerIds" : "lockedGoodIds";
      const currentIds = new Set(documentCreationState[key]);
      if (currentIds.has(id)) {
        currentIds.delete(id);
      } else {
        currentIds.add(id);
      }
      return {
        ui: {
          ...state.ui,
          documentCreationState: {
            ...documentCreationState,
            [key]: Array.from(currentIds),
          },
        },
      };
    });
  },

  updateDocumentItem: (goodId, updates) => {
    set((state) => {
      const { documentCreationState } = state.ui;
      const newItems = documentCreationState.items.map((item) =>
        item.goodId === goodId ? { ...item, ...updates } : item
      );
      return {
        ui: {
          ...state.ui,
          documentCreationState: { ...documentCreationState, items: newItems },
        },
      };
    });
  },

  setDocumentItems: (items) => {
    set((state) => ({
      ui: {
        ...state.ui,
        documentCreationState: {
          ...state.ui.documentCreationState,
          items,
        },
      },
    }));
  },

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
