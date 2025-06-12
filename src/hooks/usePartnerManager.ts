// src/hooks/usePartnerManager.ts
"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchPartners,
  createPartner,
  updatePartner,
  deletePartner,
} from "@/services/clientPartnerService";
import type {
  Partner,
  CreatePartnerClientData,
  UpdatePartnerClientData,
  FetchPartnersParams,
  ActivePartnerFilters,
} from "@/lib/types";
import { getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";

export interface UsePartnerManagerProps {
  sliderOrder: string[];
  visibility: { [key: string]: boolean };
  effectiveSelectedJournalIds: string[];
  selectedGoodsId: string | null;
  selectedJournalIdForGjpFiltering: string | null;
  filterStatuses: ActivePartnerFilters;
  effectiveRestrictedJournalId: string | null;
  isJournalHierarchyLoading: boolean;
  isFlatJournalsQueryForGoodLoading: boolean;
  isGPGOrderActive?: boolean;
  gpgContextJournalId?: string | null;
}

export const usePartnerManager = (props: UsePartnerManagerProps) => {
  const {
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds,
    selectedGoodsId,
    selectedJournalIdForGjpFiltering,
    filterStatuses,
    effectiveRestrictedJournalId,
    isJournalHierarchyLoading,
    isFlatJournalsQueryForGoodLoading,
    isGPGOrderActive,
    gpgContextJournalId,
  } = props;

  const queryClient = useQueryClient();
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    null
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

  const partnerQueryKeyParamsStructure = useMemo((): FetchPartnersParams => {
    const orderString = sliderOrder.join("-");
    let params: FetchPartnersParams = { limit: 1000, offset: 0 };
    const partnerIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);

    if (isGPGOrderActive && partnerIndex === 1) {
      if (gpgContextJournalId) {
        params.linkedToJournalIds = [gpgContextJournalId];
        params.includeChildren = false;
      } else {
        params.linkedToJournalIds = ["__NO_GPG_CONTEXT_JOURNAL__"];
      }
    } else if (
      orderString.startsWith(`${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.PARTNER}`)
    ) {
      params.filterStatuses = filterStatuses;
      params.restrictedJournalId = effectiveRestrictedJournalId;
      if (filterStatuses.includes("affected")) {
        params.contextJournalIds = effectiveSelectedJournalIds;
      }
    } else if (
      orderString.startsWith(
        `${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.GOODS}-${SLIDER_TYPES.PARTNER}`
      )
    ) {
      if (effectiveSelectedJournalIds.length > 0 && selectedGoodsId) {
        params.linkedToJournalIds = [...effectiveSelectedJournalIds];
        params.linkedToGoodId = selectedGoodsId;
        params.includeChildren = true;
      }
    } else if (
      orderString.startsWith(
        `${SLIDER_TYPES.GOODS}-${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.PARTNER}`
      )
    ) {
      if (selectedGoodsId && selectedJournalIdForGjpFiltering) {
        params.linkedToJournalIds = [selectedJournalIdForGjpFiltering];
        params.linkedToGoodId = selectedGoodsId;
        params.includeChildren = false;
      }
    }
    return params;
  }, [
    sliderOrder,
    filterStatuses,
    effectiveSelectedJournalIds,
    effectiveRestrictedJournalId,
    selectedGoodsId,
    selectedJournalIdForGjpFiltering,
    isGPGOrderActive,
    gpgContextJournalId,
  ]);

  const partnerQueryKey = useMemo(
    () => ["partners", partnerQueryKeyParamsStructure],
    [partnerQueryKeyParamsStructure]
  );

  // ============================ FIX IS HERE ============================
  const isPartnerQueryEnabled = useMemo(() => {
    if (!visibility[SLIDER_TYPES.PARTNER]) {
      return false;
    }

    const partnerIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);
    const orderString = sliderOrder.join("-");

    if (
      orderString.startsWith(`${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.PARTNER}`)
    ) {
      // Rule 1: If no filters are active at all, disable the query.
      if (filterStatuses.length === 0) {
        return false;
      }

      // Rule 2: Check if there are any filters that DON'T require journal selections.
      // If 'unaffected' or 'inProcess' is selected, the query should run regardless
      // of the 'affected' state, to allow for the UNION behavior.
      const hasContextFreeFilter = filterStatuses.some(
        (status) => status === "unaffected" || status === "inProcess"
      );
      if (hasContextFreeFilter) {
        return !isJournalHierarchyLoading;
      }

      // Rule 3: If we're here, it means 'affected' is the ONLY active filter.
      // In this specific case, the query is only enabled if journals are selected.
      if (filterStatuses.includes("affected")) {
        return (
          effectiveSelectedJournalIds.length > 0 && !isJournalHierarchyLoading
        );
      }

      // Fallback for safety, though this path should not be hit with current filters.
      return false;
    }

    // --- Logic for other slider orders ---
    if (isGPGOrderActive && partnerIndex === 1) {
      return !!gpgContextJournalId;
    } else if (partnerIndex === 0) {
      return true;
    } else if (
      orderString.startsWith(
        `${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.GOODS}-${SLIDER_TYPES.PARTNER}`
      )
    ) {
      return (
        effectiveSelectedJournalIds.length > 0 &&
        !!selectedGoodsId &&
        !isJournalHierarchyLoading &&
        !isFlatJournalsQueryForGoodLoading
      );
    } else if (
      orderString.startsWith(
        `${SLIDER_TYPES.GOODS}-${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.PARTNER}`
      )
    ) {
      return (
        !!selectedGoodsId &&
        !!selectedJournalIdForGjpFiltering &&
        !isFlatJournalsQueryForGoodLoading
      );
    }

    return false;
  }, [
    visibility,
    sliderOrder,
    filterStatuses,
    effectiveSelectedJournalIds,
    isJournalHierarchyLoading,
    isGPGOrderActive,
    gpgContextJournalId,
    selectedGoodsId,
    isFlatJournalsQueryForGoodLoading,
    selectedJournalIdForGjpFiltering,
  ]);
  // ========================= END OF FIX ==========================

  const partnerQuery = useQuery<Partner[], Error>({
    queryKey: partnerQueryKey,
    queryFn: async (): Promise<Partner[]> => {
      const params = partnerQueryKeyParamsStructure;
      const currentOrderString = sliderOrder.join("-");

      if (params.linkedToJournalIds?.includes("__NO_GPG_CONTEXT_JOURNAL__")) {
        return [];
      }
      if (
        currentOrderString.startsWith(
          `${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.GOODS}-${SLIDER_TYPES.PARTNER}`
        ) &&
        (!params.linkedToGoodId ||
          !params.linkedToJournalIds ||
          params.linkedToJournalIds.length === 0)
      ) {
        return [];
      }
      if (
        currentOrderString.startsWith(
          `${SLIDER_TYPES.GOODS}-${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.PARTNER}`
        ) &&
        (!params.linkedToGoodId ||
          !params.linkedToJournalIds ||
          params.linkedToJournalIds.length === 0)
      ) {
        return [];
      }
      const result = await fetchPartners(params);
      return result.data.map((p: any) => ({ ...p, id: String(p.id) }));
    },
    enabled: isPartnerQueryEnabled,
  });

  useEffect(() => {
    if (!isPartnerQueryEnabled && partnerQuery.data?.length) {
      queryClient.setQueryData(partnerQueryKey, []);
    }
  }, [isPartnerQueryEnabled, partnerQuery.data, partnerQueryKey, queryClient]);

  const partnersForSlider = useMemo(
    () => partnerQuery.data || [],
    [partnerQuery.data]
  );

  // ... (rest of the hook remains unchanged)
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

  useEffect(() => {
    if (isGPGOrderActive) {
      // Handled by page.tsx
    }
  }, [isGPGOrderActive, gpgContextJournalId, partnerQuery.data]);

  useEffect(() => {
    if (partnerQuery.isSuccess && partnerQuery.data) {
      const fetchedPartners = partnerQuery.data;
      const currentSelectionInList =
        selectedPartnerId &&
        fetchedPartners.some((p) => p.id === selectedPartnerId);
      if (fetchedPartners.length > 0 && !currentSelectionInList) {
        setSelectedPartnerId(getFirstId(fetchedPartners));
      } else if (fetchedPartners.length === 0 && selectedPartnerId !== null) {
        setSelectedPartnerId(null);
      }
    } else if (
      !partnerQuery.isLoading &&
      !partnerQuery.isFetching &&
      !partnerQuery.isError &&
      selectedPartnerId !== null
    ) {
      if (!partnerQuery.data || partnerQuery.data.length === 0) {
        setSelectedPartnerId(null);
      }
    }
  }, [
    partnerQuery.data,
    partnerQuery.isSuccess,
    partnerQuery.isLoading,
    partnerQuery.isFetching,
    partnerQuery.isError,
    selectedPartnerId,
  ]);

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
    if (selectedPartnerId && partnerQuery.data) {
      const partnerToEdit = partnerQuery.data.find(
        (p) => p.id === selectedPartnerId
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
        const payloadForUpdate: UpdatePartnerClientData = {
          name: dataFromModal.name,
          notes: dataFromModal.notes,
          logoUrl: (dataFromModal as any).logoUrl,
          photoUrl: (dataFromModal as any).photoUrl,
          isUs: (dataFromModal as any).isUs,
          registrationNumber: (dataFromModal as any).registrationNumber,
          taxId: (dataFromModal as any).taxId,
          bioFatherName: (dataFromModal as any).bioFatherName,
          bioMotherName: (dataFromModal as any).bioMotherName,
          additionalDetails: (dataFromModal as any).additionalDetails,
        };
        Object.keys(payloadForUpdate).forEach((keyStr) => {
          const key = keyStr as keyof UpdatePartnerClientData;
          if (payloadForUpdate[key] === undefined) {
            delete payloadForUpdate[key];
          }
        });
        if (Object.keys(payloadForUpdate).length === 0) {
          alert("No changes detected to save.");
          setIsAddEditPartnerModalOpen(false);
          setEditingPartnerData(null);
          return;
        }
        updatePartnerMutation.mutate({
          id: partnerIdToUpdate,
          data: payloadForUpdate,
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
          `Are you sure you want to delete partner ${selectedPartnerId}? This might affect related documents or links.`
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
    isPartnerOptionsMenuOpen,
    partnerOptionsMenuAnchorEl,
    isAddEditPartnerModalOpen,
    editingPartnerData,
    partnersForSlider,
    partnerQuery,
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
