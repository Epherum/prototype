// src/store/types.ts

import { type Session } from "next-auth";
import { SLIDER_TYPES } from "@/lib/constants";
import type { ExtendedUser } from "@/lib/auth/authOptions";
import { GoodClient } from "@/lib/types/models.client";
import { DocumentCreationMode, DocumentItem } from "@/lib/types/ui";

// Re-export DocumentCreationMode for convenience
export type { DocumentCreationMode } from "@/lib/types/ui";

// --- Core Types ---
export type SliderType = (typeof SLIDER_TYPES)[keyof typeof SLIDER_TYPES];
export type SliderVisibility = Record<SliderType, boolean>;
export type AccordionState = Partial<Record<SliderType, boolean>>;
export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

// --- Theme Types ---
export type ThemeType = "light-orange" | "light-blue" | "dark-orange" | "dark-blue" | "light-pink" | "light-green" | "dark-pink" | "dark-green" | "light-purple" | "dark-purple";

export interface ThemeSlice {
  currentTheme: ThemeType;
}

// --- Auth Slice Types ---
export interface AuthSlice {
  sessionStatus: SessionStatus;
  user: Partial<ExtendedUser>;
  effectiveRestrictedJournalId: string;
  isAdmin: boolean;
}

export interface AuthActions {
  setAuth: (session: Session | null, status: SessionStatus) => void;
}

// --- Selections Slice Types ---
export interface SelectionsSlice {
  journal: {
    topLevelId: string;
    // Dynamic multi-level selections: levelSelections[0] = 1st Row, levelSelections[1] = 2nd Row, etc.
    levelSelections: string[][];
    // Backward compatibility - these map to levelSelections[0] and levelSelections[1]
    level2Ids: string[];
    level3Ids: string[];
    flatId: string | null;
    rootFilter: string[];
    selectedJournalId: string | null;
  };
  partner: string | null;
  good: string | null;
  project: string | null;
  document: string | null;
  gpgContextJournalId: string | null;
  effectiveJournalIds: string[];
}

export interface SelectionsActions {
  setSelection: (sliderType: string, value: any) => void;
  resetSelections: () => void;
  clearSelectionsFromIndex: (startIndex: number) => void;
}

// --- Document Creation Slice Types ---
export interface DocumentCreationSlice {
  isCreating: boolean;
  mode: DocumentCreationMode;
  items: DocumentItem[];
  lockedPartnerId?: string; // For PARTNER_LOCKED mode (J→P→D→G)
  lockedGoodId?: string; // For GOODS_LOCKED mode (J→G→D→P)
  selectedPartnerIds: string[]; // Selected partners during multi-select
  selectedGoodIds: string[]; // Selected goods during multi-select
  isFinalizeModalOpen: boolean; // Modal state for document finalization
  // Multiple document creation state
  multiDocumentState: {
    isProcessing: boolean;
    currentPartnerIndex: number;
    totalPartners: number;
    partnerIds: string[];
    partnerData: Array<{ id: string; name: string }>;
    headerData: any;
  };
}

export interface DocumentCreationActions {
  startDocumentCreation: (
    mode: DocumentCreationMode,
    initialState: Partial<DocumentCreationSlice>
  ) => void;
  cancelDocumentCreation: () => void;
  toggleEntityForDocument: (type: "partner" | "good", id: string) => void;
  updateDocumentItem: (goodId: string, updates: Partial<DocumentItem>) => void;
  setDocumentItems: (items: DocumentItem[]) => void;
  setFinalizeModalOpen: (isOpen: boolean) => void;
  prepareDocumentForFinalization: (allGoodsInSlider: GoodClient[]) => boolean;
  // Multiple document creation actions
  setMultiDocumentState: (state: DocumentCreationSlice['multiDocumentState']) => void;
  updateMultiDocumentState: (updates: Partial<DocumentCreationSlice['multiDocumentState']>) => void;
  resetMultiDocumentState: () => void;
}

// --- UI Slice Types ---
export interface UiSlice {
  sliderOrder: SliderType[];
  visibility: SliderVisibility;
  documentCreationState: DocumentCreationSlice;
  accordionState: AccordionState;
}

export interface UiActions {
  setSliderOrder: (order: SliderType[]) => void;
  moveSlider: (
    sliderId: SliderType,
    direction: "up" | "down"
  ) => void;
  setSliderVisibility: (visibility: SliderVisibility) => void;
  toggleSliderVisibility: (sliderId: SliderType) => void;
  toggleAccordion: (sliderId: SliderType) => void;
}

// --- Theme Actions ---
export interface ThemeActions {
  setTheme: (theme: ThemeType) => void;
}

// --- Combined Store Type ---
export interface AppState extends AuthActions, SelectionsActions, DocumentCreationActions, UiActions, ThemeActions {
  // Auth state
  sessionStatus: SessionStatus;
  user: Partial<ExtendedUser>;
  effectiveRestrictedJournalId: string;
  isAdmin: boolean;
  
  // UI state
  sliderOrder: SliderType[];
  visibility: SliderVisibility;
  accordionState: AccordionState;
  
  // Theme state
  currentTheme: ThemeType;
  
  // Nested slices
  ui: UiSlice;
  selections: SelectionsSlice;
}