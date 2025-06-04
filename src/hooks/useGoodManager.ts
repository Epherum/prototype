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
// GPG S3 related imports are no longer needed here
// import { fetchJplByContext } from "@/services/clientJournalPartnerLinkService";
// import { fetchJpgLinksForJpl } from "@/services/clientJournalPartnerGoodLinkService";
import type {
  Good,
  CreateGoodClientData,
  UpdateGoodClientData,
  FetchGoodsParams,
  // JournalPartnerLinkClient, // No longer needed
  // JournalPartnerGoodLinkClient, // No longer needed
} from "@/lib/types";
import { getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";

export interface UseGoodManagerProps {
  sliderOrder: string[];
  visibility: { [key: string]: boolean };
  effectiveSelectedJournalIds: string[];
  selectedPartnerId: string | null;
  selectedJournalIdForPjgFiltering: string | null;
  journalRootFilterStatus: "affected" | "unaffected" | "all" | null;
  isJournalHierarchyLoading: boolean;
  isPartnerQueryLoading: boolean;
  isFlatJournalsQueryLoading: boolean;

  // Renamed and simplified GPG/GP context props
  isGPContextActive?: boolean; // True if slider order is G-P-...
  gpgContextJournalId?: string | null; // Journal ID for filtering in GP context
  // gpgSelectedPartnerIdForSlider3 is removed as S3 display is out
}

export const useGoodManager = (props: UseGoodManagerProps) => {
  const {
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds,
    selectedPartnerId,
    selectedJournalIdForPjgFiltering,
    journalRootFilterStatus,
    isJournalHierarchyLoading,
    isPartnerQueryLoading,
    isFlatJournalsQueryLoading,
    isGPContextActive, // Use this new prop
    gpgContextJournalId,
  } = props;

  const queryClient = useQueryClient();

  const [selectedGoodsId, setSelectedGoodsId] = useState<string | null>(null);
  const [isGoodsOptionsMenuOpen, setIsGoodsOptionsMenuOpen] = useState(false);
  const [goodsOptionsMenuAnchorEl, setGoodsOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditGoodModalOpen, setIsAddEditGoodModalOpen] = useState(false);
  const [editingGoodData, setEditingGoodData] = useState<Good | null>(null);

  // Determine if this Goods slider is the first in a GP context
  // This hook instance is always for "the" Goods slider that page.tsx decides to render.
  // We only care if that slider should be context-filtered.
  const shouldFilterByGpgContextJournal = useMemo(
    () => isGPContextActive && !!gpgContextJournalId,
    [isGPContextActive, gpgContextJournalId]
  );

  // The goodsSliderIndex is still relevant for non-GP context filtering
  const goodsSliderIndex = useMemo(
    () => sliderOrder.indexOf(SLIDER_TYPES.GOODS),
    [sliderOrder]
  );

  // --- Main Goods Query (for GP context Slider 1 or non-GP scenarios) ---
  const mainGoodsQueryKeyParams = useMemo((): FetchGoodsParams => {
    let params: FetchGoodsParams = { limit: 1000, offset: 0 };

    if (isGPContextActive && goodsSliderIndex === 0) {
      // Check if this instance is the first slider
      if (gpgContextJournalId) {
        // Filter if context journal is selected
        params.linkedToJournalIds = [gpgContextJournalId];
        params.includeJournalChildren = false;
      }
      // If isGPContextActive but no gpgContextJournalId, it means show all goods (default params)
      // This is because the "Filter by Journal" button would be active.
    } else if (goodsSliderIndex === 0) {
      // Goods is 1st, but NOT GP context (e.g., G-J-P or just G)
      // Default params (all goods)
    } else if (
      sliderOrder
        .join("-")
        .startsWith(SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.GOODS)
    ) {
      // J-G
      params.filterStatus = journalRootFilterStatus;
      params.contextJournalIds = [...effectiveSelectedJournalIds];
    } else if (
      sliderOrder
        .join("-")
        .startsWith(
          SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.PARTNER +
            "-" +
            SLIDER_TYPES.GOODS
        )
    ) {
      // J-P-G
      if (selectedPartnerId) {
        params.forPartnerId = selectedPartnerId;
        if (effectiveSelectedJournalIds.length > 0) {
          params.forJournalIds = [...effectiveSelectedJournalIds];
          params.includeJournalChildren = true;
        }
      } else {
        params.forPartnerId = "__IMPOSSIBLE__";
      }
    } else if (
      sliderOrder
        .join("-")
        .startsWith(
          SLIDER_TYPES.PARTNER +
            "-" +
            SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.GOODS
        )
    ) {
      // P-J-G
      if (selectedPartnerId && selectedJournalIdForPjgFiltering) {
        params.forPartnerId = selectedPartnerId;
        params.forJournalIds = [selectedJournalIdForPjgFiltering];
        params.includeJournalChildren = false;
      } else {
        params.forPartnerId = "__IMPOSSIBLE__";
      }
    }
    return params;
  }, [
    sliderOrder,
    goodsSliderIndex, // Still needed for general positioning
    isGPContextActive, // Use new prop
    gpgContextJournalId,
    journalRootFilterStatus,
    effectiveSelectedJournalIds,
    selectedPartnerId,
    selectedJournalIdForPjgFiltering,
  ]);

  const mainGoodsQuery = useQuery<Good[], Error>({
    queryKey: ["mainGoods", mainGoodsQueryKeyParams],
    queryFn: async () => {
      if (mainGoodsQueryKeyParams.forPartnerId === "__IMPOSSIBLE__") return [];
      const result = await fetchGoods(mainGoodsQueryKeyParams);
      return result.data.map((g: any) => ({
        ...g,
        id: String(g.id),
        taxCodeId: g.taxCodeId ?? null,
        unitCodeId: g.unitCodeId ?? null,
      }));
    },
    enabled: (() => {
      // Visibility check is fundamental
      if (!visibility[SLIDER_TYPES.GOODS]) return false;

      // If it's the first slider (index 0), it's always enabled.
      // The filtering (GP context or not) is handled by mainGoodsQueryKeyParams.
      if (goodsSliderIndex === 0) return true;

      // Logic for when Goods slider is not first
      const orderString = sliderOrder.join("-");
      if (
        orderString.startsWith(SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.GOODS)
      ) {
        return !isJournalHierarchyLoading;
      }
      if (
        orderString.startsWith(
          SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.PARTNER +
            "-" +
            SLIDER_TYPES.GOODS
        )
      ) {
        return (
          !!selectedPartnerId &&
          !isJournalHierarchyLoading &&
          !isPartnerQueryLoading
        );
      }
      if (
        orderString.startsWith(
          SLIDER_TYPES.PARTNER +
            "-" +
            SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.GOODS
        )
      ) {
        return (
          !!selectedPartnerId &&
          !!selectedJournalIdForPjgFiltering &&
          !isFlatJournalsQueryLoading
        );
      }
      return false; // Default to false if no enabling condition met
    })(),
  });

  // --- Determine final goods data and loading/error states (now only from mainGoodsQuery) ---
  const goodsForSlider = useMemo(() => {
    return mainGoodsQuery.data || [];
  }, [mainGoodsQuery.data]);

  const isLoadingCurrentGoods = useMemo(() => {
    return mainGoodsQuery.isLoading;
  }, [mainGoodsQuery.isLoading]);

  const isErrorCurrentGoods = useMemo(() => {
    return mainGoodsQuery.isError;
  }, [mainGoodsQuery.isError]);

  const currentGoodsError = useMemo(() => {
    return mainGoodsQuery.error;
  }, [mainGoodsQuery.error]);

  // --- Mutations ---
  const createGoodMutation = useMutation({
    mutationFn: createGood,
    onSuccess: (newGood) => {
      queryClient.invalidateQueries({ queryKey: ["mainGoods"] });
      setIsAddEditGoodModalOpen(false);
      setEditingGoodData(null);
      alert(`Good/Service '${newGood.label}' created successfully!`);
      setSelectedGoodsId(String(newGood.id)); // Select the new good
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
      // No longer need to invalidate gpgSlider3RawData
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
      // No longer need to invalidate gpgSlider3RawData
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

  // --- useEffect for selectedGoodsId (simplified) ---
  useEffect(() => {
    // This effect now always applies to the data from mainGoodsQuery
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

  // --- Callback Handlers (largely unchanged, but sourceData for edit simplifies) ---
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
    const sourceData = mainGoodsQuery.data; // Always use mainGoodsQuery data now
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
          // ... (rest of the fields remain the same)
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
    goodsForSlider, // Now always from mainGoodsQuery
    goodsQueryState: {
      // Now always reflects mainGoodsQuery
      isLoading: isLoadingCurrentGoods,
      isError: isErrorCurrentGoods,
      error: currentGoodsError,
      data: goodsForSlider,
      refetch: () => {
        mainGoodsQuery.refetch(); // Always refetch main query
      },
      isFetching: mainGoodsQuery.isFetching, // Always from main query
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
