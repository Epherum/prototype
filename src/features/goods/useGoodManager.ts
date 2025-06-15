// src/features/goods/useGoodManager.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
// No need to import UseQueryResult if we let TypeScript infer it from the hook usage.
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { goodKeys } from "@/lib/queryKeys";

import {
  fetchGoods,
  createGood,
  updateGood,
  deleteGood,
} from "@/services/clientGoodService";
import { getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";
import { useAppStore } from "@/store/appStore";

// Import types
import type {
  Good,
  CreateGoodClientData,
  UpdateGoodClientData,
  FetchGoodsParams,
} from "@/lib/types";

export const useGoodManager = () => {
  const queryClient = useQueryClient();

  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const effectiveRestrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );
  const selections = useAppStore((state) => state.selections);
  const setSelection = useAppStore((state) => state.setSelection);

  const isCreatingDocument = useAppStore(
    (state) => state.ui.isCreatingDocument
  );

  const {
    journal: journalSelections,
    partner: selectedPartnerId,
    goods: selectedGoodsId,
    gpgContextJournalId,
  } = selections;

  const effectiveSelectedJournalIds = useMemo(() => {
    const ids = new Set<string>();
    if (journalSelections.topLevelId) ids.add(journalSelections.topLevelId);
    journalSelections.level2Ids.forEach((id) => ids.add(id));
    journalSelections.level3Ids.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [journalSelections]);

  const [isGoodsOptionsMenuOpen, setIsGoodsOptionsMenuOpen] = useState(false);
  const [goodsOptionsMenuAnchorEl, setGoodsOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditGoodModalOpen, setIsAddEditGoodModalOpen] = useState(false);
  const [editingGoodData, setEditingGoodData] = useState<Good | null>(null);

  const setSelectedGoodsId = useCallback(
    (id: string | null) => {
      setSelection("goods", id);
    },
    [setSelection]
  );

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
      // Default case
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
        params.forPartnerId = "__IMPOSSIBLE_JPGL_CONTEXT__";
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
        params.forPartnerId = "__IMPOSSIBLE_PJGL_CONTEXT__";
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

  const isBaseGoodsQueryEnabled = useMemo(() => {
    if (!visibility[SLIDER_TYPES.GOODS]) return false;
    const params = mainGoodsQueryKeyParams;
    if (goodsSliderIndex === 0) return true;
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
    if (
      params.forPartnerId &&
      !params.forPartnerId.startsWith("__IMPOSSIBLE")
    ) {
      return true;
    }
    return false;
  }, [visibility, goodsSliderIndex, sliderOrder, mainGoodsQueryKeyParams]);

  // <<< --- START OF FIX --- >>>
  const mainGoodsQuery = useQuery<Good[], Error>({
    queryKey: goodKeys.list(mainGoodsQueryKeyParams),
    // FIX 1: Provide an explicit return type for the query function.
    // This resolves the "not assignable" error by creating a clear contract.
    queryFn: async (): Promise<Good[]> => {
      if (mainGoodsQueryKeyParams.forPartnerId?.startsWith("__IMPOSSIBLE")) {
        return [];
      }
      const result = await fetchGoods(mainGoodsQueryKeyParams);
      // Ensure the fetched data conforms to the Good type
      return result.data.map(
        (g: any): Good => ({
          ...g,
          id: String(g.id),
          taxCodeId: g.taxCodeId ?? null,
          unitCodeId: g.unitCodeId ?? null,
        })
      );
    },
    // FIX: The query should remain enabled during document creation
    // so the user can see and select goods. The context from the
    // locked-in partner selection (Step 1) will ensure the correct
    // goods are fetched.
    enabled: isBaseGoodsQueryEnabled,
    placeholderData: (previousData) => previousData,
  });
  // <<< --- END OF FIX --- >>>

  const goodsData = useMemo(
    () => mainGoodsQuery.data || [],
    [mainGoodsQuery.data]
  );

  useEffect(() => {
    if (mainGoodsQuery.isSuccess && goodsData) {
      const currentSelectionInList =
        selectedGoodsId && goodsData.some((g) => g.id === selectedGoodsId);
      if (goodsData.length > 0 && !currentSelectionInList) {
        setSelectedGoodsId(getFirstId(goodsData));
      } else if (goodsData.length === 0 && selectedGoodsId !== null) {
        setSelectedGoodsId(null);
      }
    }
  }, [
    goodsData,
    mainGoodsQuery.isSuccess,
    selectedGoodsId,
    setSelectedGoodsId,
  ]);

  const createGoodMutation = useMutation<Good, Error, CreateGoodClientData>({
    mutationFn: createGood,
    onSuccess: (newGood) => {
      queryClient.invalidateQueries({ queryKey: goodKeys.all });
      setIsAddEditGoodModalOpen(false);
      setEditingGoodData(null);
      alert(`Good/Service '${newGood.label}' created successfully!`);
      setSelectedGoodsId(String(newGood.id));
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
      queryClient.invalidateQueries({ queryKey: goodKeys.all });
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
      queryClient.invalidateQueries({ queryKey: goodKeys.all });
      alert(
        response.message ||
          `Good/Service ${deletedGoodId} deleted successfully!`
      );
      if (selectedGoodsId === deletedGoodId) {
        setSelectedGoodsId(null);
      }
    },
    onError: (error: Error, deletedGoodId) => {
      console.error(`Failed to delete good/service ${deletedGoodId}:`, error);
      alert(`Error deleting good/service: ${error.message}`);
    },
  });

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
    if (selectedGoodsId && goodsData) {
      const goodToEdit = goodsData.find((g) => g.id === selectedGoodsId);
      if (goodToEdit) {
        setEditingGoodData(goodToEdit);
        setIsAddEditGoodModalOpen(true);
      } else {
        alert("Selected good/service data not found for editing.");
      }
    }
    handleCloseGoodsOptionsMenu();
  }, [selectedGoodsId, goodsData, handleCloseGoodsOptionsMenu]);

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

  return {
    selectedGoodsId,
    setSelectedGoodsId,
    isGoodsOptionsMenuOpen,
    goodsOptionsMenuAnchorEl,
    isAddEditGoodModalOpen,
    editingGoodData,
    goodsForSlider: goodsData,
    goodsQueryState: {
      isLoading: mainGoodsQuery.isLoading,
      isError: mainGoodsQuery.isError,
      error: mainGoodsQuery.error,
      data: goodsData,
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
