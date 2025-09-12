// src/store/slices/documentCreationSlice.ts

import { GoodClient } from "@/lib/types/models.client";
import type { 
  DocumentCreationSlice, 
  DocumentCreationActions, 
  DocumentCreationMode 
} from "../types";
import type { DocumentItem } from "@/lib/types/ui";
import { toastService } from "@/lib/services/toastService";

// Initial document creation state
export const getInitialDocumentCreationState = (): DocumentCreationSlice => ({
  isCreating: false,
  mode: "IDLE",
  items: [],
  selectedPartnerIds: [],
  selectedGoodIds: [],
  isFinalizeModalOpen: false,
  multiDocumentState: {
    isProcessing: false,
    currentPartnerIndex: 0,
    totalPartners: 0,
    partnerIds: [],
    partnerData: [],
    headerData: null,
  },
});

// Document creation slice actions
export const createDocumentCreationActions = (set: any, get: any): DocumentCreationActions => ({
  prepareDocumentForFinalization: (allGoodsInSlider) => {
    const { mode, items, selectedGoodIds } = get().ui.documentCreationState;
    let itemsToFinalize: DocumentItem[] = [];

    console.log("prepareDocumentForFinalization called:", {
      mode,
      items,
      selectedGoodIds,
      allGoodsInSlider: allGoodsInSlider?.length || 0,
      itemsLength: items.length,
      selectedGoodsLength: selectedGoodIds.length
    });

    // Handle different document creation modes
    if (mode === "SINGLE_ITEM") {
      // For single item mode (document in last position), use existing items
      itemsToFinalize = items.map((item: DocumentItem) => {
        const goodData = allGoodsInSlider.find((g) => String(g.id) === item.goodId);
        return {
          ...item,
          goodLabel: goodData?.label ?? item.goodLabel,
          journalPartnerGoodLinkId: (goodData as any)?.jpqLinkId || item.journalPartnerGoodLinkId,
        };
      });
    } else if (mode === "PARTNER_LOCKED" || mode === "MULTIPLE_PARTNERS" || mode === "MULTIPLE_GOODS" || mode === "GOODS_LOCKED") {
      // For other modes, use the items that were created when goods were selected
      itemsToFinalize = items.map((item: DocumentItem) => {
        const goodData = allGoodsInSlider.find((g) => String(g.id) === item.goodId);
        return {
          ...item,
          goodLabel: goodData?.label ?? item.goodLabel,
          journalPartnerGoodLinkId: (goodData as any)?.jpqLinkId || item.journalPartnerGoodLinkId,
        };
      });
    }

    console.log("prepareDocumentForFinalization: Items to finalize:", itemsToFinalize);

    if (itemsToFinalize.length === 0) {
      console.log("prepareDocumentForFinalization: No items to finalize, showing toast");
      toastService.error("Validation Error", "No items have been selected for the document.");
      return false;
    }

    set((state: any) => ({
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

  startDocumentCreation: (mode, initialState) => {
    set((state: any) => {
      const newSelections = { ...state.selections };
      newSelections.document = null;

      // Create initial items for locked entity modes
      let initialItems: DocumentItem[] = [];
      let initialSelectedGoodIds: string[] = [];
      
      if (mode === "GOODS_LOCKED" && initialState.lockedGoodId) {
        // In GOODS_LOCKED mode, create an item for the locked good
        initialItems = [{
          goodId: initialState.lockedGoodId,
          goodLabel: `Good ${initialState.lockedGoodId}`,
          quantity: 1,
          unitPrice: 0,
          journalPartnerGoodLinkId: null,
        }];
        initialSelectedGoodIds = [initialState.lockedGoodId];
      }

      const finalState = {
        ui: {
          ...state.ui,
          documentCreationState: {
            ...getInitialDocumentCreationState(),
            isCreating: true,
            mode,
            items: initialItems,
            selectedGoodIds: initialSelectedGoodIds,
            ...initialState,
          },
        },
        selections: newSelections,
      };

      return finalState;
    });
  },

  cancelDocumentCreation: () =>
    set((state: any) => ({
      ui: {
        ...state.ui,
        documentCreationState: getInitialDocumentCreationState(),
      },
    })),

  toggleEntityForDocument: (type, id) => {
    set((state: any) => {
      const { documentCreationState } = state.ui;
      const newItems = [...documentCreationState.items];
      let newSelectedPartnerIds = [...documentCreationState.selectedPartnerIds];
      let newSelectedGoodIds = [...documentCreationState.selectedGoodIds];
      
      console.log(`toggleEntityForDocument: ${type} ${id}`, {
        currentItems: newItems,
        currentPartners: newSelectedPartnerIds,
        currentGoods: newSelectedGoodIds,
      });
      
      if (type === "good") {
        const existingItemIndex = newItems.findIndex(item => item.goodId === id);
        const isAlreadySelected = newSelectedGoodIds.includes(id);
        
        if (isAlreadySelected) {
          // Remove from selected goods and items
          newSelectedGoodIds = newSelectedGoodIds.filter(goodId => goodId !== id);
          if (existingItemIndex !== -1) {
            newItems.splice(existingItemIndex, 1);
          }
        } else {
          // Add to selected goods and create item
          newSelectedGoodIds.push(id);
          newItems.push({
            goodId: id,
            goodLabel: `Good ${id}`,
            quantity: 1,
            unitPrice: 0,
            journalPartnerGoodLinkId: null,
          });
        }
      } else if (type === "partner") {
        const isAlreadySelected = newSelectedPartnerIds.includes(id);
        
        if (isAlreadySelected) {
          // Remove from selected partners
          newSelectedPartnerIds = newSelectedPartnerIds.filter(partnerId => partnerId !== id);
        } else {
          // Add to selected partners
          newSelectedPartnerIds.push(id);
        }
      }
      
      const newState = {
        ui: {
          ...state.ui,
          documentCreationState: {
            ...documentCreationState,
            items: newItems,
            selectedPartnerIds: newSelectedPartnerIds,
            selectedGoodIds: newSelectedGoodIds,
          },
        },
      };
      
      console.log(`toggleEntityForDocument result:`, {
        items: newState.ui.documentCreationState.items,
        selectedPartnerIds: newState.ui.documentCreationState.selectedPartnerIds,
        selectedGoodIds: newState.ui.documentCreationState.selectedGoodIds,
      });
      
      return newState;
    });
  },

  updateDocumentItem: (goodId, updates) => {
    set((state: any) => ({
      ui: {
        ...state.ui,
        documentCreationState: {
          ...state.ui.documentCreationState,
          items: state.ui.documentCreationState.items.map((item: DocumentItem) =>
            item.goodId === goodId ? { ...item, ...updates } : item
          ),
        },
      },
    }));
  },

  setDocumentItems: (items) => {
    set((state: any) => ({
      ui: {
        ...state.ui,
        documentCreationState: {
          ...state.ui.documentCreationState,
          items,
        },
      },
    }));
  },

  setFinalizeModalOpen: (isOpen) => {
    set((state: any) => ({
      ui: {
        ...state.ui,
        documentCreationState: {
          ...state.ui.documentCreationState,
          isFinalizeModalOpen: isOpen,
        },
      },
    }));
  },

  setMultiDocumentState: (multiDocumentState) => {
    set((state: any) => ({
      ui: {
        ...state.ui,
        documentCreationState: {
          ...state.ui.documentCreationState,
          multiDocumentState,
        },
      },
    }));
  },

  updateMultiDocumentState: (updates) => {
    set((state: any) => ({
      ui: {
        ...state.ui,
        documentCreationState: {
          ...state.ui.documentCreationState,
          multiDocumentState: {
            ...state.ui.documentCreationState.multiDocumentState,
            ...updates,
          },
        },
      },
    }));
  },

  resetMultiDocumentState: () => {
    set((state: any) => ({
      ui: {
        ...state.ui,
        documentCreationState: {
          ...state.ui.documentCreationState,
          multiDocumentState: {
            isProcessing: false,
            currentPartnerIndex: 0,
            totalPartners: 0,
            partnerIds: [],
            partnerData: [],
            headerData: null,
          },
        },
      },
    }));
  },
});