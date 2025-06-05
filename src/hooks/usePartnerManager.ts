// src/hooks/usePartnerManager.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchPartners,
  createPartner,
  updatePartner,
  deletePartner,
} from "@/services/clientPartnerService";
import type {
  Partner,
  CreatePartnerClientData,
  UpdatePartnerClientData,
  FetchPartnersParams,
} from "@/lib/types";
import { getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";

export interface UsePartnerManagerProps {
  sliderOrder: string[];
  visibility: { [key: string]: boolean };
  effectiveSelectedJournalIds: string[];
  selectedGoodsId: string | null; // This is crossFilterSelectedGoodsId from page.tsx
  selectedJournalIdForGjpFiltering: string | null;
  journalRootFilterStatus: "affected" | "unaffected" | "all" | null;
  isJournalHierarchyLoading: boolean;
  isFlatJournalsQueryForGoodLoading: boolean; // This is isGoodsDataLoading from page.tsx
  isGPGOrderActive?: boolean;
  gpgContextJournalId?: string | null;
}

export const usePartnerManager = (props: UsePartnerManagerProps) => {
  const {
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds,
    selectedGoodsId, // Used for J-G-P (S3)
    selectedJournalIdForGjpFiltering, // Used for G-J-P (S3)
    journalRootFilterStatus,
    isJournalHierarchyLoading, // S1 Journal loading state
    isFlatJournalsQueryForGoodLoading, // S2 Good loading state (for J-G-P) / S2 Journal loading state (for G-J-P)
    isGPGOrderActive,
    gpgContextJournalId,
  } = props;

  const queryClient = useQueryClient();
  // ... (other state variables remain the same)
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    null
  );
  const [isPartnerOptionsMenuOpen, setIsPartnerOptionsMenuOpen] =
    useState(false);
  const [partnerOptionsMenuAnchorEl, setPartnerOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditPartnerModalOpen, setIsAddEditPartnerModalOpen] =
    useState(false);
  const [editingPartnerData, setEditingPartnerData] = useState<Partner | null>(
    null
  );

  const partnerQueryKeyParamsStructure = useMemo((): FetchPartnersParams => {
    const orderString = sliderOrder.join("-");
    let params: FetchPartnersParams = { limit: 1000, offset: 0 };
    const partnerIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);

    console.log(
      `[usePartnerManager] Recalculating partnerQueryKeyParams. Order: ${orderString}, Journal IDs: ${effectiveSelectedJournalIds.join(
        ","
      )}, Good ID: ${selectedGoodsId}, GJP Journal ID: ${selectedJournalIdForGjpFiltering}`
    );

    if (isGPGOrderActive && partnerIndex === 1) {
      if (gpgContextJournalId) {
        params.linkedToJournalIds = [gpgContextJournalId];
        params.includeChildren = false;
      } else {
        params.linkedToJournalIds = ["__NO_GPG_CONTEXT_JOURNAL__"];
      }
    } else if (partnerIndex === 0) {
      // Default params when Partner is first
    } else if (
      orderString.startsWith(SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.PARTNER) // J-P (Partner S2)
    ) {
      params.filterStatus = journalRootFilterStatus;
      params.contextJournalIds = [...effectiveSelectedJournalIds];
    } else if (
      orderString.startsWith(
        SLIDER_TYPES.JOURNAL +
          "-" +
          SLIDER_TYPES.GOODS +
          "-" +
          SLIDER_TYPES.PARTNER // J-G-P (Partner S3)
      )
    ) {
      if (effectiveSelectedJournalIds.length > 0 && selectedGoodsId) {
        params.linkedToJournalIds = [...effectiveSelectedJournalIds];
        params.linkedToGoodId = selectedGoodsId;
        params.includeChildren = true; // Journal is primary
        console.log(
          `[usePartnerManager] J-G-P params: linkedToJournalIds=${effectiveSelectedJournalIds.join(
            ","
          )}, linkedToGoodId=${selectedGoodsId}`
        );
      } else {
        console.log(
          `[usePartnerManager] J-G-P context missing. Params will lead to empty queryFn result.`
        );
        // queryFn will handle this by checking if params are incomplete
      }
    } else if (
      orderString.startsWith(
        SLIDER_TYPES.GOODS +
          "-" +
          SLIDER_TYPES.JOURNAL +
          "-" +
          SLIDER_TYPES.PARTNER // G-J-P (Partner S3)
      )
    ) {
      if (selectedGoodsId && selectedJournalIdForGjpFiltering) {
        params.linkedToJournalIds = [selectedJournalIdForGjpFiltering];
        params.linkedToGoodId = selectedGoodsId;
        params.includeChildren = false; // Journal is secondary
        console.log(
          `[usePartnerManager] G-J-P params: linkedToJournalIds=${selectedJournalIdForGjpFiltering}, linkedToGoodId=${selectedGoodsId}`
        );
      } else {
        console.log(
          `[usePartnerManager] G-J-P context missing. Params will lead to empty queryFn result.`
        );
        // queryFn will handle this
      }
    }
    return params;
  }, [
    sliderOrder,
    effectiveSelectedJournalIds,
    selectedGoodsId, // Key for J-G-P
    selectedJournalIdForGjpFiltering, // Key for G-J-P
    journalRootFilterStatus,
    isGPGOrderActive,
    gpgContextJournalId,
  ]);

  const partnerQueryKey = useMemo(
    () => ["partners", partnerQueryKeyParamsStructure],
    [partnerQueryKeyParamsStructure]
  );

  const partnerQuery = useQuery<Partner[], Error>({
    queryKey: partnerQueryKey,
    queryFn: async (): Promise<Partner[]> => {
      const params = partnerQueryKeyParamsStructure; // Already calculated
      const currentOrderString = sliderOrder.join("-");
      console.log(
        `[usePartnerManager partnerQuery.queryFn] Attempting to fetch. Order: ${currentOrderString}, Params:`,
        JSON.stringify(params)
      );

      if (params.linkedToJournalIds?.includes("__NO_GPG_CONTEXT_JOURNAL__")) {
        console.log(
          "[usePartnerManager partnerQuery.queryFn] GPG active, but no context journal. Returning []."
        );
        return [];
      }
      // Check for J-G-P incomplete context
      if (
        currentOrderString.startsWith(
          SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.GOODS +
            "-" +
            SLIDER_TYPES.PARTNER
        ) &&
        (!params.linkedToGoodId ||
          !params.linkedToJournalIds ||
          params.linkedToJournalIds.length === 0)
      ) {
        console.log(
          "[usePartnerManager partnerQuery.queryFn] J-G-P, but missing good or journal in params. Returning []."
        );
        return [];
      }
      // Check for G-J-P incomplete context
      if (
        currentOrderString.startsWith(
          SLIDER_TYPES.GOODS +
            "-" +
            SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.PARTNER
        ) &&
        (!params.linkedToGoodId ||
          !params.linkedToJournalIds ||
          params.linkedToJournalIds.length === 0)
      ) {
        console.log(
          "[usePartnerManager partnerQuery.queryFn] G-J-P, but missing good or journal in params. Returning []."
        );
        return [];
      }

      const result = await fetchPartners(params);
      console.log(
        `[usePartnerManager partnerQuery.queryFn] Fetched ${result.data.length} partners.`
      );
      return result.data.map((p: any) => ({ ...p, id: String(p.id) }));
    },
    enabled: (() => {
      if (!visibility[SLIDER_TYPES.PARTNER]) {
        // console.log("[usePartnerManager enabled] Partner slider not visible. Query disabled.");
        return false;
      }

      const partnerIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);
      const orderString = sliderOrder.join("-");
      let enableQuery = false;
      let reason = "";

      if (isGPGOrderActive && partnerIndex === 1) {
        // G-P context (Partner S2)
        enableQuery = !!gpgContextJournalId;
        reason = `G-P (S2): GPG Context Journal Selected: ${!!gpgContextJournalId}`;
      } else if (partnerIndex === 0) {
        // P, P-J, P-G
        enableQuery = true;
        reason = "Partner is S1";
      } else if (
        orderString.startsWith(
          SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.PARTNER
        )
      ) {
        // J-P (Partner S2)
        enableQuery = !isJournalHierarchyLoading;
        reason = `J-P (S2): S1 Journal Loading: ${isJournalHierarchyLoading}`;
      } else if (
        orderString.startsWith(
          SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.GOODS +
            "-" +
            SLIDER_TYPES.PARTNER
        )
      ) {
        // J-G-P (Partner S3)
        enableQuery =
          effectiveSelectedJournalIds.length > 0 && // S1 Journal selected
          !!selectedGoodsId && // S2 Good selected
          !isJournalHierarchyLoading && // S1 not loading
          !isFlatJournalsQueryForGoodLoading; // S2 Good is not loading (prop holds good's loading state)
        reason = `J-G-P (S3): S1 Journal Sel: ${
          effectiveSelectedJournalIds.length > 0
        }, S2 Good Sel: ${!!selectedGoodsId}, S1 Load: ${isJournalHierarchyLoading}, S2 Load: ${isFlatJournalsQueryForGoodLoading}`;
      } else if (
        orderString.startsWith(
          SLIDER_TYPES.GOODS +
            "-" +
            SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.PARTNER
        )
      ) {
        // G-J-P (Partner S3)
        enableQuery =
          !!selectedGoodsId && // S1 Good selected
          !!selectedJournalIdForGjpFiltering && // S2 Journal selected
          !isFlatJournalsQueryForGoodLoading && // S1 Good not loading (isFlatJournalsQueryForGoodLoading holds S1 good loading if G is first)
          // AND S2 Journal not loading. This prop name is overloaded.
          // For G-J-P, isFlatJournalsQueryForGoodLoading is isGoodsDataLoading.
          // We also need S2 Journal loading state (isFlatJournalsQueryLoading in page.tsx for this specific case?)
          // The `isFlatJournalsQueryForGoodLoading` passed to usePartnerManager is indeed `isGoodsDataLoading`.
          // For S2 Journal loading in G-J-P, that's `flatJournalsQueryForGood.isLoading` in page.tsx, which is passed as `isFlatJournalsQueryForGoodLoading` to THIS hook. This is okay.
          !props.isFlatJournalsQueryForGoodLoading; // This is correct based on page.tsx prop mapping for isGoodsDataLoading
        reason = `G-J-P (S3): S1 Good Sel: ${!!selectedGoodsId}, S2 Journal Sel: ${!!selectedJournalIdForGjpFiltering}, S1/S2 Load check via isFlatJournalsQueryForGoodLoading: ${isFlatJournalsQueryForGoodLoading}`;
      } else {
        reason = "Order not matched for enabling partner query";
      }

      // console.log(`[usePartnerManager enabled] Evaluation for order "${orderString}": ${enableQuery}. Reason: ${reason}`);
      return enableQuery;
    })(),
  });
  // ... (rest of the hook: useMemo for partnersForSlider, mutations, useEffect, callbacks)
  // Ensure they use partnerQuery.

  const partnersForSlider = useMemo(
    () => partnerQuery.data || [],
    [partnerQuery.data]
  );

  const createPartnerMutation = useMutation<
    Partner,
    Error,
    CreatePartnerClientData
  >({
    mutationFn: createPartner,
    onSuccess: (newPartner) => {
      queryClient.invalidateQueries({ queryKey: partnerQueryKey });
      setIsAddEditPartnerModalOpen(false);
      setEditingPartnerData(null);
      alert(`Partner '${newPartner.name}' created successfully!`);
      setSelectedPartnerId(String(newPartner.id));
    },
    onError: (error: Error) => {
      console.error("Failed to create partner:", error);
      alert(`Error creating partner: ${error.message}`);
    },
  });

  const updatePartnerMutation = useMutation<
    Partner,
    Error,
    { id: string; data: UpdatePartnerClientData }
  >({
    mutationFn: (variables) => updatePartner(variables.id, variables.data),
    onSuccess: (updatedPartner) => {
      queryClient.invalidateQueries({ queryKey: partnerQueryKey });
      setIsAddEditPartnerModalOpen(false);
      setEditingPartnerData(null);
      alert(`Partner '${updatedPartner.name}' updated successfully!`);
    },
    onError: (error: Error) => {
      console.error("Failed to update partner:", error);
      alert(`Error updating partner: ${error.message}`);
    },
  });

  const deletePartnerMutation = useMutation<{ message: string }, Error, string>(
    {
      mutationFn: deletePartner,
      onSuccess: (response, deletedPartnerId) => {
        queryClient.invalidateQueries({ queryKey: partnerQueryKey });
        alert(
          response.message ||
            `Partner ${deletedPartnerId} deleted successfully!`
        );
        if (selectedPartnerId === deletedPartnerId) {
          setSelectedPartnerId(null);
        }
      },
      onError: (error: Error, deletedPartnerId) => {
        console.error(`Failed to delete partner ${deletedPartnerId}:`, error);
        alert(`Error deleting partner: ${error.message}`);
      },
    }
  );

  useEffect(() => {
    if (isGPGOrderActive) {
      // Handled by page.tsx and subsequent data refetch/auto-selection
    }
  }, [isGPGOrderActive, gpgContextJournalId, partnerQuery.data]);

  useEffect(() => {
    if (partnerQuery.isSuccess && partnerQuery.data) {
      const fetchedPartners = partnerQuery.data;
      const currentSelectionInList =
        selectedPartnerId &&
        fetchedPartners.some((p) => p.id === selectedPartnerId);
      if (fetchedPartners.length > 0 && !currentSelectionInList) {
        setSelectedPartnerId(getFirstId(fetchedPartners));
      } else if (fetchedPartners.length === 0 && selectedPartnerId !== null) {
        setSelectedPartnerId(null);
      }
    } else if (
      !partnerQuery.isLoading &&
      !partnerQuery.isFetching &&
      !partnerQuery.isError &&
      selectedPartnerId !== null
    ) {
      if (!partnerQuery.data || partnerQuery.data.length === 0) {
        setSelectedPartnerId(null);
      }
    }
  }, [
    partnerQuery.data,
    partnerQuery.isSuccess,
    partnerQuery.isLoading,
    partnerQuery.isFetching,
    partnerQuery.isError,
    selectedPartnerId,
  ]);

  const handleOpenPartnerOptionsMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setPartnerOptionsMenuAnchorEl(event.currentTarget);
      setIsPartnerOptionsMenuOpen(true);
    },
    []
  );

  const handleClosePartnerOptionsMenu = useCallback(() => {
    setIsPartnerOptionsMenuOpen(false);
    setPartnerOptionsMenuAnchorEl(null);
  }, []);

  const handleOpenAddPartnerModal = useCallback(() => {
    setEditingPartnerData(null);
    setIsAddEditPartnerModalOpen(true);
    handleClosePartnerOptionsMenu();
  }, [handleClosePartnerOptionsMenu]);

  const handleOpenEditPartnerModal = useCallback(() => {
    if (selectedPartnerId && partnerQuery.data) {
      const partnerToEdit = partnerQuery.data.find(
        (p) => p.id === selectedPartnerId
      );
      if (partnerToEdit) {
        setEditingPartnerData(partnerToEdit);
        setIsAddEditPartnerModalOpen(true);
      } else {
        alert("Selected partner data not found.");
      }
    }
    handleClosePartnerOptionsMenu();
  }, [selectedPartnerId, partnerQuery.data, handleClosePartnerOptionsMenu]);

  const handleCloseAddEditPartnerModal = useCallback(() => {
    setIsAddEditPartnerModalOpen(false);
    setEditingPartnerData(null);
  }, []);

  const handleAddOrUpdatePartnerSubmit = useCallback(
    (
      dataFromModal: CreatePartnerClientData | UpdatePartnerClientData,
      partnerIdToUpdate?: string
    ) => {
      if (partnerIdToUpdate && editingPartnerData) {
        const payloadForUpdate: UpdatePartnerClientData = {
          name: dataFromModal.name,
          notes: dataFromModal.notes,
          logoUrl: (dataFromModal as any).logoUrl,
          photoUrl: (dataFromModal as any).photoUrl,
          isUs: (dataFromModal as any).isUs,
          registrationNumber: (dataFromModal as any).registrationNumber,
          taxId: (dataFromModal as any).taxId,
          bioFatherName: (dataFromModal as any).bioFatherName,
          bioMotherName: (dataFromModal as any).bioMotherName,
          additionalDetails: (dataFromModal as any).additionalDetails,
        };
        Object.keys(payloadForUpdate).forEach((keyStr) => {
          const key = keyStr as keyof UpdatePartnerClientData;
          if (payloadForUpdate[key] === undefined) {
            delete payloadForUpdate[key];
          }
        });
        if (Object.keys(payloadForUpdate).length === 0) {
          alert("No changes detected to save.");
          setIsAddEditPartnerModalOpen(false);
          setEditingPartnerData(null);
          return;
        }
        updatePartnerMutation.mutate({
          id: partnerIdToUpdate,
          data: payloadForUpdate,
        });
      } else {
        createPartnerMutation.mutate(dataFromModal as CreatePartnerClientData);
      }
    },
    [editingPartnerData, createPartnerMutation, updatePartnerMutation]
  );

  const handleDeleteCurrentPartner = useCallback(() => {
    if (selectedPartnerId) {
      if (
        window.confirm(
          `Are you sure you want to delete partner ${selectedPartnerId}? This might affect related documents or links.`
        )
      ) {
        deletePartnerMutation.mutate(selectedPartnerId);
      }
    }
    handleClosePartnerOptionsMenu();
  }, [selectedPartnerId, deletePartnerMutation, handleClosePartnerOptionsMenu]);

  return {
    selectedPartnerId,
    setSelectedPartnerId,
    isPartnerOptionsMenuOpen,
    partnerOptionsMenuAnchorEl,
    isAddEditPartnerModalOpen,
    editingPartnerData,
    partnersForSlider,
    partnerQuery,
    partnerQueryKey,
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
