"use client";

import { useState, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import type { Partner, Good } from "@/lib/types";

export interface GoodForDocument extends Good {
  quantity: number;
  price: number;
  amount: number;
}

export function useDocumentManager() {
  const isDocumentCreationMode = useAppStore(
    (state) => state.ui.isCreatingDocument
  );
  const enterDocumentCreationMode = useAppStore(
    (state) => state.enterDocumentCreationMode
  );
  const exitDocumentCreationMode = useAppStore(
    (state) => state.exitDocumentCreationMode
  );

  const [lockedPartnerId, setLockedPartnerId] = useState<string | null>(null);
  const [selectedGoodsForDocument, setSelectedGoodsForDocument] = useState<
    GoodForDocument[]
  >([]);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [lockedPartnerDetails, setLockedPartnerDetails] =
    useState<Partner | null>(null);

  const handleStartDocumentCreation = useCallback(
    (partnerToLock: Partner | null, openGoodsAccordionCb?: () => void) => {
      if (!partnerToLock) {
        console.warn(
          "useDocumentManager: Partner object is required to start."
        );
        return false;
      }
      enterDocumentCreationMode();
      setLockedPartnerId(partnerToLock.id);
      setLockedPartnerDetails(partnerToLock);
      setSelectedGoodsForDocument([]);
      if (openGoodsAccordionCb) {
        openGoodsAccordionCb();
      }
      return true;
    },
    [enterDocumentCreationMode]
  );

  const handleCancelDocumentCreation = useCallback(() => {
    exitDocumentCreationMode();
    setLockedPartnerId(null);
    setLockedPartnerDetails(null);
    setSelectedGoodsForDocument([]);
    setIsConfirmationModalOpen(false);
  }, [exitDocumentCreationMode]);

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
      return false;
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
    setLockedPartnerId(null);
    setLockedPartnerDetails(null);
    setSelectedGoodsForDocument([]);
  }, [exitDocumentCreationMode]);

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
