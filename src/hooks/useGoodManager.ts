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
} from "@/lib/types";
import { getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";

export interface UseGoodManagerProps {
  sliderOrder: string[];
  visibility: { [key: string]: boolean };
  effectiveSelectedJournalIds: string[];
  selectedPartnerId: string | null;
  selectedJournalIdForPjgFiltering: string | null;
  journalRootFilterStatus:
    | "affected"
    | "unaffected"
    | "inProcess"
    | "all"
    | null;
  effectiveRestrictedJournalId: string | null; // <-- ADD THIS PROP
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
    selectedPartnerId, // Used for J-P-G (S3)
    selectedJournalIdForPjgFiltering, // Used for P-J-G (S3)
    journalRootFilterStatus,
    effectiveRestrictedJournalId,
    isJournalHierarchyLoading, // S1 Journal loading state
    isPartnerQueryLoading, // S2 Partner loading state (for J-P-G)
    isFlatJournalsQueryLoading, // S2 Journal loading state (for P-J-G)
    isGPContextActive,
    gpgContextJournalId,
  } = props;

  const queryClient = useQueryClient();

  const [selectedGoodsId, setSelectedGoodsId] = useState<string | null>(null);
  // ... (other state variables remain the same)
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

    console.log(
      `[useGoodManager] Recalculating mainGoodsQueryKeyParams. Order: ${currentOrderString}, Journal IDs: ${effectiveSelectedJournalIds.join(
        ","
      )}, Partner ID: ${selectedPartnerId}, PJG Journal ID: ${selectedJournalIdForPjgFiltering}`
    );

    if (isGPContextActive && goodsSliderIndex === 0) {
      if (gpgContextJournalId) {
        params.linkedToJournalIds = [gpgContextJournalId];
        params.includeJournalChildren = false;
      }
    } else if (goodsSliderIndex === 0) {
      // Goods is 1st, not GP context (e.g., G-J-P or just G)
      // Default params (all goods)
    } else if (
      currentOrderString.startsWith(
        SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.GOODS
      ) // J-G (Goods S2)
    ) {
      // --- THIS IS THE KEY CHANGE ---
      params.filterStatus = journalRootFilterStatus;
      params.restrictedJournalId = effectiveRestrictedJournalId; // Pass the ID
      if (
        journalRootFilterStatus === "affected" ||
        journalRootFilterStatus === "all"
      ) {
        params.contextJournalIds = [...props.effectiveSelectedJournalIds];
      }
    } else if (
      currentOrderString.startsWith(
        SLIDER_TYPES.JOURNAL +
          "-" +
          SLIDER_TYPES.PARTNER +
          "-" +
          SLIDER_TYPES.GOODS // J-P-G (Goods S3)
      )
    ) {
      if (selectedPartnerId && effectiveSelectedJournalIds.length > 0) {
        params.forPartnerId = selectedPartnerId;
        params.forJournalIds = [...effectiveSelectedJournalIds];
        params.includeJournalChildren = true; // Journal is primary, so include children context
        console.log(
          `[useGoodManager] J-P-G params: forPartnerId=${selectedPartnerId}, forJournalIds=${effectiveSelectedJournalIds.join(
            ","
          )}`
        );
      } else {
        // Critical context missing for J-P-G
        params.forPartnerId = "__IMPOSSIBLE_JPGL_CONTEXT__";
        console.log(
          `[useGoodManager] J-P-G context missing. Params set to impossible.`
        );
      }
    } else if (
      currentOrderString.startsWith(
        SLIDER_TYPES.PARTNER +
          "-" +
          SLIDER_TYPES.JOURNAL +
          "-" +
          SLIDER_TYPES.GOODS // P-J-G (Goods S3)
      )
    ) {
      if (selectedPartnerId && selectedJournalIdForPjgFiltering) {
        params.forPartnerId = selectedPartnerId;
        params.forJournalIds = [selectedJournalIdForPjgFiltering];
        params.includeJournalChildren = false; // Journal is secondary, flat list
        console.log(
          `[useGoodManager] P-J-G params: forPartnerId=${selectedPartnerId}, forJournalIds=${selectedJournalIdForPjgFiltering}`
        );
      } else {
        // Critical context missing for P-J-G
        params.forPartnerId = "__IMPOSSIBLE_PJGL_CONTEXT__";
        console.log(
          `[useGoodManager] P-J-G context missing. Params set to impossible.`
        );
      }
    }
    return params;
  }, [
    sliderOrder,
    goodsSliderIndex,
    isGPContextActive,
    gpgContextJournalId,
    journalRootFilterStatus,
    effectiveRestrictedJournalId, // Key for J-G
    effectiveSelectedJournalIds,
    selectedPartnerId, // Key for J-P-G
    selectedJournalIdForPjgFiltering, // Key for P-J-G
  ]);

  const mainGoodsQuery = useQuery<Good[], Error>({
    queryKey: ["mainGoods", mainGoodsQueryKeyParams],
    queryFn: async () => {
      console.log(
        `[useGoodManager mainGoodsQuery.queryFn] Attempting to fetch with params:`,
        JSON.stringify(mainGoodsQueryKeyParams)
      );
      if (mainGoodsQueryKeyParams.forPartnerId?.startsWith("__IMPOSSIBLE")) {
        console.log(
          `[useGoodManager mainGoodsQuery.queryFn] Impossible condition detected with forPartnerId: ${mainGoodsQueryKeyParams.forPartnerId}. Returning [].`
        );
        return [];
      }
      // Add other __IMPOSSIBLE__ checks if you introduce more specific markers

      const result = await fetchGoods(mainGoodsQueryKeyParams);
      console.log(
        `[useGoodManager mainGoodsQuery.queryFn] Fetched ${result.data.length} goods.`
      );
      return result.data.map((g: any) => ({
        ...g,
        id: String(g.id),
        taxCodeId: g.taxCodeId ?? null,
        unitCodeId: g.unitCodeId ?? null,
      }));
    },
    enabled: (() => {
      if (!visibility[SLIDER_TYPES.GOODS]) {
        // console.log("[useGoodManager enabled] Goods slider not visible. Query disabled.");
        return false;
      }

      const orderString = sliderOrder.join("-");
      let enableQuery = false;
      let reason = "";

      if (goodsSliderIndex === 0) {
        // G, G-P, G-J
        enableQuery = true;
        reason = "Goods is S1";
      } else if (
        orderString.startsWith(SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.GOODS)
      ) {
        // J-G (Goods S2)
        enableQuery = !isJournalHierarchyLoading;
        reason = `J-G: S1 Journal Loading: ${isJournalHierarchyLoading}`;
      } else if (
        orderString.startsWith(
          SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.PARTNER +
            "-" +
            SLIDER_TYPES.GOODS
        )
      ) {
        // J-P-G (Goods S3)
        enableQuery =
          !!selectedPartnerId && // S2 Partner is selected
          effectiveSelectedJournalIds.length > 0 && // S1 Journal is selected
          !isJournalHierarchyLoading && // S1 Journal is not loading
          !isPartnerQueryLoading; // S2 Partner is not loading
        reason = `J-P-G: S2 Partner Selected: ${!!selectedPartnerId}, S1 Journal Selected: ${
          effectiveSelectedJournalIds.length > 0
        }, S1 Loading: ${isJournalHierarchyLoading}, S2 Loading: ${isPartnerQueryLoading}`;
      } else if (
        orderString.startsWith(
          SLIDER_TYPES.PARTNER +
            "-" +
            SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.GOODS
        )
      ) {
        // P-J-G (Goods S3)
        enableQuery =
          !!selectedPartnerId && // S1 Partner is selected
          !!selectedJournalIdForPjgFiltering && // S2 Journal is selected
          !isPartnerQueryLoading && // S1 Partner is not loading (assuming isPartnerQueryLoading covers S1 partner if P is first)
          !isFlatJournalsQueryLoading; // S2 Journal is not loading
        reason = `P-J-G: S1 Partner Selected: ${!!selectedPartnerId}, S2 Journal Selected: ${!!selectedJournalIdForPjgFiltering}, S1 Loading: ${isPartnerQueryLoading}, S2 Loading: ${isFlatJournalsQueryLoading}`;
      } else {
        reason = "Order not matched for enabling goods query";
      }

      // console.log(`[useGoodManager enabled] Evaluation for order "${orderString}": ${enableQuery}. Reason: ${reason}`);
      return enableQuery;
    })(),
  });

  // ... (rest of the hook: useMemo for goodsForSlider, isLoadingCurrentGoods, etc., mutations, useEffect, callbacks)
  // Ensure they use mainGoodsQuery.

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
