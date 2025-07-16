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

  // State management for modals and menus (remains unchanged)
  const [isAddEditGoodModalOpen, setAddEditGoodModalOpen] = useState(false);
  const [editingGoodData, setEditingGoodData] = useState<Good | null>(null);
  const [isGoodsOptionsMenuOpen, setGoodsOptionsMenuOpen] = useState(false);
  const [goodsOptionsMenuAnchorEl, setGoodsOptionsMenuAnchorEl] =
    useState<null | HTMLElement>(null);

  // --- DATA FETCHING LOGIC ---

  const activeJournalIdsForFiltering = useMemo(() => {
    const { journal } = selections;
    const { isCreating } = documentCreationState;

    // When creating a document, the context is the single, most specific, terminal journal selected.
    if (isCreating) {
      // The most specific selection (L3) is prioritized.
      if (journal.level3Ids.length > 0) {
        return journal.level3Ids;
      }
      // If no L3, use L2.
      if (journal.level2Ids.length > 0) {
        return journal.level2Ids;
      }
      // If it's a flat list, use that ID.
      if (journal.flatId) {
        return [journal.flatId];
      }
      // Fallback for top-level selection in creation mode.
      return [journal.topLevelId];
    }

    // In normal (non-creation) mode, we use the broader selection context across the hierarchy.
    return [
      journal.topLevelId,
      ...journal.level2Ids,
      ...journal.level3Ids,
      journal.flatId,
    ].filter((id): id is string => !!id && id !== ROOT_JOURNAL_ID);
  }, [selections.journal, documentCreationState.isCreating]);

  const normalGoodsQueryParams: FetchGoodsParams | null = useMemo(() => {
    const { journal, partner } = selections;
    const visibleOrder = sliderOrder.filter((id) => visibility[id]);
    const goodsIndex = visibleOrder.indexOf(SLIDER_TYPES.GOODS);
    if (goodsIndex === -1) return null;
    const journalIndex = visibleOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const partnerIndex = visibleOrder.indexOf(SLIDER_TYPES.PARTNER);

    // ✅ 2. Use the new derived state for checking active selection.
    const hasActiveJournalSelection = activeJournalIdsForFiltering.length > 0;

    if (goodsIndex === 0)
      return { restrictedJournalId: auth.effectiveRestrictedJournalId };
    if (journalIndex < goodsIndex && !hasActiveJournalSelection) return null;
    if (journalIndex < goodsIndex && partnerIndex < goodsIndex && partner) {
      return {
        // ✅ 3. Use the new derived state for filtering.
        forJournalIds: activeJournalIdsForFiltering,
        forPartnerId: partner,
        includeJournalChildren: true,
      };
    } else if (journalIndex < goodsIndex) {
      return {
        filterStatuses: journal.rootFilter as PartnerGoodFilterStatus[],
        // ✅ 3. Use the new derived state for filtering.
        contextJournalIds: activeJournalIdsForFiltering,
        includeJournalChildren: true,
        restrictedJournalId: auth.effectiveRestrictedJournalId,
      };
    }
    return null;
  }, [
    selections,
    sliderOrder,
    visibility,
    auth.effectiveRestrictedJournalId,
    activeJournalIdsForFiltering,
  ]); // ✅ Add dependency

  const normalGoodsQuery = useQuery({
    queryKey: goodKeys.list(normalGoodsQueryParams!),
    queryFn: () => fetchGoods(normalGoodsQueryParams!),
    enabled:
      (!documentCreationState.isCreating ||
        (documentCreationState.isCreating &&
          (documentCreationState.mode === "INTERSECT_FROM_GOOD" ||
            documentCreationState.mode === "LOCK_GOOD" ||
            documentCreationState.mode === "SINGLE_ITEM"))) &&
      !!normalGoodsQueryParams,
    staleTime: 5 * 60 * 1000,
  });

  const goodsForSingleLockedPartnerQuery = useQuery({
    queryKey: goodKeys.list({
      forPartnerId: documentCreationState.lockedPartnerIds[0],
      forJournalIds: activeJournalIdsForFiltering,
    }),
    queryFn: () =>
      fetchGoods({
        forPartnerId: documentCreationState.lockedPartnerIds[0],
        // ✅ 5. FIX: Use the correct, specific journal ID(s) from our derived state.
        forJournalIds: activeJournalIdsForFiltering,
        includeJournalChildren: true, // This is likely desired to catch all goods under the terminal journal
      }),
    enabled:
      documentCreationState.isCreating &&
      documentCreationState.mode === "LOCK_PARTNER" &&
      documentCreationState.lockedPartnerIds.length === 1 &&
      // ✅ 6. Update enabled check to rely on the new derived state.
      activeJournalIdsForFiltering.length > 0,
    staleTime: Infinity,
  });

  const goodsForMultiPartnerIntersectionQuery = useQuery({
    queryKey: goodKeys.list({
      forPartnersIntersection: documentCreationState.lockedPartnerIds,
      // ✅ 4. Update queryKey.
      journalId: activeJournalIdsForFiltering[0],
    }),
    queryFn: () =>
      getGoodsForPartners(
        documentCreationState.lockedPartnerIds,
        // ✅ 5. FIX: Use the correct, specific journal ID. The backend expects a single ID for intersection.
        activeJournalIdsForFiltering[0]
      ),
    enabled:
      documentCreationState.isCreating &&
      documentCreationState.mode === "INTERSECT_FROM_PARTNER" &&
      documentCreationState.lockedPartnerIds.length > 0 &&
      // ✅ 6. Update enabled check.
      activeJournalIdsForFiltering.length > 0,
    staleTime: Infinity,
  });

  // ✅ REFACTORED: The `useMemo` now correctly selects the new intersection query.
  const activeQuery: UseQueryResult<PaginatedGoodsResponse, Error> =
    useMemo(() => {
      const { isCreating, mode, lockedPartnerIds } = documentCreationState;

      if (!isCreating) {
        return normalGoodsQuery;
      }

      switch (mode) {
        // Flow being fixed: J -> D -> P -> G
        case "INTERSECT_FROM_PARTNER":
          // If partners are selected, use the intersection query. Otherwise, return an empty state.
          return lockedPartnerIds.length > 0
            ? goodsForMultiPartnerIntersectionQuery
            : ({ data: { data: [], total: 0 }, status: "success" } as any);

        // A different, existing flow: J -> P -> D -> G
        case "LOCK_PARTNER":
          return goodsForSingleLockedPartnerQuery;

        // Other flows where the Goods slider behaves normally
        case "INTERSECT_FROM_GOOD":
        case "LOCK_GOOD":
        case "SINGLE_ITEM":
          return normalGoodsQuery;

        default:
          // Return a default empty state for any other case
          return { data: { data: [], total: 0 }, status: "success" } as any;
      }
    }, [
      documentCreationState,
      normalGoodsQuery,
      goodsForMultiPartnerIntersectionQuery, // Dependency on the new query
      goodsForSingleLockedPartnerQuery,
    ]);

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
