//src/features/partners/usePartnerManager.ts
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
  type UseQueryResult,
} from "@tanstack/react-query";
import { partnerKeys } from "@/lib/queryKeys";
import { useAppStore } from "@/store/appStore";
import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import { getFirstId } from "@/lib/helpers";
import {
  fetchPartners,
  createPartner,
  updatePartner,
  deletePartner,
  getPartnersForGoods,
} from "@/services/clientPartnerService";
import { useJournalManager } from "@/features/journals/useJournalManager";
import type {
  Partner,
  CreatePartnerClientData,
  UpdatePartnerClientData,
  PaginatedPartnersResponse,
} from "@/lib/types";
import { useChainedQuery } from "@/hooks/useChainedQuery";

export const usePartnerManager = () => {
  const queryClient = useQueryClient();

  const { sliderOrder, visibility, documentCreationState } = useAppStore(
    (state) => state.ui
  );
  const selections = useAppStore((state) => state.selections);
  const setSelection = useAppStore((state) => state.setSelection);
  const effectiveRestrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );

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

  const {
    journal: journalSelections,
    goods: selectedGoodsId,
    partner: selectedPartnerId,
  } = selections;

  // ✅ The type is now inferred correctly from useChainedQuery.
  const queryOptions = useChainedQuery(SLIDER_TYPES.PARTNER);

  // ✅ No more generics needed, resolving both the 'No overload' and 'property data does not exist' errors.
  const activeQuery = useQuery(queryOptions);

  // --- (useEffect for selection, Mutations and Modal Handlers are unchanged) ---
  useEffect(() => {
    if (
      activeQuery.isSuccess &&
      activeQuery.data &&
      !documentCreationState.isCreating
    ) {
      const fetchedPartners = activeQuery.data.data;
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
    activeQuery.data,
    activeQuery.isSuccess,
    selectedPartnerId,
    setSelectedPartnerId,
    documentCreationState.isCreating,
  ]);

  //... all mutations and handlers remain the same from here

  const createPartnerMutation = useMutation<
    Partner,
    Error,
    CreatePartnerClientData
  >({
    mutationFn: createPartner,
    onSuccess: (newPartner) => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      setIsAddEditPartnerModalOpen(false);
      alert(`Partner '${newPartner.name}' created successfully!`);
      setSelectedPartnerId(String(newPartner.id));
    },
  });
  const updatePartnerMutation = useMutation<
    Partner,
    Error,
    { id: string; data: UpdatePartnerClientData }
  >({
    mutationFn: (variables) => updatePartner(variables.id, variables.data),
    onSuccess: (updatedPartner) => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      setIsAddEditPartnerModalOpen(false);
      alert(`Partner '${updatedPartner.name}' updated successfully!`);
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
        if (selectedPartnerId === deletedPartnerId) setSelectedPartnerId(null);
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
  const handleClosePartnerOptionsMenu = useCallback(
    () => setIsPartnerOptionsMenuOpen(false),
    []
  );
  const handleOpenAddPartnerModal = useCallback(() => {
    setEditingPartnerData(null);
    setIsAddEditPartnerModalOpen(true);
    handleClosePartnerOptionsMenu();
  }, [handleClosePartnerOptionsMenu]);
  const handleOpenEditPartnerModal = useCallback(() => {
    if (selectedPartnerId && activeQuery.data?.data) {
      const partnerToEdit = activeQuery.data.data.find(
        (p) => String(p.id) === selectedPartnerId
      );
      //@ts-ignore

      if (partnerToEdit) setEditingPartnerData(partnerToEdit);
    }
    setIsAddEditPartnerModalOpen(true);
    handleClosePartnerOptionsMenu();
  }, [selectedPartnerId, activeQuery.data, handleClosePartnerOptionsMenu]);
  const handleCloseAddEditPartnerModal = useCallback(
    () => setIsAddEditPartnerModalOpen(false),
    []
  );
  const handleAddOrUpdatePartnerSubmit = useCallback(
    (data: CreatePartnerClientData | UpdatePartnerClientData) => {
      if (editingPartnerData) {
        updatePartnerMutation.mutate({
          id: editingPartnerData.id,
          data: data as UpdatePartnerClientData,
        });
      } else {
        createPartnerMutation.mutate(data as CreatePartnerClientData);
      }
    },
    [editingPartnerData, createPartnerMutation, updatePartnerMutation]
  );
  const handleDeleteCurrentPartner = useCallback(() => {
    if (selectedPartnerId) deletePartnerMutation.mutate(selectedPartnerId);
    handleClosePartnerOptionsMenu();
  }, [selectedPartnerId, deletePartnerMutation, handleClosePartnerOptionsMenu]);

  return {
    selectedPartnerId,
    setSelectedPartnerId,
    partnersForSlider: activeQuery.data?.data || [],
    partnerQuery: activeQuery,
    isPartnerOptionsMenuOpen,
    partnerOptionsMenuAnchorEl,
    isAddEditPartnerModalOpen,
    editingPartnerData,
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
