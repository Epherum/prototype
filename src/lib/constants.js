import {
  IoCartOutline,
  IoPricetagOutline,
  IoBuildOutline,
} from "react-icons/io5";

// --- Constants ---
export const SLIDER_TYPES = {
  JOURNAL: "journal",
  PARTNER: "partner",
  GOODS: "goods",
  PROJECT: "project",
  DOCUMENT: "document",
};
export const INITIAL_ORDER = [
  SLIDER_TYPES.JOURNAL,
  SLIDER_TYPES.PARTNER,
  SLIDER_TYPES.GOODS,
  SLIDER_TYPES.PROJECT,
  SLIDER_TYPES.DOCUMENT,
];
export const JOURNAL_ICONS = {
  J01: IoCartOutline,
  J02: IoPricetagOutline,
  J03: IoBuildOutline,
};
export const ROOT_JOURNAL_ID = "__ROOT__";
