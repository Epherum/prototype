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
  fetchIntersectionOfGoods,
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

  // --- DATA FETCHING LOGIC ---

  // Query 1: For normal, non-document-creation operation (Unchanged)
  const normalGoodsQueryParams: FetchGoodsParams | null = useMemo(() => {
    const { journal, partner } = selections;
    const visibleOrder = sliderOrder.filter((id) => visibility[id]);
    const goodsIndex = visibleOrder.indexOf(SLIDER_TYPES.GOODS);
    if (goodsIndex === -1) return null;
    const journalIndex = visibleOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const partnerIndex = visibleOrder.indexOf(SLIDER_TYPES.PARTNER);
    const hasActiveJournalSelection =
      journal.level2Ids.length > 0 ||
      journal.level3Ids.length > 0 ||
      !!journal.flatId;
    const filteringJournalIds = [
      journal.topLevelId,
      ...journal.level2Ids,
      ...journal.level3Ids,
      journal.flatId,
    ].filter((id): id is string => !!id && id !== ROOT_JOURNAL_ID);
    if (goodsIndex === 0)
      return { restrictedJournalId: auth.effectiveRestrictedJournalId };
    if (journalIndex < goodsIndex && !hasActiveJournalSelection) return null;
    if (journalIndex < goodsIndex && partnerIndex < goodsIndex && partner) {
      return {
        forJournalIds: filteringJournalIds,
        forPartnerId: partner,
        includeJournalChildren: true,
      };
    } else if (journalIndex < goodsIndex) {
      return {
        filterStatuses: journal.rootFilter as PartnerGoodFilterStatus[],
        contextJournalIds: filteringJournalIds,
        includeJournalChildren: true,
        restrictedJournalId: auth.effectiveRestrictedJournalId,
      };
    }
    return null;
  }, [selections, sliderOrder, visibility, auth.effectiveRestrictedJournalId]);

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

  const goodsForSinglePartnerQuery = useQuery({
    queryKey: goodKeys.list({
      forPartnerId: documentCreationState.lockedPartnerIds[0],
      forJournalIds: [documentCreationState.lockedJournalId!],
    }),
    queryFn: () =>
      fetchGoods({
        forPartnerId: documentCreationState.lockedPartnerIds[0],
        forJournalIds: [documentCreationState.lockedJournalId!],
        includeJournalChildren: true,
      }),
    enabled:
      documentCreationState.isCreating &&
      // ✅ Enable this query in two scenarios:
      (documentCreationState.mode === "LOCK_PARTNER" ||
        (documentCreationState.mode === "INTERSECT_FROM_PARTNER" &&
          documentCreationState.lockedPartnerIds.length === 1)) &&
      documentCreationState.lockedPartnerIds.length > 0 &&
      !!documentCreationState.lockedJournalId,
    staleTime: Infinity,
  });

  // 3. Query for the INTERSECTION of MULTIPLE selected partners (2 or more)
  const intersectionGoodsQuery = useQuery({
    queryKey: goodKeys.list({
      forPartnersIntersection: documentCreationState.lockedPartnerIds,
      journalId: documentCreationState.lockedJournalId,
    }),
    queryFn: () =>
      fetchIntersectionOfGoods(
        documentCreationState.lockedPartnerIds,
        documentCreationState.lockedJournalId!
      ),
    // ✅ FIX: This query should ONLY be enabled when there are 2 OR MORE partners selected.
    enabled:
      documentCreationState.isCreating &&
      documentCreationState.mode === "INTERSECT_FROM_PARTNER" &&
      documentCreationState.lockedPartnerIds.length > 1 && // The key change is from `> 0` to `> 1`
      !!documentCreationState.lockedJournalId,
    staleTime: Infinity,
  });

  // === ACTIVE QUERY SELECTOR (THE CORE FIX) ===
  const activeQuery: UseQueryResult<PaginatedGoodsResponse, Error> =
    useMemo(() => {
      const { isCreating, mode, lockedPartnerIds } = documentCreationState;

      if (!isCreating) {
        return normalGoodsQuery;
      }

      switch (mode) {
        // This is the flow we are fixing (J -> D -> P -> G)
        case "INTERSECT_FROM_PARTNER":
          // If 1 partner is selected, show all their goods.
          if (lockedPartnerIds.length === 1) {
            return goodsForSinglePartnerQuery;
          }
          // If 2 or more partners are selected, show the intersection.
          if (lockedPartnerIds.length > 1) {
            return intersectionGoodsQuery;
          }
          // If 0 partners are selected, show nothing.
          return { data: { data: [], total: 0 }, status: "success" } as any;

        // This flow (J -> P -> D -> G) correctly uses the single partner query.
        case "LOCK_PARTNER":
          return goodsForSinglePartnerQuery;

        // In these modes, the Goods slider is the *source* of the selection.
        case "INTERSECT_FROM_GOOD":
        case "LOCK_GOOD":
        case "SINGLE_ITEM":
          return normalGoodsQuery;

        default:
          return { data: { data: [], total: 0 }, status: "success" } as any;
      }
    }, [
      documentCreationState,
      normalGoodsQuery,
      goodsForSinglePartnerQuery, // Renamed from documentContextQuery for clarity
      intersectionGoodsQuery,
    ]);

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
