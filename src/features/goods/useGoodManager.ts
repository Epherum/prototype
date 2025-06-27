// src/features/goods/useGoodManager.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { goodKeys, jpgLinkKeys } from "@/lib/queryKeys";

import {
  fetchGoods,
  fetchGoodsForDocumentContext,
  createGood,
  updateGood,
  deleteGood,
} from "@/services/clientGoodService";
import { getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";
import { useAppStore } from "@/store/appStore";

import type {
  Good,
  CreateGoodClientData,
  UpdateGoodClientData,
  FetchGoodsParams,
} from "@/lib/types";
import { useJournalManager } from "../journals/useJournalManager";

export const useGoodManager = () => {
  const queryClient = useQueryClient();

  // --- Global State ---
  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const { partner: selectedPartnerId, goods: selectedGoodsId } = useAppStore(
    (state) => state.selections
  );
  const { isCreating, lockedPartnerId, lockedJournalId } = useAppStore(
    (state) => state.ui.documentCreationState
  );
  const setSelection = useAppStore((state) => state.setSelection);
  const { effectiveSelectedJournalIds } = useJournalManager();

  // --- Local UI State ---
  const [isGoodsOptionsMenuOpen, setIsGoodsOptionsMenuOpen] = useState(false);
  const [goodsOptionsMenuAnchorEl, setGoodsOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditGoodModalOpen, setIsAddEditGoodModalOpen] = useState(false);
  const [editingGoodData, setEditingGoodData] = useState<Good | null>(null);

  const isDocumentContextActive = isCreating;

  const mainGoodsQueryParams = useMemo((): FetchGoodsParams => {
    let params: FetchGoodsParams = { limit: 1000, offset: 0 };
    const orderString = sliderOrder.join("-");

    if (
      (orderString.includes(
        `${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.PARTNER}`
      ) ||
        orderString.includes(
          `${SLIDER_TYPES.PARTNER}-${SLIDER_TYPES.JOURNAL}`
        )) &&
      effectiveSelectedJournalIds.length > 0 &&
      selectedPartnerId
    ) {
      params.forJournalIds = effectiveSelectedJournalIds;
      params.forPartnerId = selectedPartnerId;
      params.includeJournalChildren = true;
    }

    return params;
  }, [sliderOrder, effectiveSelectedJournalIds, selectedPartnerId]);

  const mainGoodsQuery = useQuery({
    queryKey: goodKeys.list(mainGoodsQueryParams),
    queryFn: () => fetchGoods(mainGoodsQueryParams),
    enabled: !isDocumentContextActive && visibility[SLIDER_TYPES.GOODS],
  });

  const documentContextGoodsQuery = useQuery({
    queryKey: jpgLinkKeys.listForDocumentContext(
      lockedPartnerId,
      lockedJournalId
    ),
    queryFn: () =>
      fetchGoodsForDocumentContext(lockedPartnerId!, lockedJournalId!),
    // --- THIS IS THE FIX ---
    // The enabled flag is now more robust. It checks for a non-falsy value
    // AND ensures the value is not the literal string "undefined".
    enabled:
      isDocumentContextActive &&
      !!lockedPartnerId &&
      lockedPartnerId !== "undefined" &&
      !!lockedJournalId,
  });

  const goodsForSlider = useMemo(() => {
    if (isDocumentContextActive) {
      return documentContextGoodsQuery.data?.data || [];
    }
    return mainGoodsQuery.data?.data || [];
  }, [
    isDocumentContextActive,
    documentContextGoodsQuery.data,
    mainGoodsQuery.data,
  ]);

  const goodsQueryState = {
    isLoading: isDocumentContextActive
      ? documentContextGoodsQuery.isLoading
      : mainGoodsQuery.isLoading,
    isError: isDocumentContextActive
      ? documentContextGoodsQuery.isError
      : mainGoodsQuery.isError,
    error: isDocumentContextActive
      ? documentContextGoodsQuery.error
      : mainGoodsQuery.error,
    isFetching: isDocumentContextActive
      ? documentContextGoodsQuery.isFetching
      : mainGoodsQuery.isFetching,
  };

  const setSelectedGoodsId = useCallback(
    (id: string | null) => {
      setSelection("goods", id);
    },
    [setSelection]
  );

  useEffect(() => {
    const isSuccess = isDocumentContextActive
      ? documentContextGoodsQuery.isSuccess
      : mainGoodsQuery.isSuccess;

    if (isSuccess && goodsForSlider) {
      const currentSelectionInList =
        selectedGoodsId && goodsForSlider.some((g) => g.id === selectedGoodsId);

      if (goodsForSlider.length > 0 && !currentSelectionInList) {
        setSelectedGoodsId(getFirstId(goodsForSlider));
      } else if (goodsForSlider.length === 0 && selectedGoodsId !== null) {
        setSelectedGoodsId(null);
      }
    }
  }, [
    goodsForSlider,
    isDocumentContextActive,
    mainGoodsQuery.isSuccess,
    documentContextGoodsQuery.isSuccess,
    selectedGoodsId,
    setSelectedGoodsId,
  ]);

  // --- Mutations and Handlers (No changes needed here) ---

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
    if (selectedGoodsId && goodsForSlider) {
      const goodToEdit = goodsForSlider.find((g) => g.id === selectedGoodsId);
      if (goodToEdit) {
        setEditingGoodData(goodToEdit);
        setIsAddEditGoodModalOpen(true);
      } else {
        alert("Selected good/service data not found for editing.");
      }
    }
    handleCloseGoodsOptionsMenu();
  }, [selectedGoodsId, goodsForSlider, handleCloseGoodsOptionsMenu]);
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
    goodsForSlider,
    goodsQueryState,
    isGoodsOptionsMenuOpen,
    goodsOptionsMenuAnchorEl,
    isAddEditGoodModalOpen,
    editingGoodData,
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
