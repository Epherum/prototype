// src/features/goods/useGoodManager.ts
"use client";

import { useEffect, useState, useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { goodKeys } from "@/lib/queryKeys";
import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import {
  fetchGoods,
  createGood,
  updateGood,
  deleteGood,
  // ✅ IMPORT: Import the new unified service function
  getGoodsForPartners,
} from "@/services/clientGoodService";
import type { Good, PaginatedGoodsResponse } from "@/lib/types";

import { useChainedQuery } from "@/hooks/useChainedQuery";

export const useGoodManager = () => {
  const queryClient = useQueryClient();

  const selections = useAppStore((state) => state.selections);
  const { sliderOrder, visibility, documentCreationState } = useAppStore(
    (state) => state.ui
  );
  const auth = useAppStore((state) => state.auth);
  const setSelection = useAppStore((state) => state.setSelection);
  const selectedGoodsId = useAppStore((state) => state.selections.goods);
  const setSelectedGoodsId = (id: string | null) => setSelection("goods", id);

  // State management for modals and menus (remains unchanged)
  const [isAddEditGoodModalOpen, setAddEditGoodModalOpen] = useState(false);
  const [editingGoodData, setEditingGoodData] = useState<Good | null>(null);
  const [isGoodsOptionsMenuOpen, setGoodsOptionsMenuOpen] = useState(false);
  const [goodsOptionsMenuAnchorEl, setGoodsOptionsMenuAnchorEl] =
    useState<null | HTMLElement>(null);

  // --- DATA FETCHING LOGIC ---

  // ✅ The type is now inferred correctly from useChainedQuery.
  const queryOptions = useChainedQuery(SLIDER_TYPES.GOODS);

  // ✅ No more generics needed here, and no more type errors.
  const activeQuery = useQuery({
    ...queryOptions,
    staleTime: 5 * 60 * 1000,
  });

  // --- Mutations and Handlers (remain unchanged) ---

  const createGoodMutation = useMutation({
    mutationFn: (data: Omit<Good, "id" | "createdAt" | "updatedAt">) =>
      createGood(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goodKeys.lists() });
      handleCloseAddEditGoodModal();
    },
  });

  const updateGoodMutation = useMutation({
    mutationFn: (data: Good) => updateGood(String(data.id), data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: goodKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: goodKeys.detail(String(variables.id)),
      });
      handleCloseAddEditGoodModal();
    },
  });

  const deleteGoodMutation = useMutation({
    mutationFn: (goodId: string) => deleteGood(goodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goodKeys.lists() });
      setSelectedGoodsId(null);
    },
  });

  const goodsForSlider = useMemo(() => {
    if (!activeQuery.data?.data) return [];
    return activeQuery.data.data.map((good) => ({
      id: String(good.id),
      label: good.label,
      ...good,
    }));
  }, [activeQuery.data]);

  useEffect(() => {
    const isReadyForSelection =
      !activeQuery.isLoading && !activeQuery.isFetching;
    if (!isReadyForSelection || documentCreationState.isCreating) return;
    const selectedExists = goodsForSlider.some((g) => g.id === selectedGoodsId);
    if (!selectedGoodsId && goodsForSlider.length > 0) {
      setSelectedGoodsId(goodsForSlider[0].id);
    } else if (
      selectedGoodsId &&
      !selectedExists &&
      goodsForSlider.length > 0
    ) {
      setSelectedGoodsId(goodsForSlider[0].id);
    } else if (goodsForSlider.length === 0 && selectedGoodsId) {
      setSelectedGoodsId(null);
    }
  }, [
    goodsForSlider,
    selectedGoodsId,
    setSelectedGoodsId,
    activeQuery.isLoading,
    activeQuery.isFetching,
    documentCreationState.isCreating,
  ]);

  const handleOpenAddGoodModal = () => {
    setEditingGoodData(null);
    setAddEditGoodModalOpen(true);
    setGoodsOptionsMenuOpen(false);
  };
  const handleOpenEditGoodModal = () => {
    if (!selectedGoodsId) return;
    const goodToEdit = activeQuery.data?.data?.find(
      (g) => String(g.id) === selectedGoodsId
    );
    if (goodToEdit) {
      //@ts-ignore
      setEditingGoodData(goodToEdit);
      setAddEditGoodModalOpen(true);
      setGoodsOptionsMenuOpen(false);
    }
  };
  const handleDeleteCurrentGood = () => {
    if (
      selectedGoodsId &&
      window.confirm("Are you sure you want to delete this good?")
    ) {
      deleteGoodMutation.mutate(selectedGoodsId);
      setGoodsOptionsMenuOpen(false);
    }
  };
  const handleCloseAddEditGoodModal = () => setAddEditGoodModalOpen(false);
  const handleAddOrUpdateGoodSubmit = (
    data: Omit<Good, "id" | "createdAt" | "updatedAt">
  ) => {
    if (editingGoodData) {
      updateGoodMutation.mutate({ ...data, id: editingGoodData.id });
    } else {
      createGoodMutation.mutate(data);
    }
  };
  const handleOpenGoodsOptionsMenu = (event: React.MouseEvent<HTMLElement>) => {
    setGoodsOptionsMenuAnchorEl(event.currentTarget);
    setGoodsOptionsMenuOpen(true);
  };
  const handleCloseGoodsOptionsMenu = () => setGoodsOptionsMenuOpen(false);

  return {
    goodsQueryState: {
      isLoading: activeQuery.isLoading,
      isFetching: activeQuery.isFetching,
      isError: activeQuery.isError,
      error: activeQuery.error,
    },
    goodsForSlider,
    selectedGoodsId,
    isAddEditGoodModalOpen,
    editingGoodData,
    isGoodsOptionsMenuOpen,
    goodsOptionsMenuAnchorEl,
    createGoodMutation,
    updateGoodMutation,
    deleteGoodMutation,
    setSelectedGoodsId,
    handleOpenAddGoodModal,
    handleOpenEditGoodModal,
    handleDeleteCurrentGood,
    handleCloseAddEditGoodModal,
    handleAddOrUpdateGoodSubmit,
    handleOpenGoodsOptionsMenu,
    handleCloseGoodsOptionsMenu,
  };
};
