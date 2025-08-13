// src/lib/types/ui.ts

import { SLIDER_TYPES } from "@/lib/constants";

// =================================================================
// --- UI State & View-Model Types ---
// =================================================================
// This file contains types that describe the state of the UI components
// themselves, or are client-side "view models" transformed for display.
// They do not have a 1:1 mapping with database models.

/**
 * The canonical list of all possible slider types in the application.
 */
export type SliderType = (typeof SLIDER_TYPES)[keyof typeof SLIDER_TYPES];

/**
 * Client-side representation of the PartnerType enum, often for UI dropdowns.
 */
export type PartnerTypeClient = "LEGAL_ENTITY" | "NATURAL_PERSON";

/**
 * The possible states for the Journal-based filtering control.
 */
export type PartnerGoodFilterStatus = "affected" | "unaffected" | "inProcess";
export type ActivePartnerFilters = PartnerGoodFilterStatus[];

/**
 * A UI-specific view model representing a Journal node in a tree structure.
 * This is a transformation of the `JournalClient` model for display purposes.
 */
export interface AccountNodeData {
  id: string;
  name: string;
  code: string;
  children?: AccountNodeData[];
  isConceptualRoot?: boolean;
  isTerminal?: boolean;
}

/**
 * Describes the state of the document creation UI flow.
 */
export type DocumentCreationMode =
  | "IDLE" // Not in creation mode
  | "SINGLE_ITEM" // J->P->G->D or J->G->P->D
  | "LOCK_PARTNER" // J->P->D->G
  | "LOCK_GOOD" // J->G->D->P
  | "INTERSECT_FROM_PARTNER" // J->D->P->G
  | "INTERSECT_FROM_GOOD"; // J->D->G->P

/**
 * Represents an item added to the document "cart" before creation.
 */
export interface DocumentItem {
  goodId: string;
  goodLabel: string;
  quantity: number;
  unitPrice: number;
  journalPartnerGoodLinkId?: string;
}
