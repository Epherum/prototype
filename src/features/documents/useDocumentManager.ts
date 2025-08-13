// src/features/documents/useDocumentManager.ts
"use client";

import { useMemo, useCallback, useState } from "react";
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
} from "@/lib/schemas/document.schema";
import type { DocumentCreationMode, DocumentItem } from "@/lib/types/ui";

import { useChainedQuery } from "@/hooks/useChainedQuery";

export const useDocumentManager = () => {
  const queryClient = useQueryClient();

  const { sliderOrder, visibility, documentCreationState } = useAppStore(
    (state) => state.ui
  );
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
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [quantityModalState, setQuantityModalState] = useState<{
    isOpen: boolean;
    goodId: string | null;
  }>({ isOpen: false, goodId: null });

  const {
    isCreating,
    mode,
    lockedPartnerIds,
    lockedGoodIds,
    items,
    lockedJournalId,
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

    let creationMode: DocumentCreationMode = "IDLE";
    let initialState: Partial<typeof documentCreationState> = {};

    if (
      docIdx === visibleOrder.length - 1 &&
      partnerIdx !== -1 &&
      goodIdx !== -1
    ) {
      if (!selections.partner || !selections.good) {
        // ✅ RENAMED: selections.goods -> selections.good
        alert(
          "Please select a Partner and a Good before creating the document."
        );
        return;
      }
      creationMode = "SINGLE_ITEM";
      initialState = {
        lockedPartnerIds: [selections.partner],
        lockedGoodIds: [selections.good], // ✅ RENAMED
        lockedJournalId: journalContext,
      };
    } else if (partnerIdx < docIdx && docIdx < goodIdx) {
      if (!selections.partner) {
        alert("Please select a Partner to lock in.");
        return;
      }
      creationMode = "LOCK_PARTNER";
      initialState = {
        lockedPartnerIds: [selections.partner],
        lockedJournalId: journalContext,
      };
    } else if (goodIdx < docIdx && docIdx < partnerIdx) {
      if (!selections.good) {
        // ✅ RENAMED
        alert("Please select a Good to lock in.");
        return;
      }
      creationMode = "LOCK_GOOD";
      initialState = {
        lockedGoodIds: [selections.good], // ✅ RENAMED
        lockedJournalId: journalContext,
      };
    } else if (docIdx < partnerIdx && partnerIdx < goodIdx) {
      creationMode = "INTERSECT_FROM_PARTNER";
      initialState = { lockedJournalId: journalContext };
    } else if (docIdx < goodIdx && goodIdx < partnerIdx) {
      creationMode = "INTERSECT_FROM_GOOD";
      initialState = { lockedJournalId: journalContext };
    }

    if (creationMode !== "IDLE") {
      startDocumentCreation(creationMode, initialState);
      if (creationMode === "SINGLE_ITEM") {
        setQuantityModalState({ isOpen: true, goodId: selections.good }); // ✅ RENAMED
      }
    } else {
      alert(
        "Document creation is not supported in the current slider configuration."
      );
    }
  }, [
    isJournalFirst,
    sliderOrder,
    visibility,
    selections,
    startDocumentCreation,
  ]);

  const handleCancelCreation = useCallback(() => {
    cancelDocumentCreation();
    setIsFinalizeModalOpen(false);
    setQuantityModalState({ isOpen: false, goodId: null });
  }, [cancelDocumentCreation]);

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
      setQuantityModalState({ isOpen: false, goodId: null });
      setIsFinalizeModalOpen(true);
    },
    [setDocumentItems]
  );

  // ✅ REFACTORED: Mutation now handles a single document creation.
  const createDocMutation = useMutation<
    DocumentClient,
    Error,
    CreateDocumentPayload
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
      // ✅ TYPE: Good[] -> GoodClient[]
      const success = prepareDocumentForFinalization(allGoodsInSlider);
      if (success) {
        setIsFinalizeModalOpen(true);
      }
    },
    [prepareDocumentForFinalization]
  );

  // ✅ REFACTORED: Logic now iterates and calls the single-item mutation.
  const handleSubmit = useCallback(
    async (headerData: { refDoc: string; date: Date; type: any }) => {
      if (!lockedJournalId) {
        alert("Critical Error: Journal ID is missing for document creation.");
        return;
      }
      if (items.length === 0) {
        alert("Cannot create a document with no lines.");
        return;
      }

      const lines: DocumentLinePayload[] = items.map((item) => {
        if (!item.journalPartnerGoodLinkId) {
          throw new Error(
            `Could not find required Link ID for item: ${item.goodLabel}`
          );
        }
        return {
          journalPartnerGoodLinkId: item.journalPartnerGoodLinkId,
          designation: item.goodLabel,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: 0.2, // This should likely come from data, but 0.2 is the placeholder
        };
      });

      let payloadsToCreate: CreateDocumentPayload[] = [];

      if (
        mode === "LOCK_GOOD" ||
        mode === "INTERSECT_FROM_PARTNER" ||
        mode === "INTERSECT_FROM_GOOD"
      ) {
        if (lockedPartnerIds.length === 0) {
          alert("Error: No partners selected for document creation.");
          return;
        }
        payloadsToCreate = lockedPartnerIds.map((partnerId) => ({
          ...headerData,
          journalId: lockedJournalId,
          partnerId,
          lines,
        }));
      } else {
        if (lockedPartnerIds.length !== 1) {
          alert("Error: Exactly one partner must be locked for this mode.");
          return;
        }
        payloadsToCreate.push({
          ...headerData,
          journalId: lockedJournalId,
          partnerId: lockedPartnerIds[0],
          lines,
        });
      }

      // Create documents sequentially
      let successCount = 0;
      for (const payload of payloadsToCreate) {
        try {
          await createDocMutation.mutateAsync(payload);
          successCount++;
        } catch (e) {
          // Error is already handled by the mutation's onError, but we stop processing.
          break;
        }
      }

      if (successCount > 0) {
        alert(`${successCount} document(s) created successfully!`);
        handleCancelCreation();
      }

      setIsFinalizeModalOpen(false);
    },
    [
      documentCreationState,
      items,
      createDocMutation,
      handleCancelCreation,
      lockedJournalId,
    ]
  );

  const documentsQuery = useQuery(useChainedQuery(SLIDER_TYPES.DOCUMENT));

  return {
    isCreating,
    mode,
    isJournalFirst,
    lockedPartnerIds,
    lockedGoodIds,
    items,
    quantityModalState,
    handleStartCreation,
    handleCancelCreation,
    toggleEntityForDocument,
    setDocumentItems,
    handleSubmit,
    handleSingleItemSubmit,
    documentsForSlider: (documentsQuery.data?.data || []) as DocumentClient[], // ✅ TYPE CAST
    documentsQuery,
    handlePrepareFinalization,
    isFinalizeModalOpen,
    setIsFinalizeModalOpen,
    createDocumentMutation: createDocMutation,
  };
};
