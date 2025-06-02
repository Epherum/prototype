// src/hooks/useGoodManager.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchGoods,
  createGood,
  updateGood,
  deleteGood,
  // fetchGoodsForJournalsAndPartner, // Keep in page.tsx or move to linking hook
  // fetchGoodsLinkedToJournals,     // Keep in page.tsx or move to linking hook
  // fetchGoodsLinkedToPartnerViaJPGL, // Keep in page.tsx or move to linking hook
} from "@/services/clientGoodService";
import type {
  Good,
  CreateGoodClientData,
  UpdateGoodClientData,
  FetchGoodsParams,
} from "@/lib/types";
import { getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";

export interface UseGoodManagerProps {
  sliderOrder: string[];
  visibility: { [key: string]: boolean };
  // Filters from other sliders:
  effectiveSelectedJournalIds: string[]; // From Journal domain
  selectedPartnerId: string | null; // From Partner domain
  selectedJournalIdForPjgFiltering: string | null; // From Journal (flat list) for P-J-G
  journalRootFilterStatus: "affected" | "unaffected" | "all" | null; // From Journal domain
  // Query loading states from other domains if goodsQuery.enabled depends on them
  isJournalHierarchyLoading: boolean;
  isPartnerQueryLoading: boolean; // Loading state from usePartnerManager's partnerQuery
  isFlatJournalsQueryLoading: boolean; // For P-J-G, from flatJournalsQuery
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
  } = props;

  const queryClient = useQueryClient();

  // --- State ---
  const [selectedGoodsId, setSelectedGoodsId] = useState<string | null>(null);
  const [isGoodsOptionsMenuOpen, setIsGoodsOptionsMenuOpen] = useState(false);
  const [goodsOptionsMenuAnchorEl, setGoodsOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditGoodModalOpen, setIsAddEditGoodModalOpen] = useState(false);
  const [editingGoodData, setEditingGoodData] = useState<Good | null>(null);

  // --- TanStack Queries ---
  const goodsQueryKeyParamsStructure = useMemo((): FetchGoodsParams => {
    const orderString = sliderOrder.join("-");
    let params: FetchGoodsParams = { limit: 1000, offset: 0 };

    const goodsIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);

    if (goodsIndex === 0) {
      // Default params
    } else if (
      orderString.startsWith(SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.GOODS)
    ) {
      // J-G-...
      params.filterStatus = journalRootFilterStatus;
      params.contextJournalIds = [...effectiveSelectedJournalIds];
    } else if (
      orderString.startsWith(
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
      }
    } else if (
      orderString.startsWith(
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
      }
    }
    return params;
  }, [
    sliderOrder,
    effectiveSelectedJournalIds,
    selectedPartnerId,
    selectedJournalIdForPjgFiltering,
    journalRootFilterStatus,
  ]);

  const goodsQuery = useQuery<Good[], Error>({
    queryKey: ["goods", goodsQueryKeyParamsStructure],
    queryFn: async (): Promise<Good[]> => {
      const params = goodsQueryKeyParamsStructure;
      const currentOrderString = sliderOrder.join("-");
      console.log(
        `[goodsQuery.queryFn in useGoodManager] order: ${currentOrderString}, params:`,
        JSON.stringify(params)
      );

      if (
        currentOrderString.startsWith(
          SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.PARTNER +
            "-" +
            SLIDER_TYPES.GOODS
        ) &&
        (!params.forPartnerId ||
          !params.forJournalIds ||
          params.forJournalIds.length === 0)
      ) {
        return [];
      }
      if (
        currentOrderString.startsWith(
          SLIDER_TYPES.PARTNER +
            "-" +
            SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.GOODS
        ) &&
        (!params.forPartnerId ||
          !params.forJournalIds ||
          params.forJournalIds.length === 0)
      ) {
        return [];
      }
      const result = await fetchGoods(params);
      return result.data.map((g: any) => ({
        ...g,
        id: String(g.id),
        taxCodeId: g.taxCodeId ?? null,
        unitCodeId: g.unitCodeId ?? null,
      }));
    },
    enabled: (() => {
      if (!visibility[SLIDER_TYPES.GOODS]) return false;

      const goodsIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);
      const orderString = sliderOrder.join("-");

      if (goodsIndex === 0) return true;

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
          !isPartnerQueryLoading // Partner query for 2nd slider should not be loading
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
          !isFlatJournalsQueryLoading // Flat journal data for P-J should be loaded
        );
      }
      return false;
    })(),
  });

  const goodsForSlider = useMemo(
    () => goodsQuery.data || [],
    [goodsQuery.data]
  );

  // --- TanStack Mutations ---
  const createGoodMutation = useMutation({
    mutationFn: createGood,
    onSuccess: (newGood) => {
      queryClient.invalidateQueries({
        queryKey: ["goods", goodsQueryKeyParamsStructure],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["goods", goodsQueryKeyParamsStructure],
      });
      // queryClient.invalidateQueries({ queryKey: ["goods", String(updatedGood.id)] });
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
      queryClient.invalidateQueries({
        queryKey: ["goods", goodsQueryKeyParamsStructure],
      });
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

  // --- useEffects ---
  useEffect(() => {
    if (goodsQuery.isSuccess && goodsQuery.data) {
      const fetchedGoods = goodsQuery.data;
      const currentSelectionInList =
        selectedGoodsId && fetchedGoods.some((g) => g.id === selectedGoodsId);
      if (fetchedGoods.length > 0 && !currentSelectionInList) {
        setSelectedGoodsId(getFirstId(fetchedGoods));
      } else if (fetchedGoods.length === 0 && selectedGoodsId !== null) {
        setSelectedGoodsId(null);
      }
    } else if (
      !goodsQuery.isLoading &&
      !goodsQuery.isFetching &&
      !goodsQuery.isError &&
      selectedGoodsId !== null
    ) {
      if (!goodsQuery.data || goodsQuery.data.length === 0) {
        setSelectedGoodsId(null);
      }
    }
  }, [
    goodsQuery.data,
    goodsQuery.isSuccess,
    goodsQuery.isLoading,
    goodsQuery.isFetching,
    goodsQuery.isError,
    selectedGoodsId,
  ]);

  // --- Callback Handlers ---
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
    if (selectedGoodsId && goodsQuery.data) {
      const goodToEdit = goodsQuery.data.find((g) => g.id === selectedGoodsId);
      if (goodToEdit) {
        setEditingGoodData(goodToEdit);
        setIsAddEditGoodModalOpen(true);
      } else {
        alert("Selected good/service data not found.");
      }
    }
    handleCloseGoodsOptionsMenu();
  }, [selectedGoodsId, goodsQuery.data, handleCloseGoodsOptionsMenu]);

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

  // --- Return Value ---
  return {
    // State
    selectedGoodsId,
    setSelectedGoodsId, // Expose setter
    isGoodsOptionsMenuOpen,
    goodsOptionsMenuAnchorEl,
    isAddEditGoodModalOpen,
    editingGoodData,
    // Data & Query Status
    goodsForSlider,
    goodsQuery, // Expose whole query object
    // Mutations
    createGoodMutation,
    updateGoodMutation,
    deleteGoodMutation,
    // Callbacks
    handleOpenGoodsOptionsMenu,
    handleCloseGoodsOptionsMenu,
    handleOpenAddGoodModal,
    handleOpenEditGoodModal,
    handleCloseAddEditGoodModal,
    handleAddOrUpdateGoodSubmit,
    handleDeleteCurrentGood,
  };
};
