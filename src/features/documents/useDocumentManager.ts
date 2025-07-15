// src/features/documents/useDocumentManager.ts
"use client";

import { useMemo, useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { documentKeys } from "@/lib/queryKeys";
import {
  fetchDocuments,
  createDocument,
  createBulkDocuments,
} from "@/services/clientDocumentService";
import { SLIDER_TYPES } from "@/lib/constants";
import type {
  DocumentCreationMode,
  DocumentItem,
  Good,
  CreateDocumentClientData,
  Document,
} from "@/lib/types";

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

    const visibleOrder = sliderOrder.filter((id) => visibility[id]);
    const docIdx = visibleOrder.indexOf(SLIDER_TYPES.DOCUMENT);
    const partnerIdx = visibleOrder.indexOf(SLIDER_TYPES.PARTNER);
    const goodIdx = visibleOrder.indexOf(SLIDER_TYPES.GOODS);

    let creationMode: DocumentCreationMode = "IDLE";
    let initialState: Partial<typeof documentCreationState> = {};
    const journalContext =
      selections.journal.flatId || selections.journal.topLevelId;

    // Scenarios...
    if (
      docIdx === visibleOrder.length - 1 &&
      partnerIdx !== -1 &&
      goodIdx !== -1
    ) {
      if (!selections.partner || !selections.goods) {
        alert(
          "Please select a Partner and a Good before creating the document."
        );
        return;
      }
      creationMode = "SINGLE_ITEM";
      initialState = {
        lockedPartnerIds: [selections.partner],
        lockedGoodIds: [selections.goods],
        lockedJournalId: journalContext,
      };
      // For this specific flow, we call the action later
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
      if (!selections.goods) {
        alert("Please select a Good to lock in.");
        return;
      }
      creationMode = "LOCK_GOOD";
      initialState = {
        lockedGoodIds: [selections.goods],
        lockedJournalId: journalContext,
      };
    } else if (docIdx < partnerIdx && partnerIdx < goodIdx) {
      creationMode = "INTERSECT_FROM_PARTNER";
      initialState = { lockedJournalId: journalContext };
    } else if (docIdx < goodIdx && goodIdx < partnerIdx) {
      creationMode = "INTERSECT_FROM_GOOD";
      initialState = { lockedJournalId: journalContext };
    }

    // === START OF LOGGING ===
    console.groupCollapsed(`[DEBUG: useDocumentManager] handleStartCreation`);
    console.log("Visible slider order:", visibleOrder);
    console.log(
      `Determined creationMode: %c${creationMode}`,
      "font-weight: bold;"
    );
    console.log("Initial state to be dispatched:", initialState);
    console.groupEnd();
    // === END OF LOGGING ===

    if (creationMode !== "IDLE") {
      startDocumentCreation(creationMode, initialState);
      if (creationMode === "SINGLE_ITEM") {
        setQuantityModalState({ isOpen: true, goodId: selections.goods });
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

  // ... rest of the file is unchanged
  const handleCancelCreation = useCallback(() => {
    cancelDocumentCreation();
    setIsFinalizeModalOpen(false);
    setQuantityModalState({ isOpen: false, goodId: null });
  }, [cancelDocumentCreation]);

  const handleSingleItemSubmit = useCallback(
    ({ good, quantity }: { good: Good; quantity: number }) => {
      const newItem: DocumentItem = {
        goodId: good.id,
        goodLabel: good.label || good.name || "Unknown Good",
        quantity: quantity,
        unitPrice: good.price || 0,
      };
      setDocumentItems([newItem]);
      setQuantityModalState({ isOpen: false, goodId: null });
      setIsFinalizeModalOpen(true);
    },
    [setDocumentItems]
  );

  const createDocMutation = useMutation<
    Document | { success: boolean; createdCount: number },
    Error,
    CreateDocumentClientData | CreateDocumentClientData[]
  >({
    mutationFn: (
      data: CreateDocumentClientData | CreateDocumentClientData[]
    ) => {
      if (Array.isArray(data)) {
        return createBulkDocuments(data);
      }
      return createDocument(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      alert(`Document(s) created successfully!`);
      handleCancelCreation();
    },
    onError: (error: Error) => {
      alert(`Error creating document(s): ${error.message}`);
    },
    onSettled: () => {
      setIsFinalizeModalOpen(false);
    },
  });

  const handlePrepareFinalization = useCallback(
    (allGoodsInSlider: Good[]) => {
      const success = prepareDocumentForFinalization(allGoodsInSlider);
      if (success) {
        setIsFinalizeModalOpen(true);
      }
    },
    [prepareDocumentForFinalization]
  );

  const handleSubmit = useCallback(
    (headerData: { refDoc: string; date: Date; type: any }) => {
      if (items.length === 0) {
        alert("Cannot create a document with no lines.");
        return;
      }
      const lines = items.map((item) => ({
        journalPartnerGoodLinkId:
          item.journalPartnerGoodLinkId || `NEEDS_REAL_ID_FOR_${item.goodId}`,
        designation: item.goodLabel,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: 0.2,
      }));
      if (
        mode === "LOCK_GOOD" ||
        mode === "INTERSECT_FROM_PARTNER" ||
        mode === "INTERSECT_FROM_GOOD"
      ) {
        if (lockedPartnerIds.length === 0) {
          alert("Error: No partners selected for document creation.");
          return;
        }
        const payloads = lockedPartnerIds.map((partnerId) => ({
          ...headerData,
          partnerId,
          lines,
        }));
        createDocMutation.mutate(payloads);
      } else {
        if (lockedPartnerIds.length !== 1) {
          alert("Error: Exactly one partner must be locked for this mode.");
          return;
        }
        const payload = {
          ...headerData,
          partnerId: lockedPartnerIds[0],
          lines,
        };
        createDocMutation.mutate(payload);
      }
    },
    [documentCreationState, items, createDocMutation]
  );

  const documentsQuery = useQuery({
    queryKey: documentKeys.list(selections.partner),
    queryFn: () => fetchDocuments(selections.partner!),
    enabled: !!selections.partner && !isCreating,
  });

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
    documentsForSlider: documentsQuery.data?.data || [],
    documentsQuery,
    handlePrepareFinalization,
    isFinalizeModalOpen,
    setIsFinalizeModalOpen,
    createDocumentMutation: createDocMutation,
  };
};
