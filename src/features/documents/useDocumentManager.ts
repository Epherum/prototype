// src/features/documents/useDocumentManager.ts

"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { documentKeys } from "@/lib/queryKeys";
import {
  createDocument,
  fetchDocuments,
  getDocumentById, // --- NEW ---
  updateDocument, // --- NEW ---
  deleteDocument, // --- NEW ---
} from "@/services/clientDocumentService";
import { useJournalManager } from "@/features/journals/useJournalManager";

import type {
  Document,
  DocumentLineClientData,
  CreateDocumentClientData,
  UpdateDocumentClientData, // --- NEW ---
  Good,
} from "@/lib/types";

export const useDocumentManager = () => {
  const queryClient = useQueryClient();
  const { isTerminal, selectedJournalId } = useJournalManager();
  const { partner: selectedPartnerId } = useAppStore(
    (state) => state.selections
  );
  const { isCreating, lockedPartnerId } = useAppStore(
    (state) => state.ui.documentCreationState
  );
  const startDocumentCreation = useAppStore(
    (state) => state.startDocumentCreation
  );
  const cancelDocumentCreation = useAppStore(
    (state) => state.cancelDocumentCreation
  );

  // --- EXISTING STATE FOR CREATION ---
  const [lines, setLines] = useState<DocumentLineClientData[]>([]);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);

  // --- NEW STATE FOR EDIT/DELETE MODALS ---
  const [modalState, setModalState] = useState<{
    view: "closed" | "edit" | "delete" | "view";
    documentId: string | null;
  }>({ view: "closed", documentId: null });

  // --- EXISTING QUERY FOR DOCUMENT LIST ---
  const documentsQuery = useQuery({
    queryKey: documentKeys.list(selectedPartnerId),
    queryFn: () => {
      if (!selectedPartnerId || selectedPartnerId === "undefined") {
        return Promise.resolve({ data: [], total: 0 });
      }
      return fetchDocuments(selectedPartnerId);
    },
    enabled:
      !!selectedPartnerId && selectedPartnerId !== "undefined" && !isCreating,
  });

  // --- NEW QUERY FOR A SINGLE (ACTIVE) DOCUMENT FOR THE MODAL ---
  const {
    data: activeDocument,
    isLoading: isLoadingActiveDocument,
    isError: isErrorActiveDocument,
  } = useQuery({
    queryKey: documentKeys.detail(modalState.documentId),
    queryFn: () => getDocumentById(modalState.documentId!),
    enabled: modalState.documentId !== null && modalState.view !== "closed",
    // Do not refetch when the window is refocused, to avoid closing the modal unexpectedly
    refetchOnWindowFocus: false,
  });

  // --- NEW MUTATION FOR UPDATING A DOCUMENT ---
  const updateDocumentMutation = useMutation({
    mutationFn: (vars: { id: string; data: UpdateDocumentClientData }) =>
      updateDocument(vars),
    onSuccess: (updatedDocument) => {
      // Invalidate both the list of documents and the specific document detail query
      queryClient.invalidateQueries({
        queryKey: documentKeys.list(selectedPartnerId),
      });
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail(updatedDocument.id),
      });
      alert("Document updated successfully!");
      closeModal(); // Close the edit modal on success
    },
    onError: (error: Error) => {
      console.error("Failed to update document:", error);
      alert(`Error updating document: ${error.message}`);
    },
  });

  // --- NEW MUTATION FOR DELETING A DOCUMENT ---
  const deleteDocumentMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      // Invalidate the list of documents to remove the deleted one
      queryClient.invalidateQueries({
        queryKey: documentKeys.list(selectedPartnerId),
      });
      alert("Document deleted successfully.");
      closeModal(); // Close the confirmation modal
    },
    onError: (error: Error) => {
      console.error("Failed to delete document:", error);
      alert(`Error deleting document: ${error.message}`);
    },
  });

  // --- NEW HANDLERS FOR MODALS ---
  const openEditModal = (documentId: string) => {
    setModalState({ view: "edit", documentId });
  };

  const openDeleteModal = (documentId: string) => {
    setModalState({ view: "delete", documentId });
  };

  const openViewModal = (documentId: string) => {
    setModalState({ view: "view", documentId });
  };

  const closeModal = () => {
    setModalState({ view: "closed", documentId: null });
  };

  const handleConfirmDelete = () => {
    if (modalState.documentId) {
      deleteDocumentMutation.mutate(modalState.documentId);
    }
  };

  // --- EXISTING LOGIC (UNCHANGED) ---
  const canCreateDocument = useMemo(() => {
    const isPartnerValid =
      !!selectedPartnerId && selectedPartnerId !== "undefined";
    return isPartnerValid && isTerminal;
  }, [selectedPartnerId, isTerminal]);

  const handleStartCreation = useCallback(() => {
    if (!canCreateDocument || !selectedPartnerId || !selectedJournalId) {
      alert(
        "Please select a valid Partner and a single, terminal Journal account to proceed."
      );
      return;
    }
    startDocumentCreation(selectedPartnerId, selectedJournalId);
    setLines([]);
  }, [
    canCreateDocument,
    selectedPartnerId,
    selectedJournalId,
    startDocumentCreation,
  ]);

  const handleCancelCreation = useCallback(() => {
    cancelDocumentCreation();
    setLines([]);
  }, [cancelDocumentCreation]);

  const handleAddOrRemoveGood = useCallback((good: Good) => {
    if (!good.jpqLinkId) {
      console.error("Attempted to add a good without a jpqLinkId:", good);
      alert("This good cannot be added to a document in the current context.");
      return;
    }
    setLines((currentLines) => {
      const existingLineIndex = currentLines.findIndex(
        (line) => line.journalPartnerGoodLinkId === good.jpqLinkId
      );
      if (existingLineIndex > -1) {
        return currentLines.filter((_, index) => index !== existingLineIndex);
      } else {
        const newLine: DocumentLineClientData = {
          journalPartnerGoodLinkId: good.jpqLinkId,
          designation: good.label,
          quantity: 1,
          unitPrice: 0,
          taxRate: 0.2,
        };
        return [...currentLines, newLine];
      }
    });
  }, []);

  const handleUpdateLine = useCallback(
    (jpqLinkId: string, details: { quantity?: number; unitPrice?: number }) => {
      setLines((currentLines) =>
        currentLines.map((line) => {
          if (line.journalPartnerGoodLinkId === jpqLinkId) {
            const newQuantity = details.quantity;
            const newUnitPrice = details.unitPrice;

            return {
              ...line,
              quantity:
                newQuantity !== undefined && !isNaN(newQuantity)
                  ? newQuantity
                  : line.quantity,
              unitPrice:
                newUnitPrice !== undefined && !isNaN(newUnitPrice)
                  ? newUnitPrice
                  : line.unitPrice,
            };
          }
          return line;
        })
      );
    },
    []
  );

  const handleOpenFinalizeModal = () => {
    if (lines.length === 0) {
      alert("Please add at least one item to the document.");
      return;
    }
    setIsFinalizeModalOpen(true);
  };

  const createDocumentMutation = useMutation({
    mutationFn: (data: CreateDocumentClientData) => createDocument(data),
    onSuccess: (newDocument) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.list(lockedPartnerId),
      });
      alert(`Document '${newDocument.refDoc}' created successfully!`);
      handleCancelCreation();
    },
    onError: (error: Error) => {
      console.error("Failed to create document:", error);
      alert(`Error creating document: ${error.message}`);
    },
    onSettled: () => {
      setIsFinalizeModalOpen(false);
    },
  });

  const handleSubmit = useCallback(
    (headerData: { refDoc: string; date: Date; type: Document["type"] }) => {
      if (!lockedPartnerId) {
        alert(
          "Critical Error: Locked partner ID is missing. Cannot save document."
        );
        return;
      }
      const finalPayload: CreateDocumentClientData = {
        ...headerData,
        partnerId: lockedPartnerId,
        lines: lines,
      };
      createDocumentMutation.mutate(finalPayload);
    },
    [lockedPartnerId, lines, createDocumentMutation]
  );

  const documentsForSlider = useMemo(
    () => documentsQuery.data?.data || [],
    [documentsQuery.data]
  );

  const isGoodInDocument = useCallback(
    (good: Good): boolean => {
      if (!good.jpqLinkId) return false;
      return lines.some(
        (line) => line.journalPartnerGoodLinkId === good.jpqLinkId
      );
    },
    [lines]
  );

  // --- RETURN NEW AND EXISTING VALUES ---
  return {
    // Existing values for Creation
    isCreating,
    lines,
    documentsForSlider,
    documentsQuery,
    createDocumentMutation,
    isFinalizeModalOpen,
    canCreateDocument,
    handleStartCreation,
    handleCancelCreation,
    handleAddOrRemoveGood,
    handleUpdateLine,
    handleOpenFinalizeModal,
    handleSubmit,
    isGoodInDocument,
    setIsFinalizeModalOpen,

    // --- NEW --- Values for Edit/Delete/View
    modalState,
    activeDocument,
    isLoadingActiveDocument,
    isErrorActiveDocument,
    updateDocumentMutation,
    deleteDocumentMutation,
    openEditModal,
    openDeleteModal,
    openViewModal,
    closeModal,
    handleConfirmDelete,
  };
};
