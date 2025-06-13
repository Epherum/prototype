// src/hooks/useDocumentCreation.ts
import { useState, useCallback } from "react";
import type { Partner, Good } from "@/lib/types"; // Assuming Good type is defined

// If Good type for document needs specific fields like quantity, price, amount
export interface GoodForDocument extends Good {
  quantity: number;
  price: number;
  amount: number; // Or string if you prefer to keep it formatted
}

export function useDocumentCreation() {
  const [isDocumentCreationMode, setIsDocumentCreationMode] = useState(false);
  const [lockedPartnerId, setLockedPartnerId] = useState<string | null>(null);
  const [selectedGoodsForDocument, setSelectedGoodsForDocument] = useState<
    GoodForDocument[]
  >([]);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [lockedPartnerDetails, setLockedPartnerDetails] =
    useState<Partner | null>(null);

  const handleStartDocumentCreation = useCallback(
    (partnerIdToLock: string | null, openGoodsAccordionCb?: () => void) => {
      if (!partnerIdToLock) {
        // It's good practice for the hook to not directly call `alert`.
        // It can return a status or throw an error that the component can handle.
        // For now, let's console.warn and let the UI handle user feedback.
        console.warn(
          "useDocumentCreation: Partner ID is required to start document creation."
        );
        return false; // Indicate failure
      }
      setIsDocumentCreationMode(true);
      setLockedPartnerId(partnerIdToLock);
      setSelectedGoodsForDocument([]); // Reset selected goods
      if (openGoodsAccordionCb) {
        openGoodsAccordionCb(); // Callback to open the goods accordion
      }
      console.log(
        "useDocumentCreation: Document creation started for partner:",
        partnerIdToLock
      );
      return true; // Indicate success
    },
    []
  );

  const handleCancelDocumentCreation = useCallback(() => {
    setIsDocumentCreationMode(false);
    setLockedPartnerId(null);
    setSelectedGoodsForDocument([]);
    setIsConfirmationModalOpen(false); // Ensure confirmation modal is also closed
    console.log("useDocumentCreation: Document creation cancelled.");
  }, []);

  const handleToggleGoodForDocument = useCallback((goodItem: Good) => {
    // Expects base Good type
    setSelectedGoodsForDocument((prev) => {
      const existingGoodIndex = prev.findIndex((g) => g.id === goodItem.id);
      if (existingGoodIndex > -1) {
        return prev.filter((g) => g.id !== goodItem.id);
      } else {
        const newGoodEntry: GoodForDocument = {
          ...goodItem, // Spread all properties from the base Good item
          id: goodItem.id,
          name: goodItem.name || "Unnamed Good",
          // Use optional chaining and fallbacks for properties that might not be on every Good item
          code:
            goodItem.code ||
            (goodItem as any).unit_code ||
            (goodItem as any).unit ||
            goodItem.id,
          quantity: 1,
          price: goodItem.price || 0,
          amount: 1 * (goodItem.price || 0), // Recalculate, keep as number
        };
        return [...prev, newGoodEntry];
      }
    });
  }, []);

  const handleUpdateGoodDetailForDocument = useCallback(
    (goodId: string, field: keyof GoodForDocument, value: string | number) => {
      setSelectedGoodsForDocument((prev) =>
        prev.map((g) => {
          if (g.id === goodId) {
            const newValue =
              typeof value === "string" ? parseFloat(value) : value;
            const updatedGood = { ...g, [field]: newValue || 0 };

            if (
              (field === "quantity" || field === "price") &&
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
      console.warn(
        "useDocumentCreation: Select at least one good for the document."
      );
      return false; // Indicate failure
    }
    if (!lockedPartnerId) {
      console.error(
        "useDocumentCreation: No partner locked for this document."
      );
      return false; // Indicate failure
    }
    setIsConfirmationModalOpen(true);
    return true; // Indicate success
  }, [selectedGoodsForDocument, lockedPartnerId]);

  // handleValidateDocument will be called by the component,
  // which then might make an API call. The hook just manages the state.
  const closeConfirmationModal = useCallback(() => {
    setIsConfirmationModalOpen(false);
  }, []);

  // This function would be called *after* a successful API submission
  const resetDocumentCreationState = useCallback(() => {
    setIsConfirmationModalOpen(false);
    setIsDocumentCreationMode(false);
    setLockedPartnerId(null);
    setSelectedGoodsForDocument([]);
  }, []);

  const handleValidateDocument = useCallback(async () => {
    // This would typically make an API call to validate the document
    // For now, we'll just close the modal and reset state
    resetDocumentCreationState();
    return true;
  }, []);

  return {
    isDocumentCreationMode,
    lockedPartnerId,
    selectedGoodsForDocument,
    isConfirmationModalOpen,
    setIsConfirmationModalOpen, // Expose if Home needs to control it directly for any reason
    lockedPartnerDetails,
    handleStartDocumentCreation,
    handleCancelDocumentCreation,
    handleToggleGoodForDocument,
    handleUpdateGoodDetailForDocument,
    handleFinishDocument,
    closeConfirmationModal,
    resetDocumentCreationState, // To be called after successful document submission
    handleValidateDocument,
  };
}
