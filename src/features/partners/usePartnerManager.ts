//src/features/partners/usePartnerManager.ts
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
import { SLIDER_TYPES, ROOT_JOURNAL_ID } from "@/lib/constants"; // ✅ ADD ROOT_JOURNAL_ID
import { getFirstId } from "@/lib/helpers";
import {
  fetchPartners,
  createPartner,
  updatePartner,
  deletePartner,
  getPartnersForGoods,
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

  // ✅ --- START: COPIED LOGIC FROM useGoodManager ---
  // This is the key fix. It correctly determines the most specific journal ID for the current context.
  const activeJournalIdForIntersection = useMemo(() => {
    const { journal } = selections;

    // In creation mode, we need the SINGLE most specific terminal journal ID.
    if (documentCreationState.isCreating) {
      if (journal.level3Ids.length > 0) {
        // NOTE: This assumes we operate on the first L3 selection if multiple are possible.
        // Adjust if business logic requires handling multiple L3s differently.
        return journal.level3Ids[0];
      }
      if (journal.level2Ids.length > 0) {
        return journal.level2Ids[0];
      }
      if (journal.flatId) {
        return journal.flatId;
      }
      // Fallback to the top-level journal if no deeper selection is made.
      return journal.topLevelId;
    }

    // Return null when not in creation mode, as this logic is only for intersection queries.
    return null;
  }, [selections.journal, documentCreationState.isCreating]);
  // ✅ --- END: COPIED LOGIC ---

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
  const normalPartnerQueryParams = useMemo((): FetchPartnersParams => {
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

  const normalPartnerQuery = useQuery({
    queryKey: partnerKeys.list(normalPartnerQueryParams),
    queryFn: () => fetchPartners(normalPartnerQueryParams),
    enabled: !documentCreationState.isCreating,
  });

  const partnersForGoodsQuery = useQuery({
    queryKey: partnerKeys.list({
      forGoodsIntersection: documentCreationState.lockedGoodIds,
      journalId: activeJournalIdForIntersection,
    }),
    queryFn: () =>
      getPartnersForGoods(
        documentCreationState.lockedGoodIds,
        activeJournalIdForIntersection!
      ),
    enabled:
      documentCreationState.isCreating &&
      (documentCreationState.mode === "INTERSECT_FROM_GOOD" ||
        documentCreationState.mode === "LOCK_GOOD") &&
      documentCreationState.lockedGoodIds.length > 0 &&
      !!activeJournalIdForIntersection,
    staleTime: Infinity,
  });

  const activeQuery: UseQueryResult<PaginatedPartnersResponse, Error> =
    useMemo(() => {
      const { isCreating, mode } = documentCreationState;

      if (!isCreating) {
        return normalPartnerQuery;
      }

      switch (mode) {
        case "INTERSECT_FROM_GOOD":
        case "LOCK_GOOD":
          return partnersForGoodsQuery;

        case "LOCK_PARTNER":
        case "SINGLE_ITEM":
        case "INTERSECT_FROM_PARTNER":
          return normalPartnerQuery;

        default:
          return { data: { data: [], total: 0 }, status: "success" } as any;
      }
    }, [documentCreationState, normalPartnerQuery, partnersForGoodsQuery]);

  // --- (useEffect for selection, Mutations and Modal Handlers are unchanged) ---
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

  //... all mutations and handlers remain the same from here

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
