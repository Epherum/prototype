// src/features/documents/useDocumentManager.ts
"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { documentKeys } from "@/lib/queryKeys";
import { createDocument } from "@/services/clientDocumentService";
import { SLIDER_TYPES } from "@/lib/constants";

// ✅ NEW: Correct, structured imports
import type { DocumentClient, GoodClient } from "@/lib/types/models.client";
import type {
  CreateDocumentPayload,
  DocumentLinePayload,
  ApiCreateDocumentPayload,
} from "@/lib/schemas/document.schema";
import type { DocumentCreationMode, DocumentItem } from "@/lib/types/ui";

import { useChainedQuery } from "@/hooks/useChainedQuery";
import { getFirstId } from "@/lib/helpers";

export const useDocumentManager = (selectedGoodData?: GoodClient[]) => {
  const queryClient = useQueryClient();

  const { sliderOrder, visibility } = useAppStore((state) => state.ui);
  const documentCreationState = useAppStore((state) => state.ui.documentCreationState);
  const selections = useAppStore((state) => state.selections);
  const startDocumentCreation = useAppStore(
    (state) => state.startDocumentCreation
  );
  const cancelDocumentCreation = useAppStore(
    (state) => state.cancelDocumentCreation
  );
  const toggleEntityForDocument = useAppStore(
    (state) => state.toggleEntityForDocument
  );
  const setDocumentItems = useAppStore((state) => state.setDocumentItems);
  const prepareDocumentForFinalization = useAppStore(
    (state) => state.prepareDocumentForFinalization
  );
  const setFinalizeModalOpen = useAppStore((state) => state.setFinalizeModalOpen);
  const isFinalizeModalOpen = useAppStore((state) => state.ui.documentCreationState.isFinalizeModalOpen);
  const [quantityModalState, setQuantityModalState] = useState<{
    isOpen: boolean;
    good: GoodClient | null;
  }>({ isOpen: false, good: null });

  const {
    isCreating,
    mode,
    items,
  } = documentCreationState;

  const isJournalFirst = useMemo(() => {
    const visibleOrder = sliderOrder.filter((id) => visibility[id]);
    return visibleOrder.length > 0 && visibleOrder[0] === SLIDER_TYPES.JOURNAL;
  }, [sliderOrder, visibility]);

  const handleStartCreation = useCallback(() => {
    if (!isJournalFirst) {
      alert(
        "Document creation is only allowed when the Journal slider is first."
      );
      return;
    }
    const journalContext = selections.journal.selectedJournalId;

    if (!journalContext) {
      alert("Please select a single, terminal journal to create a document.");
      return;
    }

    const visibleOrder = sliderOrder.filter((id) => visibility[id]);
    const docIdx = visibleOrder.indexOf(SLIDER_TYPES.DOCUMENT);
    const partnerIdx = visibleOrder.indexOf(SLIDER_TYPES.PARTNER);
    const goodIdx = visibleOrder.indexOf(SLIDER_TYPES.GOODS);

    // Determine document creation workflow based on Document slider position
    if (docIdx === -1) {
      alert("Document slider must be visible for document creation.");
      return;
    }

    // Case 1: J→P→D→G (Partner Locked Mode)
    if (partnerIdx < docIdx && docIdx < goodIdx) {
      if (!selections.partner) {
        alert("Please select a Partner before creating the document.");
        return;
      }
      const creationMode = "PARTNER_LOCKED";
      startDocumentCreation(creationMode, { lockedPartnerId: selections.partner });
      return;
    }

    // Case 2: J→G→D→P (Goods Locked Mode)  
    if (goodIdx < docIdx && docIdx < partnerIdx) {
      if (!selections.good) {
        alert("Please select a Good before creating the document.");
        return;
      }
      const creationMode = "GOODS_LOCKED";
      startDocumentCreation(creationMode, { lockedGoodId: selections.good });
      return;
    }

    // Case 3: J→D→P→G (Multiple Partners, Intersection Goods)
    if (docIdx < partnerIdx && partnerIdx < goodIdx) {
      const creationMode = "MULTIPLE_PARTNERS";
      startDocumentCreation(creationMode, {});
      return;
    }

    // Case 4: J→D→G→P (Multiple Goods, Intersection Partners)
    if (docIdx < goodIdx && goodIdx < partnerIdx) {
      const creationMode = "MULTIPLE_GOODS";
      startDocumentCreation(creationMode, {});
      return;
    }

    // Case 5: J→P→G→D (Document in last position - original behavior)
    if (docIdx === visibleOrder.length - 1 && partnerIdx !== -1 && goodIdx !== -1) {
      if (!selections.partner || !selections.good) {
        alert(
          "Please select a Partner and a Good before creating the document."
        );
        return;
      }
      
      const creationMode = "SINGLE_ITEM";
      startDocumentCreation(creationMode, {});
      
      // Find the selected good data from the provided slider data
      const selectedGood = selectedGoodData?.find(g => g.id === selections.good);
      setQuantityModalState({ isOpen: true, good: selectedGood || null });
      return;
    }

    // If none of the supported patterns match
    alert(
      "Unsupported slider configuration for document creation. Supported patterns: J→P→D→G, J→G→D→P, J→D→P→G, J→D→G→P, or J→P→G→D"
    );
  }, [
    isJournalFirst,
    sliderOrder,
    visibility,
    selections,
    startDocumentCreation,
    selectedGoodData,
  ]);

  const handleCancelCreation = useCallback(() => {
    cancelDocumentCreation();
    setFinalizeModalOpen(false);
    setQuantityModalState({ isOpen: false, good: null });
  }, [cancelDocumentCreation, setFinalizeModalOpen]);

  const handleSingleItemSubmit = useCallback(
    ({ good, quantity }: { good: GoodClient; quantity: number }) => {
      // ✅ TYPE: Good -> GoodClient
      const newItem: DocumentItem = {
        goodId: good.id,
        goodLabel: good.label || good.label || "Unknown Good",
        quantity: quantity,
        unitPrice: 0,
        // ✅ NEW: Pass the required link ID
        journalPartnerGoodLinkId: (good as any).jpqLinkId,
      };
      setDocumentItems([newItem]);
      setQuantityModalState({ isOpen: false, good: null });
      setFinalizeModalOpen(true);
    },
    [setDocumentItems, setFinalizeModalOpen]
  );

  // ✅ REFACTORED: Mutation now handles a single document creation.
  const createDocMutation = useMutation<
    DocumentClient,
    Error,
    ApiCreateDocumentPayload
  >({
    mutationFn: createDocument,
    // Note: onSuccess will now fire for each successful creation.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
    onError: (error: Error) => {
      // This will alert for each failure.
      alert(`Error creating a document: ${error.message}`);
    },
  });

  const handlePrepareFinalization = useCallback(
    (allGoodsInSlider: GoodClient[]) => {
      const success = prepareDocumentForFinalization(allGoodsInSlider);
      
      if (success) {
        setFinalizeModalOpen(true);
      }
    },
    [prepareDocumentForFinalization, setFinalizeModalOpen]
  );

  // Simple document creation for single-item mode
  const handleSubmit = useCallback(
    async (headerData: { refDoc: string; date: Date; type: any; [key: string]: any }) => {
      const journalId = selections.journal.selectedJournalId;
      const partnerId = selections.partner;
      
      if (!journalId) {
        alert("Critical Error: Journal ID is missing for document creation.");
        return;
      }
      if (!partnerId) {
        alert("Critical Error: Partner ID is missing for document creation.");
        return;
      }
      if (items.length === 0) {
        alert("Cannot create a document with no lines.");
        return;
      }

      // Ensure all items have journalPartnerGoodLinkId, fetch if missing
      const linesPromises = items.map(async (item) => {
        let linkId = item.journalPartnerGoodLinkId;
        
        if (!linkId) {
          // We need to find the journalPartnerGoodLink for this combination
          try {
            // Fetch raw data directly from API to get included relations
            const response = await fetch(
              `/api/journal-partner-good-links?journalId=${journalId}&goodId=${item.goodId}`
            );
            
            if (!response.ok) {
              throw new Error(`API call failed: ${response.statusText}`);
            }
            
            const rawLinks = await response.json();
            
            // Find the link that matches our current partner
            const matchingLink = rawLinks.find((link: any) => {
              // The API returns links with journalPartnerLink.partner.id included
              const linkPartnerId = link.journalPartnerLink?.partner?.id;
              return linkPartnerId && String(linkPartnerId) === partnerId;
            });
            
            if (!matchingLink) {
              throw new Error(
                `No journal-partner-good link found for item: ${item.goodLabel}`
              );
            }
            
            linkId = String(matchingLink.id);
          } catch (error) {
            throw new Error(
              `Failed to find link ID for item: ${item.goodLabel}. ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
        
        return {
          journalPartnerGoodLinkId: linkId,
          goodId: item.goodId,
          designation: item.goodLabel,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercentage: 0, // Default to no discount
          taxRate: 0.2, // This should likely come from data, but 0.2 is the placeholder
          unitOfMeasure: null,
          isTaxExempt: false, // Default to not tax exempt
        };
      });
      
      const lines: DocumentLinePayload[] = await Promise.all(linesPromises);

      const payload: ApiCreateDocumentPayload = {
        ...headerData,
        journalId,
        partnerId,
        lines,
      };

      try {
        await createDocMutation.mutateAsync(payload);
        alert("Document created successfully!");
        handleCancelCreation();
      } catch (e) {
        // Error is already handled by the mutation's onError
      }

      setFinalizeModalOpen(false);
    },
    [
      selections.journal.selectedJournalId,
      selections.partner,
      items,
      createDocMutation,
      handleCancelCreation,
      setFinalizeModalOpen,
    ]
  );

  const documentsQuery = useQuery(useChainedQuery(SLIDER_TYPES.DOCUMENT));

  // Auto-select first document when documents load (similar to partner manager)
  const setSelection = useAppStore((state) => state.setSelection);
  useEffect(() => {
    if (
      documentsQuery.isSuccess &&
      documentsQuery.data &&
      !documentCreationState.isCreating
    ) {
      const fetchedDocuments = documentsQuery.data.data;
      const currentSelectionInList =
        selections.document &&
        fetchedDocuments.some((d) => d.id === selections.document);

      if (fetchedDocuments.length > 0 && !currentSelectionInList) {
        setSelection("document", getFirstId(fetchedDocuments));
      } else if (fetchedDocuments.length === 0 && selections.document !== null) {
        setSelection("document", null);
      }
    }
  }, [
    documentsQuery.data,
    documentsQuery.isSuccess,
    selections.document,
    setSelection,
    documentCreationState.isCreating,
  ]);

  return {
    isCreating,
    mode,
    isJournalFirst,
    items,
    quantityModalState,
    handleStartCreation,
    handleCancelCreation,
    toggleEntityForDocument,
    setDocumentItems,
    handleSubmit,
    handleSingleItemSubmit,
    documentsForSlider: (documentsQuery.data?.data || []) as unknown as DocumentClient[], // ✅ TYPE CAST
    documentsQuery,
    handlePrepareFinalization,
    isFinalizeModalOpen,
    setFinalizeModalOpen,
    createDocumentMutation: createDocMutation,
  };
};
