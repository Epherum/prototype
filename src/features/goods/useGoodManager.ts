// src/features/goods/useGoodManager.ts

"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { goodKeys } from "@/lib/queryKeys";
import { SLIDER_TYPES } from "@/lib/constants";
import { useToast } from "@/contexts/ToastContext";
import {
  // ✅ REMOVED: Old, individual service function imports
  // fetchGoods,
  createGood,
  updateGood,
  deleteGood,
  // getGoodsForPartners,
} from "@/services/clientGoodService";

// ✅ ADDED: New, robust type imports
import { GoodClient } from "@/lib/types/models.client";
import {
  CreateGoodPayload,
  UpdateGoodPayload,
} from "@/lib/schemas/good.schema";

import { useChainedQuery } from "@/hooks/useChainedQuery";

export const useGoodManager = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  // --- No changes to Zustand state consumption ---
  const { documentCreationState } = useAppStore((state) => state.ui);
  const selectedGoodsId = useAppStore((state) => state.selections.good);
  const setSelection = useAppStore((state) => state.setSelection);
  const setSelectedGoodsId = (id: string | null) => setSelection("good", id);

  // --- State management for modals and menus ---
  const [isAddEditGoodModalOpen, setAddEditGoodModalOpen] = useState(false);
  // ✅ CHANGED: State now uses the robust GoodClient type
  const [editingGoodData, setEditingGoodData] = useState<GoodClient | null>(
    null
  );
  const [isGoodsOptionsMenuOpen, setGoodsOptionsMenuOpen] = useState(false);
  const [goodsOptionsMenuAnchorEl, setGoodsOptionsMenuAnchorEl] =
    useState<null | HTMLElement>(null);

  // --- DATA FETCHING LOGIC ---
  // ✅ NO CHANGE NEEDED HERE: This hook correctly abstracts the new API calls.
  const queryOptions = useChainedQuery(SLIDER_TYPES.GOODS);

  // The activeQuery now correctly returns `PaginatedResponse<GoodClient>`
  const activeQuery = useQuery({
    ...queryOptions,
    staleTime: 5 * 60 * 1000,
  });

  // --- MUTATIONS (Major Refactor) ---

  const createGoodMutation = useMutation({
    // ✅ CHANGED: The mutation function now accepts the Zod-inferred payload.
    mutationFn: (data: CreateGoodPayload) => createGood(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: goodKeys.lists() });
      handleCloseAddEditGoodModal();
      success("Good Created", `Good "${data.label}" has been created successfully.`);
    },
    onError: (err) => {
      error("Create Failed", err.message || "Failed to create good. Please try again.");
    },
  });

  const updateGoodMutation = useMutation({
    // ✅ FIXED: The mutation now correctly accepts an object with id and UpdateGoodPayload data
    mutationFn: ({ id, data }: { id: string; data: UpdateGoodPayload }) => updateGood(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: goodKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: goodKeys.detail(variables.id),
      });
      handleCloseAddEditGoodModal();
      success("Good Updated", `Good "${data.label}" has been updated successfully.`);
    },
    onError: (err) => {
      error("Update Failed", err.message || "Failed to update good. Please try again.");
    },
  });

  const deleteGoodMutation = useMutation({
    // No change needed here, it already used a string ID.
    mutationFn: (goodId: string) => deleteGood(goodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goodKeys.lists() });
      setSelectedGoodsId(null);
      success("Good Deleted", "Good has been deleted successfully.");
    },
    onError: (err) => {
      error("Delete Failed", err.message || "Failed to delete good. Please try again.");
    },
  });

  // --- DERIVED STATE ---
  const goodsForSlider: GoodClient[] = useMemo(() => {
    // Cast the data to GoodClient[] since useChainedQuery may return AccountNodeData[]
    if (!activeQuery.data?.data) return [];
    return activeQuery.data.data as unknown as GoodClient[];
  }, [activeQuery.data]);

  // --- SIDE EFFECTS (useEffect) ---
  // No changes needed here, the logic remains sound.
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

  // --- EVENT HANDLERS (Major Refactor) ---

  const handleOpenAddGoodModal = () => {
    setEditingGoodData(null);
    setAddEditGoodModalOpen(true);
    setGoodsOptionsMenuOpen(false);
  };

  const handleOpenEditGoodModal = () => {
    if (!selectedGoodsId) return;
    // The `find` method returns `GoodClient | undefined`, which matches our state.
    // The old `@ts-ignore` is no longer needed.
    const goodToEdit = activeQuery.data?.data?.find(
      (g) => g.id === selectedGoodsId
    );
    if (goodToEdit) {
      setEditingGoodData(goodToEdit as unknown as GoodClient);
      setAddEditGoodModalOpen(true);
      setGoodsOptionsMenuOpen(false);
    }
  };

  const handleDeleteCurrentGood = (confirmCallback?: () => void) => {
    if (selectedGoodsId) {
      if (confirmCallback) {
        confirmCallback();
      } else {
        // Fallback for backward compatibility
        deleteGoodMutation.mutate(selectedGoodsId);
      }
      setGoodsOptionsMenuOpen(false);
    }
  };

  const deleteCurrentGood = () => {
    if (selectedGoodsId) {
      deleteGoodMutation.mutate(selectedGoodsId);
    }
  };

  const handleCloseAddEditGoodModal = () => setAddEditGoodModalOpen(false);

  // ✅ FIXED: The submit handler now properly handles update vs create
  const handleAddOrUpdateGoodSubmit = (data: CreateGoodPayload) => {
    console.log('handleAddOrUpdateGoodSubmit called with data:', data);
    console.log('editingGoodData:', editingGoodData);
    
    if (editingGoodData) {
      // For updates, extract only the fields that are allowed to be updated
      const updateData: UpdateGoodPayload = {
        label: data.label,
        taxCodeId: data.taxCodeId,
        typeCode: data.typeCode,
        description: data.description,
        unitCodeId: data.unitCodeId,
        stockTrackingMethod: data.stockTrackingMethod,
        packagingTypeCode: data.packagingTypeCode,
        photoUrl: data.photoUrl,
        additionalDetails: data.additionalDetails,
        statusId: data.statusId,
      };
      
      console.log('Calling updateGoodMutation.mutate with:', { id: editingGoodData.id, data: updateData });
      updateGoodMutation.mutate({
        id: editingGoodData.id,
        data: updateData,
      });
    } else {
      console.log('Calling createGoodMutation.mutate with:', data);
      createGoodMutation.mutate(data);
    }
  };

  const handleOpenGoodsOptionsMenu = (event: React.MouseEvent<HTMLElement>) => {
    setGoodsOptionsMenuAnchorEl(event.currentTarget);
    setGoodsOptionsMenuOpen(true);
  };

  const handleCloseGoodsOptionsMenu = () => setGoodsOptionsMenuOpen(false);

  // --- RETURNED VALUES ---
  // No changes to the shape of the returned object.
  return {
    goodsQueryState: {
      isLoading: activeQuery.isLoading,
      isFetching: activeQuery.isFetching,
      isError: activeQuery.isError,
      error: activeQuery.error,
      data: activeQuery.data,
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
    deleteCurrentGood,
    handleCloseAddEditGoodModal,
    handleAddOrUpdateGoodSubmit,
    handleOpenGoodsOptionsMenu,
    handleCloseGoodsOptionsMenu,
  };
};
