// src/hooks/useGoodManager.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchGoods,
  createGood,
  updateGood,
  deleteGood,
} from "@/services/clientGoodService";
import type {
  Good,
  CreateGoodClientData,
  UpdateGoodClientData,
  FetchGoodsParams,
  ActivePartnerFilters, // Import the array type
} from "@/lib/types";
import { getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";

export interface UseGoodManagerProps {
  sliderOrder: string[];
  visibility: { [key: string]: boolean };
  effectiveSelectedJournalIds: string[];
  selectedPartnerId: string | null;
  selectedJournalIdForPjgFiltering: string | null;
  // --- UPDATED PROPS ---
  filterStatuses: ActivePartnerFilters; // Use array type
  effectiveRestrictedJournalId: string | null;
  // --------------------
  isJournalHierarchyLoading: boolean;
  isPartnerQueryLoading: boolean;
  isFlatJournalsQueryLoading: boolean;
  isGPContextActive?: boolean;
  gpgContextJournalId?: string | null;
}

export const useGoodManager = (props: UseGoodManagerProps) => {
  const {
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds,
    selectedPartnerId,
    selectedJournalIdForPjgFiltering,
    // --- UPDATED PROPS ---
    filterStatuses,
    effectiveRestrictedJournalId,
    // --------------------
    isJournalHierarchyLoading,
    isPartnerQueryLoading,
    isFlatJournalsQueryLoading,
    isGPContextActive,
    gpgContextJournalId,
  } = props;

  // ... (state variables are unchanged)
  const queryClient = useQueryClient();
  const [selectedGoodsId, setSelectedGoodsId] = useState<string | null>(null);
  const [isGoodsOptionsMenuOpen, setIsGoodsOptionsMenuOpen] = useState(false);
  const [goodsOptionsMenuAnchorEl, setGoodsOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditGoodModalOpen, setIsAddEditGoodModalOpen] = useState(false);
  const [editingGoodData, setEditingGoodData] = useState<Good | null>(null);
  const goodsSliderIndex = useMemo(
    () => sliderOrder.indexOf(SLIDER_TYPES.GOODS),
    [sliderOrder]
  );

  const mainGoodsQueryKeyParams = useMemo((): FetchGoodsParams => {
    let params: FetchGoodsParams = { limit: 1000, offset: 0 };
    const currentOrderString = sliderOrder.join("-");

    if (isGPContextActive && goodsSliderIndex === 0) {
      if (gpgContextJournalId)
        params.linkedToJournalIds = [gpgContextJournalId];
    } else if (goodsSliderIndex === 0) {
      // Default params (all goods)
    }
    // --- REFACTORED: J-G Flow ---
    else if (
      currentOrderString.startsWith(
        `${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.GOODS}`
      )
    ) {
      params.filterStatuses = filterStatuses;
      params.restrictedJournalId = effectiveRestrictedJournalId;
      if (filterStatuses.includes("affected")) {
        params.contextJournalIds = effectiveSelectedJournalIds;
      }
    }
    // --- (Other flows are unchanged) ---
    else if (
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
      if (selectedPartnerId && selectedJournalIdForPjgFiltering) {
        params.forPartnerId = selectedPartnerId;
        params.forJournalIds = [selectedJournalIdForPjgFiltering];
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
    filterStatuses, // Use new array
    effectiveRestrictedJournalId,
    effectiveSelectedJournalIds,
    selectedPartnerId,
    selectedJournalIdForPjgFiltering,
  ]);

  const mainGoodsQuery = useQuery<Good[], Error>({
    queryKey: ["mainGoods", mainGoodsQueryKeyParams],
    queryFn: async () => {
      if (mainGoodsQueryKeyParams.forPartnerId?.startsWith("__IMPOSSIBLE"))
        return [];
      const result = await fetchGoods(mainGoodsQueryKeyParams);
      return result.data.map((g: any) => ({
        ...g,
        id: String(g.id),
        taxCodeId: g.taxCodeId ?? null,
        unitCodeId: g.unitCodeId ?? null,
      }));
    },
    enabled: (() => {
      // --- UPDATED enabled logic for J-G flow ---
      if (!visibility[SLIDER_TYPES.GOODS]) return false;
      const orderString = sliderOrder.join("-");
      if (goodsSliderIndex === 0) return true;
      if (
        orderString.startsWith(`${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.GOODS}`)
      ) {
        // This logic is now the same as the Partner one, checking for valid filter states
        if (filterStatuses.length === 0) return false;
        const hasContextFreeFilter = filterStatuses.some(
          (status) => status === "unaffected" || status === "inProcess"
        );
        if (hasContextFreeFilter) return !isJournalHierarchyLoading;
        if (filterStatuses.includes("affected")) {
          return (
            effectiveSelectedJournalIds.length > 0 && !isJournalHierarchyLoading
          );
        }
        return false;
      }
      if (
        orderString.startsWith(
          `${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.PARTNER}-${SLIDER_TYPES.GOODS}`
        )
      ) {
        return (
          !!selectedPartnerId &&
          effectiveSelectedJournalIds.length > 0 &&
          !isJournalHierarchyLoading &&
          !isPartnerQueryLoading
        );
      }
      if (
        orderString.startsWith(
          `${SLIDER_TYPES.PARTNER}-${SLIDER_TYPES.JOURNAL}-${SLIDER_TYPES.GOODS}`
        )
      ) {
        return (
          !!selectedPartnerId &&
          !!selectedJournalIdForPjgFiltering &&
          !isPartnerQueryLoading &&
          !isFlatJournalsQueryLoading
        );
      }
      return false;
    })(),
  });

  // ... (Rest of the hook is unchanged)
  const goodsForSlider = useMemo(
    () => mainGoodsQuery.data || [],
    [mainGoodsQuery.data]
  );
  const isLoadingCurrentGoods = useMemo(
    () => mainGoodsQuery.isLoading,
    [mainGoodsQuery.isLoading]
  );
  const isErrorCurrentGoods = useMemo(
    () => mainGoodsQuery.isError,
    [mainGoodsQuery.isError]
  );
  const currentGoodsError = useMemo(
    () => mainGoodsQuery.error,
    [mainGoodsQuery.error]
  );
  const createGoodMutation = useMutation({
    mutationFn: createGood,
    onSuccess: (newGood) => {
      queryClient.invalidateQueries({ queryKey: ["mainGoods"] });
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
  const updateGoodMutation = useMutation({
    mutationFn: (variables: { id: string; data: UpdateGoodClientData }) =>
      updateGood(variables.id, variables.data),
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
  const deleteGoodMutation = useMutation({
    mutationFn: deleteGood,
    onSuccess: (response, deletedGoodId) => {
      queryClient.invalidateQueries({ queryKey: ["mainGoods"] });
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
    } else if (
      !mainGoodsQuery.isLoading &&
      !mainGoodsQuery.isFetching &&
      !mainGoodsQuery.isError &&
      selectedGoodsId !== null
    ) {
      if (!currentData || currentData.length === 0) {
        setSelectedGoodsId(null);
      }
    }
  }, [
    mainGoodsQuery.data,
    mainGoodsQuery.isSuccess,
    mainGoodsQuery.isLoading,
    mainGoodsQuery.isFetching,
    mainGoodsQuery.isError,
    selectedGoodsId,
  ]);
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
        const payloadForUpdate: UpdateGoodClientData = {
          label: dataFromModal.label,
          taxCodeId: (dataFromModal as any).taxCodeId,
          typeCode: (dataFromModal as any).typeCode,
          description: (dataFromModal as any).description,
          unitCodeId: (dataFromModal as any).unitCodeId,
          stockTrackingMethod: (dataFromModal as any).stockTrackingMethod,
          packagingTypeCode: (dataFromModal as any).packagingTypeCode,
          photoUrl: (dataFromModal as any).photoUrl,
          additionalDetails: (dataFromModal as any).additionalDetails,
          price: (dataFromModal as any).price,
        };
        Object.keys(payloadForUpdate).forEach((keyStr) => {
          const key = keyStr as keyof UpdateGoodClientData;
          if (payloadForUpdate[key] === undefined) {
            delete payloadForUpdate[key];
          }
        });
        if (Object.keys(payloadForUpdate).length === 0) {
          alert("No changes detected to save for the good/service.");
          setIsAddEditGoodModalOpen(false);
          setEditingGoodData(null);
          return;
        }
        updateGoodMutation.mutate({
          id: goodIdToUpdate,
          data: payloadForUpdate,
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
    goodsForSlider,
    goodsQueryState: {
      isLoading: isLoadingCurrentGoods,
      isError: isErrorCurrentGoods,
      error: currentGoodsError,
      data: goodsForSlider,
      refetch: () => {
        mainGoodsQuery.refetch();
      },
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
