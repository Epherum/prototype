// src/features/partners/usePartnerManager.ts
"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchPartners,
  createPartner,
  updatePartner,
  deletePartner,
} from "@/services/clientPartnerService";
import { getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";
import { useAppStore } from "@/store/appStore"; // <<-- 1. IMPORT THE STORE

// Import types from your existing files
import type {
  Partner,
  CreatePartnerClientData,
  UpdatePartnerClientData,
  FetchPartnersParams,
} from "@/lib/types";

// <<-- 2. THE `UsePartnerManagerProps` INTERFACE HAS BEEN DELETED.

export const usePartnerManager = () => {
  // <<-- 3. THE HOOK NOW TAKES NO PROPS.
  const queryClient = useQueryClient();

  // --- 4. CONSUME ALL STATE AND ACTIONS FROM THE ZUSTAND STORE ---
  // Use multiple, granular selectors to avoid re-render issues.
  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const effectiveRestrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );
  const selections = useAppStore((state) => state.selections);
  const setSelection = useAppStore((state) => state.setSelection);

  // Destructure selections for easier use in memos
  const {
    journal: journalSelections,
    goods: selectedGoodsId,
    partner: selectedPartnerId,
    gpgContextJournalId,
  } = selections;

  // Derive the effectiveJournalIds here, inside the hook that needs it.
  const effectiveSelectedJournalIds = useMemo(() => {
    const ids = new Set<string>();
    if (journalSelections.topLevelId) ids.add(journalSelections.topLevelId);
    journalSelections.level2Ids.forEach((id) => ids.add(id));
    journalSelections.level3Ids.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [journalSelections]);

  // Local UI state for the hook's own components (modals, menus) remains here.
  const [isPartnerOptionsMenuOpen, setIsPartnerOptionsMenuOpen] =
    useState(false);
  const [partnerOptionsMenuAnchorEl, setPartnerOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditPartnerModalOpen, setIsAddEditPartnerModalOpen] =
    useState(false);
  const [editingPartnerData, setEditingPartnerData] = useState<Partner | null>(
    null
  );

  // --- 5. RE-WIRE STATE SETTERS TO USE STORE ACTIONS ---
  const setSelectedPartnerId = useCallback(
    (id: string | null) => {
      setSelection("partner", id);
    },
    [setSelection]
  );

  // --- Logic depending on store state (e.g., query keys, enabled flags) ---

  const isGPGOrderActive = useMemo(() => {
    const visibleSliders = sliderOrder.filter((id) => visibility[id]);
    return (
      visibleSliders.length >= 2 &&
      visibleSliders[0] === SLIDER_TYPES.GOODS &&
      visibleSliders[1] === SLIDER_TYPES.PARTNER
    );
  }, [sliderOrder, visibility]);

  const partnerQueryKeyParamsStructure = useMemo((): FetchPartnersParams => {
    const orderString = sliderOrder.join("-");
    let params: FetchPartnersParams = { limit: 1000, offset: 0 };
    const partnerIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);

    if (isGPGOrderActive && partnerIndex === 1) {
      if (gpgContextJournalId) {
        params.linkedToJournalIds = [gpgContextJournalId];
        params.includeChildren = false;
      } else {
        // Provide a non-existent ID to ensure no results are returned if context is required but missing.
        params.linkedToJournalIds = ["__NO_GPG_CONTEXT_JOURNAL__"];
      }
    } else if (
      orderString.startsWith(`${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.PARTNER}`)
    ) {
      params.filterStatuses = journalSelections.rootFilter;
      params.restrictedJournalId = effectiveRestrictedJournalId;
      if (journalSelections.rootFilter.includes("affected")) {
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
      if (selectedGoodsId && journalSelections.flatId) {
        params.linkedToJournalIds = [journalSelections.flatId];
        params.linkedToGoodId = selectedGoodsId;
        params.includeChildren = false;
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
    isGPGOrderActive,
    gpgContextJournalId,
  ]);

  const partnerQueryKey = useMemo(
    () => ["partners", partnerQueryKeyParamsStructure],
    [partnerQueryKeyParamsStructure]
  );

  // --- 6. SIMPLIFIED ENABLED LOGIC ---
  // The hook no longer cares about the loading state of other hooks.
  // It only cares if the STATE it needs to build its query is available.
  const isPartnerQueryEnabled = useMemo(() => {
    if (!visibility[SLIDER_TYPES.PARTNER]) return false;

    const params = partnerQueryKeyParamsStructure;

    // GPG Order: Enabled only if a context journal is selected.
    if (isGPGOrderActive) {
      return (
        !!params.linkedToJournalIds &&
        params.linkedToJournalIds[0] !== "__NO_GPG_CONTEXT_JOURNAL__"
      );
    }

    // J-P Order: Enabled if any filters are active. If 'affected' is the only one, requires a journal selection.
    if (sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 0) {
      if (params.filterStatuses?.length === 0) return false;
      if (
        params.filterStatuses?.includes("affected") &&
        params.contextJournalIds?.length === 0
      ) {
        // 'affected' is on, but no journals selected. If other context-free filters are also on, allow it.
        return params.filterStatuses.some((f) => f !== "affected");
      }
      return true;
    }

    // G-J-P Order: Enabled only if both good and flat journal are selected
    if (
      sliderOrder.indexOf(SLIDER_TYPES.GOODS) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1
    ) {
      return (
        !!params.linkedToGoodId &&
        !!params.linkedToJournalIds &&
        params.linkedToJournalIds.length > 0
      );
    }

    // P is first slider
    if (sliderOrder.indexOf(SLIDER_TYPES.PARTNER) === 0) return true;

    return false; // Disable by default if no case matches
  }, [
    visibility,
    sliderOrder,
    partnerQueryKeyParamsStructure,
    isGPGOrderActive,
  ]);

  const partnerQuery = useQuery<Partner[], Error>({
    queryKey: partnerQueryKey,
    queryFn: async (): Promise<Partner[]> => {
      // The query function itself doesn't need to change much.
      const result = await fetchPartners(partnerQueryKeyParamsStructure);
      return result.data.map((p: any) => ({ ...p, id: String(p.id) }));
    },
    enabled: isPartnerQueryEnabled,
  });

  // This effect ensures that if the query becomes disabled, its stale data is cleared.
  useEffect(() => {
    if (!isPartnerQueryEnabled && partnerQuery.data?.length) {
      queryClient.setQueryData(partnerQueryKey, []);
    }
  }, [isPartnerQueryEnabled, partnerQuery.data, partnerQueryKey, queryClient]);

  // Mutations (unchanged logic, but they call the new setSelectedPartnerId)
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
      setSelectedPartnerId(String(newPartner.id)); // <<-- Uses new setter
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
          setSelectedPartnerId(null); // <<-- Uses new setter
        }
      },
      onError: (error: Error, deletedPartnerId) => {
        console.error(`Failed to delete partner ${deletedPartnerId}:`, error);
        alert(`Error deleting partner: ${error.message}`);
      },
    }
  );

  // Auto-selection logic (remains crucial)
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
    }
  }, [
    partnerQuery.data,
    partnerQuery.isSuccess,
    selectedPartnerId,
    setSelectedPartnerId,
  ]);

  // Callback handlers for opening/closing modals (logic is unchanged)
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
          `Are you sure you want to delete partner ${selectedPartnerId}? This might affect related documents or links.`
        )
      ) {
        deletePartnerMutation.mutate(selectedPartnerId);
      }
    }
    handleClosePartnerOptionsMenu();
  }, [selectedPartnerId, deletePartnerMutation, handleClosePartnerOptionsMenu]);

  // --- 7. RETURN VALUE ---
  // The return signature is the same, but the values are now derived from the store or React Query.
  return {
    selectedPartnerId,
    setSelectedPartnerId, // Return the memoized setter
    isPartnerOptionsMenuOpen,
    partnerOptionsMenuAnchorEl,
    isAddEditPartnerModalOpen,
    editingPartnerData,
    partnersForSlider: partnerQuery.data || [],
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
