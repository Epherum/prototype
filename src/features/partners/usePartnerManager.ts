// src/features/partners/usePartnerManager.ts
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
  type UseQueryResult,
} from "@tanstack/react-query";
import { partnerKeys } from "@/lib/queryKeys";
import { useAppStore } from "@/store/appStore";
import { SLIDER_TYPES } from "@/lib/constants";
import { getFirstId } from "@/lib/helpers";
import {
  fetchPartners,
  createPartner,
  updatePartner,
  deletePartner,
  fetchIntersectionOfPartners,
} from "@/services/clientPartnerService";
import { useJournalManager } from "@/features/journals/useJournalManager";
import type {
  Partner,
  CreatePartnerClientData,
  UpdatePartnerClientData,
  FetchPartnersParams,
  PaginatedPartnersResponse,
} from "@/lib/types";

export const usePartnerManager = () => {
  const queryClient = useQueryClient();

  const { sliderOrder, visibility, documentCreationState } = useAppStore(
    (state) => state.ui
  );
  const selections = useAppStore((state) => state.selections);
  const setSelection = useAppStore((state) => state.setSelection);
  const effectiveRestrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );

  const {
    journal: journalSelections,
    goods: selectedGoodsId,
    partner: selectedPartnerId,
  } = selections;

  const { effectiveSelectedJournalIds } = useJournalManager();
  const [isPartnerOptionsMenuOpen, setIsPartnerOptionsMenuOpen] =
    useState(false);
  const [partnerOptionsMenuAnchorEl, setPartnerOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditPartnerModalOpen, setIsAddEditPartnerModalOpen] =
    useState(false);
  const [editingPartnerData, setEditingPartnerData] = useState<Partner | null>(
    null
  );

  const setSelectedPartnerId = useCallback(
    (id: string | null) => {
      setSelection("partner", id);
    },
    [setSelection]
  );

  // === LOGGING: Let's see what this manager thinks the state is ===
  if (true) {
    console.groupCollapsed(`[DEBUG: usePartnerManager] Render/Update`);
    console.log(
      `Document Creation Mode: %c${documentCreationState.mode}`,
      "font-weight: bold;"
    );
    console.log(`isCreating: ${documentCreationState.isCreating}`);
    console.log(
      `Locked Goods: [${documentCreationState.lockedGoodIds.join(", ")}]`
    );
    console.log(`Locked Journal: ${documentCreationState.lockedJournalId}`);
    console.groupEnd();
  }
  // ===

  const normalPartnerQueryParams = useMemo((): FetchPartnersParams => {
    // ... (logic is unchanged) ...
    const visibleOrder = sliderOrder.filter((id) => visibility[id]);
    const partnerIndex = visibleOrder.indexOf(SLIDER_TYPES.PARTNER);
    if (partnerIndex === -1) return {};
    const journalIndex = visibleOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const goodsIndex = visibleOrder.indexOf(SLIDER_TYPES.GOODS);
    if (partnerIndex === 0)
      return { restrictedJournalId: effectiveRestrictedJournalId };
    if (
      journalIndex < partnerIndex &&
      goodsIndex < partnerIndex &&
      selectedGoodsId
    ) {
      return {
        linkedToJournalIds: effectiveSelectedJournalIds,
        linkedToGoodId: selectedGoodsId,
        restrictedJournalId: effectiveRestrictedJournalId,
      };
    }
    if (journalIndex < partnerIndex) {
      return {
        filterStatuses: journalSelections.rootFilter,
        contextJournalIds: journalSelections.rootFilter.includes("affected")
          ? effectiveSelectedJournalIds
          : [],
        restrictedJournalId: effectiveRestrictedJournalId,
      };
    }
    return {};
  }, [
    sliderOrder,
    visibility,
    journalSelections,
    selectedGoodsId,
    effectiveRestrictedJournalId,
    effectiveSelectedJournalIds,
  ]);

  const normalPartnerQueryEnabled =
    !documentCreationState.isCreating ||
    (documentCreationState.isCreating &&
      (documentCreationState.mode === "LOCK_PARTNER" ||
        documentCreationState.mode === "SINGLE_ITEM" ||
        documentCreationState.mode === "INTERSECT_FROM_PARTNER"));

  const normalPartnerQuery = useQuery({
    queryKey: partnerKeys.list(normalPartnerQueryParams),
    queryFn: () => fetchPartners(normalPartnerQueryParams),
    enabled: normalPartnerQueryEnabled,
  });

  const partnersForSingleGoodQuery = useQuery({
    queryKey: partnerKeys.list({
      linkedToGoodId: documentCreationState.lockedGoodIds[0],
      linkedToJournalIds: [documentCreationState.lockedJournalId!],
    }),
    queryFn: () =>
      fetchPartners({
        linkedToGoodId: documentCreationState.lockedGoodIds[0],
        linkedToJournalIds: [documentCreationState.lockedJournalId!],
      }),
    enabled:
      documentCreationState.isCreating &&
      // ✅ Enable this query in two scenarios:
      (documentCreationState.mode === "LOCK_GOOD" ||
        (documentCreationState.mode === "INTERSECT_FROM_GOOD" &&
          documentCreationState.lockedGoodIds.length === 1)) &&
      documentCreationState.lockedGoodIds.length > 0 && // Technically redundant due to the length check, but safe
      !!documentCreationState.lockedJournalId,
  });

  // 3. Query for the INTERSECTION of MULTIPLE selected goods (2 or more)
  const intersectionPartnersQuery = useQuery({
    queryKey: partnerKeys.list({
      forGoodsIntersection: documentCreationState.lockedGoodIds,
      journalId: documentCreationState.lockedJournalId,
    }),
    queryFn: () =>
      fetchIntersectionOfPartners(
        documentCreationState.lockedGoodIds,
        documentCreationState.lockedJournalId!
      ),
    // ✅ FIX: This query should ONLY be enabled when there are 2 OR MORE goods selected.
    enabled:
      documentCreationState.isCreating &&
      documentCreationState.mode === "INTERSECT_FROM_GOOD" &&
      documentCreationState.lockedGoodIds.length > 1 && // The key change is from `> 0` to `> 1`
      !!documentCreationState.lockedJournalId,
    staleTime: Infinity,
  });

  // === ACTIVE QUERY SELECTOR (THE CORE FIX) ===
  const activeQuery: UseQueryResult<PaginatedPartnersResponse, Error> =
    useMemo(() => {
      const { isCreating, mode, lockedGoodIds } = documentCreationState;

      if (!isCreating) {
        return normalPartnerQuery;
      }

      switch (mode) {
        // This is the flow we are fixing (J -> D -> G -> P)
        case "INTERSECT_FROM_GOOD":
          // If 1 good is selected, show all its partners.
          if (lockedGoodIds.length === 1) {
            return partnersForSingleGoodQuery;
          }
          // If 2 or more goods are selected, show the intersection.
          if (lockedGoodIds.length > 1) {
            return intersectionPartnersQuery;
          }
          // If 0 goods are selected, show nothing.
          return { data: { data: [], total: 0 }, status: "success" } as any;

        // This flow (J -> G -> D -> P) correctly uses the single good query.
        case "LOCK_GOOD":
          return partnersForSingleGoodQuery;

        // These other flows use the normal partner query logic.
        case "LOCK_PARTNER":
        case "SINGLE_ITEM":
        case "INTERSECT_FROM_PARTNER":
          return normalPartnerQuery;

        default:
          return { data: { data: [], total: 0 }, status: "success" } as any;
      }
    }, [
      documentCreationState,
      normalPartnerQuery,
      intersectionPartnersQuery,
      partnersForSingleGoodQuery, // Renamed from partnersForLockedGoodQuery for clarity
    ]);

  useEffect(() => {
    if (
      activeQuery.isSuccess &&
      activeQuery.data &&
      !documentCreationState.isCreating
    ) {
      const fetchedPartners = activeQuery.data.data;
      const currentSelectionInList =
        selectedPartnerId &&
        fetchedPartners.some((p) => String(p.id) === selectedPartnerId);

      if (fetchedPartners.length > 0 && !currentSelectionInList) {
        setSelectedPartnerId(getFirstId(fetchedPartners));
      } else if (fetchedPartners.length === 0 && selectedPartnerId !== null) {
        setSelectedPartnerId(null);
      }
    }
  }, [
    activeQuery.data,
    activeQuery.isSuccess,
    selectedPartnerId,
    setSelectedPartnerId,
    documentCreationState.isCreating,
  ]);

  // --- Mutations and Modal Handlers (unchanged) ---
  const createPartnerMutation = useMutation<
    Partner,
    Error,
    CreatePartnerClientData
  >({
    mutationFn: createPartner,
    onSuccess: (newPartner) => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      setIsAddEditPartnerModalOpen(false);
      alert(`Partner '${newPartner.name}' created successfully!`);
      setSelectedPartnerId(String(newPartner.id));
    },
  });
  const updatePartnerMutation = useMutation<
    Partner,
    Error,
    { id: string; data: UpdatePartnerClientData }
  >({
    mutationFn: (variables) => updatePartner(variables.id, variables.data),
    onSuccess: (updatedPartner) => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      setIsAddEditPartnerModalOpen(false);
      alert(`Partner '${updatedPartner.name}' updated successfully!`);
    },
  });
  const deletePartnerMutation = useMutation<{ message: string }, Error, string>(
    {
      mutationFn: deletePartner,
      onSuccess: (response, deletedPartnerId) => {
        queryClient.invalidateQueries({ queryKey: partnerKeys.all });
        alert(
          response.message ||
            `Partner ${deletedPartnerId} deleted successfully!`
        );
        if (selectedPartnerId === deletedPartnerId) setSelectedPartnerId(null);
      },
    }
  );

  const handleOpenPartnerOptionsMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setPartnerOptionsMenuAnchorEl(event.currentTarget);
      setIsPartnerOptionsMenuOpen(true);
    },
    []
  );
  const handleClosePartnerOptionsMenu = useCallback(
    () => setIsPartnerOptionsMenuOpen(false),
    []
  );
  const handleOpenAddPartnerModal = useCallback(() => {
    setEditingPartnerData(null);
    setIsAddEditPartnerModalOpen(true);
    handleClosePartnerOptionsMenu();
  }, [handleClosePartnerOptionsMenu]);
  const handleOpenEditPartnerModal = useCallback(() => {
    if (selectedPartnerId && activeQuery.data?.data) {
      const partnerToEdit = activeQuery.data.data.find(
        (p) => String(p.id) === selectedPartnerId
      );
      if (partnerToEdit) setEditingPartnerData(partnerToEdit);
    }
    setIsAddEditPartnerModalOpen(true);
    handleClosePartnerOptionsMenu();
  }, [selectedPartnerId, activeQuery.data, handleClosePartnerOptionsMenu]);
  const handleCloseAddEditPartnerModal = useCallback(
    () => setIsAddEditPartnerModalOpen(false),
    []
  );
  const handleAddOrUpdatePartnerSubmit = useCallback(
    (data: CreatePartnerClientData | UpdatePartnerClientData) => {
      if (editingPartnerData) {
        updatePartnerMutation.mutate({
          id: editingPartnerData.id,
          data: data as UpdatePartnerClientData,
        });
      } else {
        createPartnerMutation.mutate(data as CreatePartnerClientData);
      }
    },
    [editingPartnerData, createPartnerMutation, updatePartnerMutation]
  );
  const handleDeleteCurrentPartner = useCallback(() => {
    if (selectedPartnerId) deletePartnerMutation.mutate(selectedPartnerId);
    handleClosePartnerOptionsMenu();
  }, [selectedPartnerId, deletePartnerMutation, handleClosePartnerOptionsMenu]);

  return {
    selectedPartnerId,
    setSelectedPartnerId,
    partnersForSlider: activeQuery.data?.data || [],
    partnerQuery: activeQuery,
    isPartnerOptionsMenuOpen,
    partnerOptionsMenuAnchorEl,
    isAddEditPartnerModalOpen,
    editingPartnerData,
    createPartnerMutation,
    updatePartnerMutation,
    deletePartnerMutation,
    handleOpenPartnerOptionsMenu,
    handleClosePartnerOptionsMenu,
    handleOpenAddPartnerModal,
    handleOpenEditPartnerModal,
    handleCloseAddEditPartnerModal,
    handleAddOrUpdatePartnerSubmit,
    handleDeleteCurrentPartner,
  };
};
