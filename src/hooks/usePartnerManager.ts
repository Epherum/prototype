"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
} from "@/lib/types";
import { getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";

export interface UsePartnerManagerProps {
  sliderOrder: string[];
  visibility: { [key: string]: boolean };
  effectiveSelectedJournalIds: string[];
  selectedGoodsId: string | null;
  selectedJournalIdForGjpFiltering: string | null;
  journalRootFilterStatus: "affected" | "unaffected" | "all" | null;
  isJournalHierarchyLoading: boolean;
  isFlatJournalsQueryForGoodLoading: boolean;

  // +++ GPG Specific Props +++
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
    journalRootFilterStatus,
    isJournalHierarchyLoading,
    isFlatJournalsQueryForGoodLoading,
    // +++ Destructure GPG props +++
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

    // +++ GPG Order Logic (Slider 2: Partners filtered by gpgContextJournalId) +++
    if (isGPGOrderActive && partnerIndex === 1) {
      if (gpgContextJournalId) {
        params.linkedToJournalIds = [gpgContextJournalId]; // Filter by the GPG context journal
        params.includeChildren = false; // Typically, direct links for this context
      } else {
        // If GPG is active but no context journal, Slider 2 (Partners) should be empty
        // The enabled condition will handle this, but params should reflect an impossible fetch
        params.linkedToJournalIds = ["__NO_GPG_CONTEXT_JOURNAL__"]; // Ensures no data fetched
      }
    }
    // --- Existing Logic (adjust if GPG handled it) ---
    else if (partnerIndex === 0) {
      // Default params when Partner is first
    } else if (
      orderString.startsWith(SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.PARTNER)
    ) {
      params.filterStatus = journalRootFilterStatus;
      params.contextJournalIds = [...effectiveSelectedJournalIds];
    } else if (
      orderString.startsWith(
        SLIDER_TYPES.JOURNAL +
          "-" +
          SLIDER_TYPES.GOODS +
          "-" +
          SLIDER_TYPES.PARTNER
      )
    ) {
      if (effectiveSelectedJournalIds.length > 0 && selectedGoodsId) {
        params.linkedToJournalIds = [...effectiveSelectedJournalIds];
        params.linkedToGoodId = selectedGoodsId;
        params.includeChildren = true;
      }
    } else if (
      orderString.startsWith(
        SLIDER_TYPES.GOODS +
          "-" +
          SLIDER_TYPES.JOURNAL +
          "-" +
          SLIDER_TYPES.PARTNER
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
    effectiveSelectedJournalIds,
    selectedGoodsId,
    selectedJournalIdForGjpFiltering,
    journalRootFilterStatus,
    // +++ Add GPG props to dependency array +++
    isGPGOrderActive,
    gpgContextJournalId,
  ]);

  // Expose the query key for external invalidations
  const partnerQueryKey = useMemo(
    () => ["partners", partnerQueryKeyParamsStructure],
    [partnerQueryKeyParamsStructure]
  );

  const partnerQuery = useQuery<Partner[], Error>({
    queryKey: partnerQueryKey,
    queryFn: async (): Promise<Partner[]> => {
      const params = partnerQueryKeyParamsStructure;
      const currentOrderString = sliderOrder.join("-");
      const partnerIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);

      // Check for impossible conditions based on params structure
      if (params.linkedToJournalIds?.includes("__NO_GPG_CONTEXT_JOURNAL__")) {
        console.log(
          "[partnerQuery.queryFn] GPG active, but no context journal. Returning []."
        );
        return [];
      }
      if (
        currentOrderString.startsWith(
          SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.GOODS +
            "-" +
            SLIDER_TYPES.PARTNER
        ) &&
        (!params.linkedToGoodId ||
          !params.linkedToJournalIds ||
          params.linkedToJournalIds.length === 0)
      ) {
        console.log(
          "[partnerQuery.queryFn] J-G-P, but missing good or journal. Returning []."
        );
        return [];
      }
      if (
        currentOrderString.startsWith(
          SLIDER_TYPES.GOODS +
            "-" +
            SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.PARTNER
        ) &&
        (!params.linkedToGoodId ||
          !params.linkedToJournalIds ||
          params.linkedToJournalIds.length === 0)
      ) {
        console.log(
          "[partnerQuery.queryFn] G-J-P, but missing good or journal. Returning []."
        );
        return [];
      }

      // GPG Specific condition for queryFn (redundant if params.linkedToJournalIds already has __NO_GPG_CONTEXT_JOURNAL__)
      // if (isGPGOrderActive && partnerIndex === 1 && !gpgContextJournalId) {
      //   console.log("[partnerQuery.queryFn] GPG order, Slider 2 (Partners), but no context journal. Returning [].");
      //   return [];
      // }

      console.log(
        `[partnerQuery.queryFn in usePartnerManager] order: ${currentOrderString}, params:`,
        JSON.stringify(params)
      );
      const result = await fetchPartners(params);
      return result.data.map((p: any) => ({ ...p, id: String(p.id) }));
    },
    enabled: (() => {
      if (!visibility[SLIDER_TYPES.PARTNER]) return false;

      const partnerIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);
      const orderString = sliderOrder.join("-");

      // +++ GPG Order Logic (Slider 2: Partners) +++
      if (isGPGOrderActive && partnerIndex === 1) {
        return !!gpgContextJournalId; // Enable only if GPG context journal is selected
      }

      // --- Existing Logic ---
      if (partnerIndex === 0) return true;
      if (
        orderString.startsWith(
          SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.PARTNER
        )
      ) {
        return !isJournalHierarchyLoading;
      }
      if (
        orderString.startsWith(
          SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.GOODS +
            "-" +
            SLIDER_TYPES.PARTNER
        )
      ) {
        return (
          effectiveSelectedJournalIds.length > 0 &&
          !!selectedGoodsId &&
          !isJournalHierarchyLoading // Also ensure good query isn't loading if it's a pre-filter
        );
      }
      if (
        orderString.startsWith(
          SLIDER_TYPES.GOODS +
            "-" +
            SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.PARTNER
        )
      ) {
        return (
          !!selectedGoodsId &&
          !!selectedJournalIdForGjpFiltering &&
          !isFlatJournalsQueryForGoodLoading
        );
      }
      return false; // Default to false if no condition met
    })(),
  });

  const partnersForSlider = useMemo(
    () => partnerQuery.data || [],
    [partnerQuery.data]
  );

  const createPartnerMutation = useMutation<
    Partner,
    Error,
    CreatePartnerClientData
  >({
    mutationFn: createPartner,
    onSuccess: (newPartner) => {
      queryClient.invalidateQueries({ queryKey: partnerQueryKey });
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
      queryClient.invalidateQueries({ queryKey: partnerQueryKey });
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
        queryClient.invalidateQueries({ queryKey: partnerQueryKey });
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

  // Effect to reset selected partner if GPG context changes or GPG mode activates/deactivates
  useEffect(() => {
    if (isGPGOrderActive) {
      // If GPG is active, and context journal changes, or if it just became active,
      // partner selection should be reset. This is implicitly handled by page.tsx
      // calling setSelectedPartnerId(null) when GPG context journal changes or is cleared.
      // The data will refetch based on the new context.
      // If data becomes empty, the other useEffect will set selectedPartnerId to null.
    }
  }, [isGPGOrderActive, gpgContextJournalId, partnerQuery.data]); // Watch gpgContextJournalId and data

  // Auto-select first partner or clear selection
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
    selectedPartnerId, // Keep as dependency
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
      // Use partnerQuery.data here for source of truth
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
    partnerQuery, // Expose whole query
    partnerQueryKey, // Expose for invalidation if needed by other hooks
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
