//src/features/partners/PartnerSliderController.tsx
"use client";

import { useState, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import { SLIDER_TYPES } from "@/lib/constants";
import type { Partner, Good } from "@/lib/types";
import { useJournalManager } from "@/features/journals/useJournalManager";

export interface GoodForDocument extends Good {
  quantity: number;
  price: number;
  amount: number;
}

// The hook now accepts the journalManager instance as a required prop.
interface UseDocumentManagerProps {
  journalManager: ReturnType<typeof useJournalManager>;
}

export function useDocumentManager({
  journalManager,
}: UseDocumentManagerProps) {
  // Get state from the injected journal manager hook
  const { isTerminalJournalActive } = journalManager;

  // Get global state from the store
  const isDocumentCreationMode = useAppStore(
    (state) => state.ui.isCreatingDocument
  );
  const isGoodsAccordionOpen = useAppStore(
    (state) => !!state.ui.accordionState[SLIDER_TYPES.GOODS]
  );

  // Get actions from the store
  const enterDocumentCreationMode = useAppStore(
    (state) => state.enterDocumentCreationMode
  );
  const exitDocumentCreationMode = useAppStore(
    (state) => state.exitDocumentCreationMode
  );
  const toggleAccordion = useAppStore((state) => state.toggleAccordion);

  // Local state for the hook remains the same
  const [lockedPartnerId, setLockedPartnerId] = useState<string | null>(null);
  const [selectedGoodsForDocument, setSelectedGoodsForDocument] = useState<
    GoodForDocument[]
  >([]);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [lockedPartnerDetails, setLockedPartnerDetails] =
    useState<Partner | null>(null);

  // NEW HANDLER: For the journal-first workflow initiated by the +doc button.
  const handleEnterJournalCreationMode = useCallback(() => {
    if (isTerminalJournalActive) {
      enterDocumentCreationMode();
    } else {
      console.warn(
        "Attempted to enter document creation mode without a valid terminal journal."
      );
    }
  }, [isTerminalJournalActive, enterDocumentCreationMode]);

  // This handler is for the partner-first workflow (if it still exists)
  const handleStartDocumentCreation = useCallback(
    (partnerToLock: Partner | null) => {
      if (!partnerToLock) {
        console.warn(
          "useDocumentManager: Partner object is required to start."
        );
        return false;
      }
      enterDocumentCreationMode();
      if (!isGoodsAccordionOpen) {
        toggleAccordion(SLIDER_TYPES.GOODS);
      }
      setLockedPartnerId(partnerToLock.id);
      setLockedPartnerDetails(partnerToLock);
      setSelectedGoodsForDocument([]);
      return true;
    },
    [enterDocumentCreationMode, isGoodsAccordionOpen, toggleAccordion]
  );

  const handleCancelDocumentCreation = useCallback(() => {
    exitDocumentCreationMode();
    if (isGoodsAccordionOpen) {
      toggleAccordion(SLIDER_TYPES.GOODS);
    }
    setLockedPartnerId(null);
    setLockedPartnerDetails(null);
    setSelectedGoodsForDocument([]);
    setIsConfirmationModalOpen(false);
  }, [exitDocumentCreationMode, isGoodsAccordionOpen, toggleAccordion]);

  const handleToggleGoodForDocument = useCallback((goodItem: Good) => {
    setSelectedGoodsForDocument((prev) => {
      const existingGoodIndex = prev.findIndex((g) => g.id === goodItem.id);
      if (existingGoodIndex > -1) {
        return prev.filter((g) => g.id !== goodItem.id);
      } else {
        const newGoodEntry: GoodForDocument = {
          ...goodItem,
          id: goodItem.id,
          name: goodItem.name || goodItem.label || "Unnamed Good",
          code:
            goodItem.referenceCode ||
            goodItem.code ||
            (goodItem as any).unit_code ||
            (goodItem as any).unit ||
            goodItem.id,
          quantity: 1,
          price: goodItem.price || 0,
          amount: 1 * (goodItem.price || 0),
        };
        return [...prev, newGoodEntry];
      }
    });
  }, []);

  const handleUpdateGoodDetailForDocument = useCallback(
    (goodId: string, field: "quantity" | "price", value: number) => {
      setSelectedGoodsForDocument((prev) =>
        prev.map((g) => {
          if (g.id === goodId) {
            const updatedGood = { ...g, [field]: value };
            if (
              typeof updatedGood.quantity === "number" &&
              typeof updatedGood.price === "number"
            ) {
              updatedGood.amount = updatedGood.quantity * updatedGood.price;
            }
            return updatedGood;
          }
          return g;
        })
      );
    },
    []
  );

  const handleFinishDocument = useCallback(() => {
    if (selectedGoodsForDocument.length === 0) {
      alert("Please select at least one good for the document.");
      return false;
    }
    if (!lockedPartnerId) {
      // In journal-first flow, we might not have a partner yet.
      // This logic might need to adapt based on full workflow.
    }
    setIsConfirmationModalOpen(true);
    return true;
  }, [selectedGoodsForDocument, lockedPartnerId]);

  const closeConfirmationModal = useCallback(() => {
    setIsConfirmationModalOpen(false);
  }, []);

  const resetDocumentCreationState = useCallback(() => {
    setIsConfirmationModalOpen(false);
    exitDocumentCreationMode();
    if (isGoodsAccordionOpen) {
      toggleAccordion(SLIDER_TYPES.GOODS);
    }
    setLockedPartnerId(null);
    setLockedPartnerDetails(null);
    setSelectedGoodsForDocument([]);
  }, [exitDocumentCreationMode, isGoodsAccordionOpen, toggleAccordion]);

  const handleValidateDocument = useCallback(async () => {
    console.log("VALIDATING DOCUMENT WITH:", {
      partner: lockedPartnerDetails,
      goods: selectedGoodsForDocument,
      journalContext: useAppStore.getState().selections.journal,
    });
    resetDocumentCreationState();
    return true;
  }, [
    resetDocumentCreationState,
    lockedPartnerDetails,
    selectedGoodsForDocument,
  ]);

  return {
    // NEW properties for journal-first workflow
    isTerminalJournalActive,
    handleEnterJournalCreationMode,

    // Existing properties
    isDocumentCreationMode,
    lockedPartnerId,
    selectedGoodsForDocument,
    isConfirmationModalOpen,
    lockedPartnerDetails,
    handleStartDocumentCreation,
    handleCancelDocumentCreation,
    handleToggleGoodForDocument,
    handleUpdateGoodDetailForDocument,
    handleFinishDocument,
    closeConfirmationModal,
    handleValidateDocument,
  };
}
