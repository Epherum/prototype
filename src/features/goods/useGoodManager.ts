// src/features/goods/useGoodManager.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchGoods,
  createGood,
  updateGood,
  deleteGood,
} from "@/services/clientGoodService";
import { getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";
import { useAppStore } from "@/store/appStore"; // <<-- 1. IMPORT THE STORE

// Import types from your existing files
import type {
  Good,
  CreateGoodClientData,
  UpdateGoodClientData,
  FetchGoodsParams,
} from "@/lib/types";

// <<-- 2. THE `UseGoodManagerProps` INTERFACE HAS BEEN DELETED.

export const useGoodManager = () => {
  // <<-- 3. THE HOOK NOW TAKES NO PROPS.
  const queryClient = useQueryClient();

  // --- 4. CONSUME ALL STATE AND ACTIONS FROM THE ZUSTAND STORE ---
  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const effectiveRestrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );
  const selections = useAppStore((state) => state.selections);
  const setSelection = useAppStore((state) => state.setSelection);

  // Destructure selections for easier use
  const {
    journal: journalSelections,
    partner: selectedPartnerId,
    goods: selectedGoodsId,
    gpgContextJournalId,
  } = selections;

  // Derive the effectiveJournalIds here, inside the hook.
  const effectiveSelectedJournalIds = useMemo(() => {
    const ids = new Set<string>();
    if (journalSelections.topLevelId) ids.add(journalSelections.topLevelId);
    journalSelections.level2Ids.forEach((id) => ids.add(id));
    journalSelections.level3Ids.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [journalSelections]);

  // Local UI state for the hook's own components (modals, menus) remains here.
  const [isGoodsOptionsMenuOpen, setIsGoodsOptionsMenuOpen] = useState(false);
  const [goodsOptionsMenuAnchorEl, setGoodsOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditGoodModalOpen, setIsAddEditGoodModalOpen] = useState(false);
  const [editingGoodData, setEditingGoodData] = useState<Good | null>(null);

  // --- 5. RE-WIRE STATE SETTERS TO USE STORE ACTIONS ---
  const setSelectedGoodsId = useCallback(
    (id: string | null) => {
      setSelection("goods", id);
    },
    [setSelection]
  );

  // --- Logic depending on store state ---

  const goodsSliderIndex = useMemo(
    () => sliderOrder.indexOf(SLIDER_TYPES.GOODS),
    [sliderOrder]
  );

  const isGPContextActive = useMemo(() => {
    const visibleSliders = sliderOrder.filter((id) => visibility[id]);
    return (
      visibleSliders.length >= 2 &&
      visibleSliders[0] === SLIDER_TYPES.GOODS &&
      visibleSliders[1] === SLIDER_TYPES.PARTNER
    );
  }, [sliderOrder, visibility]);

  const mainGoodsQueryKeyParams = useMemo((): FetchGoodsParams => {
    let params: FetchGoodsParams = { limit: 1000, offset: 0 };
    const currentOrderString = sliderOrder.join("-");

    if (isGPContextActive && goodsSliderIndex === 0) {
      if (gpgContextJournalId) {
        params.linkedToJournalIds = [gpgContextJournalId];
      }
    } else if (goodsSliderIndex === 0) {
      // Default case when Goods is first, no special filters
    } else if (
      currentOrderString.startsWith(
        `${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.GOODS}`
      )
    ) {
      params.filterStatuses = journalSelections.rootFilter;
      params.restrictedJournalId = effectiveRestrictedJournalId;
      if (journalSelections.rootFilter.includes("affected")) {
        params.contextJournalIds = effectiveSelectedJournalIds;
      }
    } else if (
      currentOrderString.startsWith(
        `${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.PARTNER}-${SLIDER_TYPES.GOODS}`
      )
    ) {
      if (selectedPartnerId && effectiveSelectedJournalIds.length > 0) {
        params.forPartnerId = selectedPartnerId;
        params.forJournalIds = [...effectiveSelectedJournalIds];
      } else {
        params.forPartnerId = "__IMPOSSIBLE_JPGL_CONTEXT__"; // Prevent fetch
      }
    } else if (
      currentOrderString.startsWith(
        `${SLIDER_TYPES.PARTNER}-${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.GOODS}`
      )
    ) {
      if (selectedPartnerId && journalSelections.flatId) {
        params.forPartnerId = selectedPartnerId;
        params.forJournalIds = [journalSelections.flatId];
      } else {
        params.forPartnerId = "__IMPOSSIBLE_PJGL_CONTEXT__"; // Prevent fetch
      }
    }
    return params;
  }, [
    sliderOrder,
    goodsSliderIndex,
    isGPContextActive,
    gpgContextJournalId,
    journalSelections.rootFilter,
    journalSelections.flatId,
    effectiveRestrictedJournalId,
    effectiveSelectedJournalIds,
    selectedPartnerId,
  ]);

  // --- 6. SIMPLIFIED ENABLED LOGIC ---
  const isGoodsQueryEnabled = useMemo(() => {
    if (!visibility[SLIDER_TYPES.GOODS]) return false;

    const params = mainGoodsQueryKeyParams;

    // Always enabled if Goods is the first slider
    if (goodsSliderIndex === 0) return true;

    // J-G Flow
    if (sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 0) {
      if (params.filterStatuses?.length === 0) return false;
      if (
        params.filterStatuses?.includes("affected") &&
        params.contextJournalIds?.length === 0
      ) {
        return params.filterStatuses.some((f) => f !== "affected");
      }
      return true;
    }

    // J-P-G or P-J-G flows are enabled only if the context isn't impossible
    if (
      params.forPartnerId &&
      !params.forPartnerId.startsWith("__IMPOSSIBLE")
    ) {
      return true;
    }

    return false; // Disable by default
  }, [visibility, goodsSliderIndex, sliderOrder, mainGoodsQueryKeyParams]);

  const mainGoodsQuery = useQuery<Good[], Error>({
    queryKey: ["mainGoods", mainGoodsQueryKeyParams],
    queryFn: async () => {
      // The query function itself can check for the impossible context as a safeguard
      if (mainGoodsQueryKeyParams.forPartnerId?.startsWith("__IMPOSSIBLE")) {
        return [];
      }
      const result = await fetchGoods(mainGoodsQueryKeyParams);
      return result.data.map((g: any) => ({
        ...g,
        id: String(g.id),
        taxCodeId: g.taxCodeId ?? null,
        unitCodeId: g.unitCodeId ?? null,
      }));
    },
    enabled: isGoodsQueryEnabled,
  });

  // This effect ensures that if the query becomes disabled, its stale data is cleared.
  useEffect(() => {
    if (!isGoodsQueryEnabled && mainGoodsQuery.data?.length) {
      queryClient.setQueryData(["mainGoods", mainGoodsQueryKeyParams], []);
    }
  }, [
    isGoodsQueryEnabled,
    mainGoodsQuery.data,
    mainGoodsQueryKeyParams,
    queryClient,
  ]);

  // Mutations (unchanged logic, but they call the new setSelectedGoodsId)
  const createGoodMutation = useMutation<Good, Error, CreateGoodClientData>({
    mutationFn: createGood,
    onSuccess: (newGood) => {
      queryClient.invalidateQueries({ queryKey: ["mainGoods"] });
      setIsAddEditGoodModalOpen(false);
      setEditingGoodData(null);
      alert(`Good/Service '${newGood.label}' created successfully!`);
      setSelectedGoodsId(String(newGood.id)); // <<-- Uses new setter
    },
    onError: (error: Error) => {
      console.error("Failed to create good/service:", error);
      alert(`Error creating good/service: ${error.message}`);
    },
  });

  const updateGoodMutation = useMutation<
    Good,
    Error,
    { id: string; data: UpdateGoodClientData }
  >({
    mutationFn: (variables) => updateGood(variables.id, variables.data),
    onSuccess: (updatedGood) => {
      queryClient.invalidateQueries({ queryKey: ["mainGoods"] });
      setIsAddEditGoodModalOpen(false);
      setEditingGoodData(null);
      alert(`Good/Service '${updatedGood.label}' updated successfully!`);
    },
    onError: (error: Error) => {
      console.error("Failed to update good/service:", error);
      alert(`Error updating good/service: ${error.message}`);
    },
  });

  const deleteGoodMutation = useMutation<{ message: string }, Error, string>({
    mutationFn: deleteGood,
    onSuccess: (response, deletedGoodId) => {
      queryClient.invalidateQueries({ queryKey: ["mainGoods"] });
      alert(
        response.message ||
          `Good/Service ${deletedGoodId} deleted successfully!`
      );
      if (selectedGoodsId === deletedGoodId) {
        setSelectedGoodsId(null); // <<-- Uses new setter
      }
    },
    onError: (error: Error, deletedGoodId) => {
      console.error(`Failed to delete good/service ${deletedGoodId}:`, error);
      alert(`Error deleting good/service: ${error.message}`);
    },
  });

  // Auto-selection logic
  useEffect(() => {
    const currentData = mainGoodsQuery.data;
    if (mainGoodsQuery.isSuccess && currentData) {
      const currentSelectionInList =
        selectedGoodsId && currentData.some((g) => g.id === selectedGoodsId);
      if (currentData.length > 0 && !currentSelectionInList) {
        setSelectedGoodsId(getFirstId(currentData));
      } else if (currentData.length === 0 && selectedGoodsId !== null) {
        setSelectedGoodsId(null);
      }
    }
  }, [
    mainGoodsQuery.data,
    mainGoodsQuery.isSuccess,
    selectedGoodsId,
    setSelectedGoodsId,
  ]);

  // Callback handlers for opening/closing modals (logic is unchanged)
  const handleOpenGoodsOptionsMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setGoodsOptionsMenuAnchorEl(event.currentTarget);
      setIsGoodsOptionsMenuOpen(true);
    },
    []
  );

  const handleCloseGoodsOptionsMenu = useCallback(() => {
    setIsGoodsOptionsMenuOpen(false);
    setGoodsOptionsMenuAnchorEl(null);
  }, []);

  const handleOpenAddGoodModal = useCallback(() => {
    setEditingGoodData(null);
    setIsAddEditGoodModalOpen(true);
    handleCloseGoodsOptionsMenu();
  }, [handleCloseGoodsOptionsMenu]);

  const handleOpenEditGoodModal = useCallback(() => {
    const sourceData = mainGoodsQuery.data;
    if (selectedGoodsId && sourceData) {
      const goodToEdit = sourceData.find((g) => g.id === selectedGoodsId);
      if (goodToEdit) {
        setEditingGoodData(goodToEdit);
        setIsAddEditGoodModalOpen(true);
      } else {
        alert("Selected good/service data not found for editing.");
      }
    }
    handleCloseGoodsOptionsMenu();
  }, [selectedGoodsId, mainGoodsQuery.data, handleCloseGoodsOptionsMenu]);

  const handleCloseAddEditGoodModal = useCallback(() => {
    setIsAddEditGoodModalOpen(false);
    setEditingGoodData(null);
  }, []);

  const handleAddOrUpdateGoodSubmit = useCallback(
    (
      dataFromModal: CreateGoodClientData | UpdateGoodClientData,
      goodIdToUpdate?: string
    ) => {
      if (goodIdToUpdate && editingGoodData) {
        updateGoodMutation.mutate({
          id: goodIdToUpdate,
          data: dataFromModal as UpdateGoodClientData,
        });
      } else {
        createGoodMutation.mutate(dataFromModal as CreateGoodClientData);
      }
    },
    [editingGoodData, createGoodMutation, updateGoodMutation]
  );

  const handleDeleteCurrentGood = useCallback(() => {
    if (selectedGoodsId) {
      if (
        window.confirm(
          `Are you sure you want to delete good/service ${selectedGoodsId}?`
        )
      ) {
        deleteGoodMutation.mutate(selectedGoodsId);
      }
    }
    handleCloseGoodsOptionsMenu();
  }, [selectedGoodsId, deleteGoodMutation, handleCloseGoodsOptionsMenu]);

  // --- 7. RETURN VALUE ---
  return {
    selectedGoodsId,
    setSelectedGoodsId,
    isGoodsOptionsMenuOpen,
    goodsOptionsMenuAnchorEl,
    isAddEditGoodModalOpen,
    editingGoodData,
    goodsForSlider: mainGoodsQuery.data || [],
    goodsQueryState: {
      isLoading: mainGoodsQuery.isLoading,
      isError: mainGoodsQuery.isError,
      error: mainGoodsQuery.error,
      data: mainGoodsQuery.data,
      refetch: mainGoodsQuery.refetch,
      isFetching: mainGoodsQuery.isFetching,
    },
    createGoodMutation,
    updateGoodMutation,
    deleteGoodMutation,
    handleOpenGoodsOptionsMenu,
    handleCloseGoodsOptionsMenu,
    handleOpenAddGoodModal,
    handleOpenEditGoodModal,
    handleCloseAddEditGoodModal,
    handleAddOrUpdateGoodSubmit,
    handleDeleteCurrentGood,
  };
};
