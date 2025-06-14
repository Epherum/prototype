// src/features/partners/usePartnerManager.ts
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { SLIDER_TYPES } from "@/lib/constants";
import { getFirstId } from "@/lib/helpers";

import {
  fetchPartners,
  createPartner,
  updatePartner,
  deletePartner,
} from "@/services/clientPartnerService";

import { useJournalManager } from "@/features/journals/useJournalManager";

import type {
  Partner,
  CreatePartnerClientData,
  UpdatePartnerClientData,
  FetchPartnersParams,
} from "@/lib/types";

export const usePartnerManager = () => {
  const queryClient = useQueryClient();

  // --- Consume state from Zustand ---
  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const selections = useAppStore((state) => state.selections);
  const setSelection = useAppStore((state) => state.setSelection);
  const effectiveRestrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );

  const {
    journal: journalSelections,
    goods: selectedGoodsId,
    partner: selectedPartnerId,
  } = selections;

  // --- Consume the specialist hook for derived journal data ---
  const { effectiveSelectedJournalIds, isJournalSliderPrimary } =
    useJournalManager();

  // --- Local UI state for modals/menus ---
  const [isPartnerOptionsMenuOpen, setIsPartnerOptionsMenuOpen] =
    useState(false);
  const [partnerOptionsMenuAnchorEl, setPartnerOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditPartnerModalOpen, setIsAddEditPartnerModalOpen] =
    useState(false);
  const [editingPartnerData, setEditingPartnerData] = useState<Partner | null>(
    null
  );

  const setSelectedPartnerId = useCallback(
    (id: string | null) => {
      setSelection("partner", id);
    },
    [setSelection]
  );

  // --- CORRECTED: Robust Query Parameter Generation ---
  const partnerQueryKeyParamsStructure = useMemo((): FetchPartnersParams => {
    let params: FetchPartnersParams = { limit: 1000, offset: 0 };
    const partnerIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);

    // --- KEY FIX 1: ALWAYS apply general filters first. ---
    // This ensures "unaffected" and "inProcess" work regardless of slider order.
    params.filterStatuses = journalSelections.rootFilter;
    params.restrictedJournalId = effectiveRestrictedJournalId;

    // --- KEY FIX 2: ONLY add the specific `contextJournalIds` when needed. ---
    // This is an additional parameter just for the "affected" case in the J-P flow.
    if (
      isJournalSliderPrimary &&
      journalSelections.rootFilter.includes("affected")
    ) {
      params.contextJournalIds = effectiveSelectedJournalIds;
    }

    // Handle other, mutually exclusive slider order logic (e.g., G-J-P)
    if (
      sliderOrder.indexOf(SLIDER_TYPES.GOODS) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1 &&
      partnerIndex === 2
    ) {
      if (selectedGoodsId && journalSelections.flatId) {
        params.linkedToJournalIds = [journalSelections.flatId];
        params.linkedToGoodId = selectedGoodsId;
      }
    }

    return params;
  }, [
    sliderOrder,
    journalSelections.rootFilter,
    journalSelections.flatId,
    effectiveSelectedJournalIds,
    effectiveRestrictedJournalId,
    selectedGoodsId,
    isJournalSliderPrimary,
  ]);

  const partnerQueryKey = useMemo(
    () => ["partners", partnerQueryKeyParamsStructure],
    [partnerQueryKeyParamsStructure]
  );

  // --- CORRECTED: Robust Query Enabled Logic ---
  const isPartnerQueryEnabled = useMemo(() => {
    if (!visibility[SLIDER_TYPES.PARTNER]) {
      return false;
    }

    // Case 1: Partner is the first slider, always fetch all partners.
    if (sliderOrder.indexOf(SLIDER_TYPES.PARTNER) === 0) {
      return true;
    }

    // Case 2: ANY root filter is active. This covers "affected", "unaffected",
    // and "inProcess" correctly.
    if (journalSelections.rootFilter.length > 0) {
      return true;
    }

    // You can add other specific flow conditions here if needed.
    // e.g., for G-J-P flow
    const params = partnerQueryKeyParamsStructure;
    if (params.linkedToGoodId && params.linkedToJournalIds?.length > 0) {
      return true;
    }

    // Default to disabled if no valid condition is met.
    return false;
  }, [
    visibility,
    sliderOrder,
    journalSelections.rootFilter,
    partnerQueryKeyParamsStructure,
  ]);

  const partnerQuery = useQuery<{ data: Partner[] }>({
    queryKey: partnerQueryKey,
    queryFn: () => fetchPartners(partnerQueryKeyParamsStructure),
    enabled: isPartnerQueryEnabled,
  });

  // Auto-selection logic (unchanged)
  useEffect(() => {
    if (partnerQuery.isSuccess && partnerQuery.data) {
      const fetchedPartners = partnerQuery.data.data;
      const currentSelectionInList =
        selectedPartnerId &&
        fetchedPartners.some((p) => String(p.id) === selectedPartnerId);
      if (fetchedPartners.length > 0 && !currentSelectionInList) {
        setSelectedPartnerId(getFirstId(fetchedPartners));
      } else if (fetchedPartners.length === 0 && selectedPartnerId !== null) {
        setSelectedPartnerId(null);
      }
    }
  }, [
    partnerQuery.data,
    partnerQuery.isSuccess,
    selectedPartnerId,
    setSelectedPartnerId,
  ]);

  // --- Mutations and Modal Handlers (No changes needed) ---
  const createPartnerMutation = useMutation<
    Partner,
    Error,
    CreatePartnerClientData
  >({
    mutationFn: createPartner,
    onSuccess: (newPartner) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      setIsAddEditPartnerModalOpen(false);
      setEditingPartnerData(null);
      alert(`Partner '${newPartner.name}' created successfully!`);
      setSelectedPartnerId(String(newPartner.id));
    },
    onError: (error: Error) => {
      console.error("Failed to create partner:", error);
      alert(`Error creating partner: ${error.message}`);
    },
  });

  const updatePartnerMutation = useMutation<
    Partner,
    Error,
    { id: string; data: UpdatePartnerClientData }
  >({
    mutationFn: (variables) => updatePartner(variables.id, variables.data),
    onSuccess: (updatedPartner) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      setIsAddEditPartnerModalOpen(false);
      setEditingPartnerData(null);
      alert(`Partner '${updatedPartner.name}' updated successfully!`);
    },
    onError: (error: Error) => {
      console.error("Failed to update partner:", error);
      alert(`Error updating partner: ${error.message}`);
    },
  });

  const deletePartnerMutation = useMutation<{ message: string }, Error, string>(
    {
      mutationFn: deletePartner,
      onSuccess: (response, deletedPartnerId) => {
        queryClient.invalidateQueries({ queryKey: ["partners"] });
        alert(
          response.message ||
            `Partner ${deletedPartnerId} deleted successfully!`
        );
        if (selectedPartnerId === deletedPartnerId) {
          setSelectedPartnerId(null);
        }
      },
      onError: (error: Error, deletedPartnerId) => {
        console.error(`Failed to delete partner ${deletedPartnerId}:`, error);
        alert(`Error deleting partner: ${error.message}`);
      },
    }
  );

  // Modal handler callbacks (unchanged)
  const handleOpenPartnerOptionsMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setPartnerOptionsMenuAnchorEl(event.currentTarget);
      setIsPartnerOptionsMenuOpen(true);
    },
    []
  );
  const handleClosePartnerOptionsMenu = useCallback(() => {
    setIsPartnerOptionsMenuOpen(false);
    setPartnerOptionsMenuAnchorEl(null);
  }, []);
  const handleOpenAddPartnerModal = useCallback(() => {
    setEditingPartnerData(null);
    setIsAddEditPartnerModalOpen(true);
    handleClosePartnerOptionsMenu();
  }, [handleClosePartnerOptionsMenu]);
  const handleOpenEditPartnerModal = useCallback(() => {
    if (selectedPartnerId && partnerQuery.data?.data) {
      const partnerToEdit = partnerQuery.data.data.find(
        (p) => String(p.id) === selectedPartnerId
      );
      if (partnerToEdit) {
        setEditingPartnerData(partnerToEdit);
        setIsAddEditPartnerModalOpen(true);
      } else {
        alert("Selected partner data not found.");
      }
    }
    handleClosePartnerOptionsMenu();
  }, [selectedPartnerId, partnerQuery.data, handleClosePartnerOptionsMenu]);
  const handleCloseAddEditPartnerModal = useCallback(() => {
    setIsAddEditPartnerModalOpen(false);
    setEditingPartnerData(null);
  }, []);
  const handleAddOrUpdatePartnerSubmit = useCallback(
    (
      dataFromModal: CreatePartnerClientData | UpdatePartnerClientData,
      partnerIdToUpdate?: string
    ) => {
      if (partnerIdToUpdate && editingPartnerData) {
        updatePartnerMutation.mutate({
          id: partnerIdToUpdate,
          data: dataFromModal as UpdatePartnerClientData,
        });
      } else {
        createPartnerMutation.mutate(dataFromModal as CreatePartnerClientData);
      }
    },
    [editingPartnerData, createPartnerMutation, updatePartnerMutation]
  );
  const handleDeleteCurrentPartner = useCallback(() => {
    if (selectedPartnerId) {
      if (
        window.confirm(
          `Are you sure you want to delete partner with ID ${selectedPartnerId}? This might affect related documents or links.`
        )
      ) {
        deletePartnerMutation.mutate(selectedPartnerId);
      }
    }
    handleClosePartnerOptionsMenu();
  }, [selectedPartnerId, deletePartnerMutation, handleClosePartnerOptionsMenu]);

  return {
    selectedPartnerId,
    setSelectedPartnerId,
    partnersForSlider: partnerQuery.data?.data || [],
    partnerQuery,
    isPartnerOptionsMenuOpen,
    partnerOptionsMenuAnchorEl,
    isAddEditPartnerModalOpen,
    editingPartnerData,
    partnerQueryKey,
    createPartnerMutation,
    updatePartnerMutation,
    deletePartnerMutation,
    handleOpenPartnerOptionsMenu,
    handleClosePartnerOptionsMenu,
    handleOpenAddPartnerModal,
    handleOpenEditPartnerModal,
    handleCloseAddEditPartnerModal,
    handleAddOrUpdatePartnerSubmit,
    handleDeleteCurrentPartner,
  };
};
