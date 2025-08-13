// src/features/partners/usePartnerManager.ts
"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { partnerKeys } from "@/lib/queryKeys";
import { useAppStore } from "@/store/appStore";
import { getFirstId } from "@/lib/helpers";
import {
  createPartner,
  updatePartner,
  deletePartner,
} from "@/services/clientPartnerService";
import { useChainedQuery } from "@/hooks/useChainedQuery";
import { PartnerClient } from "@/lib/types/models.client";
import {
  CreatePartnerPayload,
  UpdatePartnerPayload,
} from "@/lib/schemas/partner.schema";
import { SLIDER_TYPES } from "@/lib/constants";

export const usePartnerManager = () => {
  const queryClient = useQueryClient();
  const { documentCreationState } = useAppStore((state) => state.ui);
  const selections = useAppStore((state) => state.selections);
  const setSelection = useAppStore((state) => state.setSelection);

  const [isPartnerOptionsMenuOpen, setIsPartnerOptionsMenuOpen] =
    useState(false);
  const [partnerOptionsMenuAnchorEl, setPartnerOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditPartnerModalOpen, setIsAddEditPartnerModalOpen] =
    useState(false);
  const [editingPartnerData, setEditingPartnerData] =
    useState<PartnerClient | null>(null);

  const setSelectedPartnerId = useCallback(
    (id: string | null) => {
      setSelection("partner", id);
    },
    [setSelection]
  );

  const { partner: selectedPartnerId } = selections;

  // The useChainedQuery hook now correctly returns a query for { data: PartnerClient[], totalCount: number }
  const queryOptions = useChainedQuery(SLIDER_TYPES.PARTNER);
  const activeQuery = useQuery(queryOptions);

  useEffect(() => {
    if (
      activeQuery.isSuccess &&
      activeQuery.data &&
      !documentCreationState.isCreating
    ) {
      const fetchedPartners = activeQuery.data.data;
      const currentSelectionInList =
        selectedPartnerId &&
        fetchedPartners.some((p) => p.id === selectedPartnerId);

      if (fetchedPartners.length > 0 && !currentSelectionInList) {
        setSelectedPartnerId(getFirstId(fetchedPartners));
      } else if (fetchedPartners.length === 0 && selectedPartnerId !== null) {
        setSelectedPartnerId(null);
      }
    }
  }, [
    activeQuery.data,
    activeQuery.isSuccess,
    selectedPartnerId,
    setSelectedPartnerId,
    documentCreationState.isCreating,
  ]);

  const createPartnerMutation = useMutation<
    PartnerClient,
    Error,
    CreatePartnerPayload
  >({
    mutationFn: createPartner,
    onSuccess: (newPartner) => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      setIsAddEditPartnerModalOpen(false);
      alert(`Partner '${newPartner.name}' created successfully!`);
      // Select the newly created partner
      setSelectedPartnerId(newPartner.id);
    },
    // Optional: Add onError for better user feedback
    onError: (error) => {
      alert(`Error creating partner: ${error.message}`);
      setIsAddEditPartnerModalOpen(false);
    },
  });

  const updatePartnerMutation = useMutation<
    PartnerClient,
    Error,
    { id: string; data: UpdatePartnerPayload }
  >({
    mutationFn: (variables) => updatePartner(variables.id, variables.data),
    onSuccess: (updatedPartner) => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      setIsAddEditPartnerModalOpen(false);
      alert(`Partner '${updatedPartner.name}' updated successfully!`);
    },
    // Optional: Add onError for better user feedback
    onError: (error) => {
      alert(`Error updating partner: ${error.message}`);
      setIsAddEditPartnerModalOpen(false);
    },
  });

  const deletePartnerMutation = useMutation<{ message: string }, Error, string>(
    {
      mutationFn: deletePartner,
      onSuccess: (response, deletedPartnerId) => {
        queryClient.invalidateQueries({ queryKey: partnerKeys.all });
        alert(
          response.message ||
            `Partner ${deletedPartnerId} deleted successfully!`
        );
        if (selectedPartnerId === deletedPartnerId) {
          setSelectedPartnerId(null);
        }
      },
      onError: (error, deletedPartnerId) => {
        alert(`Error deleting partner ${deletedPartnerId}: ${error.message}`);
      },
    }
  );

  const handleOpenPartnerOptionsMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setPartnerOptionsMenuAnchorEl(event.currentTarget);
      setIsPartnerOptionsMenuOpen(true);
    },
    []
  );

  const handleClosePartnerOptionsMenu = useCallback(() => {
    setPartnerOptionsMenuAnchorEl(null);
    setIsPartnerOptionsMenuOpen(false);
  }, []);

  const handleOpenAddPartnerModal = useCallback(() => {
    setEditingPartnerData(null);
    setIsAddEditPartnerModalOpen(true);
    handleClosePartnerOptionsMenu();
  }, [handleClosePartnerOptionsMenu]);

  const handleOpenEditPartnerModal = useCallback(() => {
    if (selectedPartnerId && activeQuery.data?.data) {
      const partnerToEdit = activeQuery.data.data.find(
        (p) => p.id === selectedPartnerId
      );
      if (partnerToEdit) {
        setEditingPartnerData(partnerToEdit);
        setIsAddEditPartnerModalOpen(true);
        handleClosePartnerOptionsMenu();
      }
    }
  }, [
    selectedPartnerId,
    activeQuery.data?.data,
    handleClosePartnerOptionsMenu,
  ]);

  const handleCloseAddEditPartnerModal = useCallback(
    () => setIsAddEditPartnerModalOpen(false),
    []
  );

  // ✅ REFINED: The handler now accepts the most complete type, `CreatePartnerPayload`,
  // which works for both create and update scenarios, eliminating the need for casts.
  const handleAddOrUpdatePartnerSubmit = useCallback(
    (data: CreatePartnerPayload) => {
      if (editingPartnerData) {
        updatePartnerMutation.mutate({
          id: editingPartnerData.id,
          data: data, // `data` is a valid `UpdatePartnerPayload`
        });
      } else {
        createPartnerMutation.mutate(data);
      }
    },
    [editingPartnerData, createPartnerMutation, updatePartnerMutation]
  );

  const handleDeleteCurrentPartner = useCallback(() => {
    if (selectedPartnerId) {
      if (window.confirm("Are you sure you want to delete this partner?")) {
        deletePartnerMutation.mutate(selectedPartnerId);
      }
    }
    handleClosePartnerOptionsMenu();
  }, [selectedPartnerId, deletePartnerMutation, handleClosePartnerOptionsMenu]);

  return {
    // State
    selectedPartnerId,
    partnersForSlider: activeQuery.data?.data ?? [],
    partnerQuery: activeQuery,
    isPartnerOptionsMenuOpen,
    partnerOptionsMenuAnchorEl,
    isAddEditPartnerModalOpen,
    editingPartnerData,

    // Mutations (exposing the whole mutation allows UI to read isPending, etc.)
    createPartnerMutation,
    updatePartnerMutation,
    deletePartnerMutation,

    // Handlers
    setSelectedPartnerId,
    handleOpenPartnerOptionsMenu,
    handleClosePartnerOptionsMenu,
    handleOpenAddPartnerModal,
    handleOpenEditPartnerModal,
    handleCloseAddEditPartnerModal,
    handleAddOrUpdatePartnerSubmit,
    handleDeleteCurrentPartner,
  };
};
