// src/features/documents/useDocumentManager.ts
"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { documentKeys } from "@/lib/queryKeys";
import { createDocument } from "@/services/clientDocumentService";
import { toastService } from "@/lib/services/toastService";
import { fetchPartnerById } from "@/services/clientPartnerService";
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

export const useDocumentManager = (selectedGoodData?: GoodClient[], journalManager?: any) => {
  const queryClient = useQueryClient();

  const { sliderOrder, visibility } = useAppStore((state) => state.ui);
  const documentCreationState = useAppStore((state) => state.ui.documentCreationState);
  const selections = useAppStore((state) => state.selections);
  
  // Use store state for multiple document creation
  const multiDocumentState = useAppStore((state) => state.ui.documentCreationState.multiDocumentState);
  const setMultiDocumentState = useAppStore((state) => state.setMultiDocumentState);
  const updateMultiDocumentState = useAppStore((state) => state.updateMultiDocumentState);
  
  // State for single document partner information
  const [singleDocumentPartner, setSingleDocumentPartner] = useState<{
    id: string;
    name: string;
  } | null>(null);
  
  // Fetch partner data immediately when partner selection changes
  useEffect(() => {
    const fetchPartnerData = async () => {
      if (selections.partner) {
        try {
          const partner = await fetchPartnerById(selections.partner);
          setSingleDocumentPartner({
            id: selections.partner,
            name: partner?.name || `Partner ${selections.partner}`,
          });
        } catch (error) {
          console.warn(`Failed to fetch partner ${selections.partner}:`, error);
          setSingleDocumentPartner({
            id: selections.partner,
            name: `Partner ${selections.partner}`,
          });
        }
      } else {
        setSingleDocumentPartner(null);
      }
    };

    fetchPartnerData();
  }, [selections.partner]);
  
  const resetMultiDocumentState = useAppStore((state) => state.resetMultiDocumentState);
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
    selectedPartnerIds,
  } = documentCreationState;

  const isJournalFirst = useMemo(() => {
    const visibleOrder = sliderOrder.filter((id) => visibility[id]);
    return visibleOrder.length > 0 && visibleOrder[0] === SLIDER_TYPES.JOURNAL;
  }, [sliderOrder, visibility]);

  const handleStartCreation = useCallback(() => {
    console.log('🔍 handleStartCreation called', {
      isJournalFirst,
      journalManagerSelectedJournalId: journalManager?.selectedJournalId,
      selections: selections.journal,
      journalManager: journalManager
    });
    
    if (!isJournalFirst) {
      alert(
        "Document creation is only allowed when the Journal slider is first."
      );
      return;
    }
    
    // Use the journal manager's selectedJournalId - this is the authoritative source for terminal selections
    const journalContext = journalManager?.selectedJournalId;

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
    journalManager,
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
      toastService.error("Error creating document", error.message);
    },
  });

  const handlePrepareFinalization = useCallback(
    async (allGoodsInSlider: GoodClient[]) => {
      const success = prepareDocumentForFinalization(allGoodsInSlider);
      
      if (success) {
        // For GOODS_LOCKED, MULTIPLE_PARTNERS, and MULTIPLE_GOODS modes, start multiple document creation immediately
        if ((mode === "GOODS_LOCKED" || mode === "MULTIPLE_PARTNERS" || mode === "MULTIPLE_GOODS") && selectedPartnerIds.length > 0) {
          
          // Fetch partner data first, then show modal
          try {
            const partnerDataPromises = selectedPartnerIds.map(async (id) => {
              try {
                const partner = await fetchPartnerById(id);
                return {
                  id,
                  name: partner?.name || `Partner ${id}`,
                };
              } catch (error) {
                console.warn(`Failed to fetch partner ${id}:`, error);
                return {
                  id,
                  name: `Partner ${id}`,
                };
              }
            });
            
            const partnerData = await Promise.all(partnerDataPromises);
            
            const newState = {
              isProcessing: true,
              currentPartnerIndex: 0,
              totalPartners: selectedPartnerIds.length,
              partnerIds: selectedPartnerIds,
              partnerData: partnerData,
              headerData: null,
            };
            // Use store action to set state
            setMultiDocumentState(newState);
          } catch (error) {
            console.warn("Failed to fetch partner information:", error);
            // Fallback with partner IDs
            const fallbackPartnerData = selectedPartnerIds.map((id, index) => ({
              id,
              name: `Partner ${id}`,
            }));
            
            const newState = {
              isProcessing: true,
              currentPartnerIndex: 0,
              totalPartners: selectedPartnerIds.length,
              partnerIds: selectedPartnerIds,
              partnerData: fallbackPartnerData,
              headerData: null,
            };
            setMultiDocumentState(newState);
          }
        } else {
          // For single document modes (SINGLE_ITEM, PARTNER_LOCKED), partner data is already available
          setFinalizeModalOpen(true);
        }
      }
    },
    [prepareDocumentForFinalization, setFinalizeModalOpen, mode, selectedPartnerIds]
  );

  // Helper function to create a single document
  const createSingleDocument = useCallback(
    async (journalId: string, partnerId: string, headerData: any) => {
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
        return true;
      } catch (e) {
        throw e;
      }
    },
    [items, createDocMutation]
  );

  // Document creation for single-item mode and single documents
  const handleSubmit = useCallback(
    async (headerData: { refDoc: string; date: Date; type: any; [key: string]: any }) => {
      const journalId = journalManager?.selectedJournalId;
      
      if (!journalId) {
        alert("Critical Error: Journal ID is missing for document creation.");
        return;
      }
      
      // For other modes (not GOODS_LOCKED), use single partner from selections
      const partnerId = selections.partner;
      if (!partnerId) {
        alert("Critical Error: Partner ID is missing for document creation.");
        return;
      }
      
      if (items.length === 0) {
        alert("Cannot create a document with no lines.");
        return;
      }
      
      try {
        await createSingleDocument(journalId, partnerId, headerData);
        toastService.success("Document created successfully!");
        handleCancelCreation();
        setFinalizeModalOpen(false);
      } catch (e) {
        // Error is already handled by the mutation's onError
      }
    },
    [
      journalManager?.selectedJournalId,
      selections.partner,
      items,
      createSingleDocument,
      handleCancelCreation,
      setFinalizeModalOpen,
      journalManager,
    ]
  );
  
  // Process the next document in the multiple document creation workflow
  const processNextDocument = useCallback(
    async (confirmedHeaderData: any) => {
      const { currentPartnerIndex, partnerIds, totalPartners } = multiDocumentState;
      const journalId = journalManager?.selectedJournalId!;
      const partnerId = partnerIds[currentPartnerIndex];
      
      try {
        await createSingleDocument(journalId, partnerId, confirmedHeaderData);
        
        const nextIndex = currentPartnerIndex + 1;
        if (nextIndex < totalPartners) {
          // More documents to create
          updateMultiDocumentState({
            currentPartnerIndex: nextIndex,
          });
        } else {
          // All documents created successfully
          alert(`Successfully created ${totalPartners} documents!`);
          resetMultiDocumentState();
          handleCancelCreation();
          setFinalizeModalOpen(false);
        }
      } catch (error) {
        alert(`Error creating document for partner ${currentPartnerIndex + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue with next document or allow user to retry
      }
    },
    [multiDocumentState, journalManager?.selectedJournalId, createSingleDocument, handleCancelCreation, setFinalizeModalOpen, updateMultiDocumentState, resetMultiDocumentState, journalManager]
  );
  
  // Cancel multiple document creation
  const cancelMultipleDocumentCreation = useCallback(() => {
    resetMultiDocumentState();
    setFinalizeModalOpen(false);
  }, [resetMultiDocumentState, setFinalizeModalOpen]);

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
    selectedPartnerIds,
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
    // Multiple document creation state and handlers
    multiDocumentState,
    processNextDocument,
    cancelMultipleDocumentCreation,
    // Single document partner information
    singleDocumentPartner,
  };
};
