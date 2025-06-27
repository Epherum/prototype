// src/features/goods/useGoodManager.ts
"use client";

// --- ADDED THIS FOR LOGGING ---
import { useEffect } from "react";
// ------------------------------

import { useState, useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { goodKeys, jpgLinkKeys } from "@/lib/queryKeys";
import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants";
import {
  fetchGoods,
  fetchGoodsForDocumentContext,
  createGood,
  updateGood,
  deleteGood,
} from "@/services/clientGoodService";
import type {
  Good,
  FetchGoodsParams,
  PartnerGoodFilterStatus,
  PaginatedGoodsResponse,
} from "@/lib/types";

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

  const [isAddEditGoodModalOpen, setAddEditGoodModalOpen] = useState(false);
  const [editingGoodData, setEditingGoodData] = useState<Good | null>(null);
  const [isGoodsOptionsMenuOpen, setGoodsOptionsMenuOpen] = useState(false);
  const [goodsOptionsMenuAnchorEl, setGoodsOptionsMenuAnchorEl] =
    useState<null | HTMLElement>(null);

  const documentContextQuery = useQuery({
    queryKey: jpgLinkKeys.listForDocumentContext(
      documentCreationState.lockedPartnerId,
      documentCreationState.lockedJournalId
    ),
    queryFn: () =>
      fetchGoodsForDocumentContext(
        documentCreationState.lockedPartnerId!,
        documentCreationState.lockedJournalId!
      ),
    enabled:
      documentCreationState.isCreating &&
      !!documentCreationState.lockedPartnerId &&
      !!documentCreationState.lockedJournalId,
    staleTime: Infinity,
  });

  const queryParams: FetchGoodsParams | null = useMemo(() => {
    if (documentCreationState.isCreating) {
      return null;
    }

    const { journal, partner } = selections;
    const visibleOrder = sliderOrder.filter((id) => visibility[id]);
    const goodsIndex = visibleOrder.indexOf(SLIDER_TYPES.GOODS);

    if (goodsIndex === -1) {
      return null;
    }

    // --- NEW, MORE ACCURATE DEFINITION OF "SELECTED" ---
    // A user has made a selection only if they have drilled down beyond the initial top-level.
    const hasActiveJournalSelection =
      journal.level2Ids.length > 0 ||
      journal.level3Ids.length > 0 ||
      !!journal.flatId;

    // The IDs to be used for filtering, if a selection has been made.
    const filteringJournalIds = [
      journal.topLevelId,
      ...journal.level2Ids,
      ...journal.level3Ids,
      journal.flatId,
    ].filter((id): id is string => !!id && id !== ROOT_JOURNAL_ID);
    // --------------------------------------------------------

    const precedingSliders = visibleOrder.slice(0, goodsIndex);
    const hasJournalPreceding = precedingSliders.includes(SLIDER_TYPES.JOURNAL);
    const hasPartnerPreceding = precedingSliders.includes(SLIDER_TYPES.PARTNER);

    // --- The Gatekeeper (now using the new definition) ---
    if (hasJournalPreceding && !hasActiveJournalSelection) {
      return null; // DO NOT FETCH
    }

    // --- Mutually Exclusive Scenarios ---
    if (hasJournalPreceding && hasPartnerPreceding && partner) {
      return {
        forJournalIds: filteringJournalIds,
        forPartnerId: partner,
        includeJournalChildren: true,
      };
    } else if (hasJournalPreceding) {
      return {
        linkedToJournalIds: filteringJournalIds,
        includeJournalChildren: true,
      };
    } else if (goodsIndex === 0 || !hasJournalPreceding) {
      // This case is for when Goods is the first slider. It fetches a broad list.
      return {
        filterStatuses: journal.rootFilter as PartnerGoodFilterStatus[],
        // We pass the root journal as context, but this does not imply a selection.
        contextJournalIds: [journal.topLevelId].filter(
          (id) => id !== ROOT_JOURNAL_ID
        ),
        restrictedJournalId: auth.effectiveRestrictedJournalId,
      };
    }

    return null;
  }, [
    selections,
    sliderOrder,
    visibility,
    documentCreationState.isCreating,
    auth.effectiveRestrictedJournalId,
  ]);

  // --- LOGGING HOOK ---
  // This effect will run ONLY when queryParams changes, giving a clean log.
  useEffect(() => {
    console.log(
      `%c[useGoodManager] Final queryParams object for TanStack Query:`,
      "color: blue; font-weight: bold;",
      queryParams
    );
  }, [queryParams]);
  // --------------------

  const normalGoodsQuery = useQuery({
    queryKey: goodKeys.list(queryParams!),
    queryFn: () => {
      // Log right before the fetch happens
      console.log(
        `%c[useGoodManager] EXECUTING FETCH with params:`,
        "color: red; font-weight: bold;",
        queryParams
      );
      return fetchGoods(queryParams!);
    },
    enabled: !documentCreationState.isCreating && !!queryParams,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const activeQuery: UseQueryResult<PaginatedGoodsResponse, Error> =
    documentCreationState.isCreating ? documentContextQuery : normalGoodsQuery;

  // ... rest of the file is unchanged ...

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
      label: good.name,
      ...good,
    }));
  }, [activeQuery.data]);

  useEffect(() => {
    // This effect handles auto-selecting a good when the list changes.
    const isReadyForSelection =
      !activeQuery.isLoading && !activeQuery.isFetching;
    if (!isReadyForSelection) return;

    const selectedExists = goodsForSlider.some((g) => g.id === selectedGoodsId);

    // Case 1: The list is not empty, but nothing is selected. Select the first item.
    if (!selectedGoodsId && goodsForSlider.length > 0) {
      setSelectedGoodsId(goodsForSlider[0].id);
    }
    // Case 2: The currently selected item is no longer in the list. Select the new first item.
    else if (selectedGoodsId && !selectedExists && goodsForSlider.length > 0) {
      setSelectedGoodsId(goodsForSlider[0].id);
    }
    // Case 3: The list has become empty, but something is still selected. Clear the selection.
    else if (goodsForSlider.length === 0 && selectedGoodsId) {
      setSelectedGoodsId(null);
    }
  }, [
    goodsForSlider,
    selectedGoodsId,
    setSelectedGoodsId,
    activeQuery.isLoading,
    activeQuery.isFetching,
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
