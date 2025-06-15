// src/hooks/useJournalPartnerGoodLinking.ts
"use client";

import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  journalKeys,
  jpgLinkKeys,
  goodKeys,
  partnerKeys,
} from "@/lib/queryKeys";

import {
  createJournalPartnerGoodLink,
  deleteJournalPartnerGoodLink,
  fetchJpgLinksForGoodAndJournalContext,
} from "@/services/clientJournalPartnerGoodLinkService";
import { fetchPartnersLinkedToJournals } from "@/services/clientPartnerService";
import { fetchGoodById } from "@/services/clientGoodService";
import { fetchJournalHierarchy } from "@/services/clientJournalService";
import { findNodeById } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";
import { useAppStore } from "@/store/appStore";

import type {
  Good,
  Partner,
  AccountNodeData,
  CreateJournalPartnerGoodLinkClientData,
  JournalPartnerGoodLinkClient,
} from "@/lib/types";

// No props needed. The hook is self-contained.
export const useJournalPartnerGoodLinking = () => {
  const queryClient = useQueryClient();

  // Consume state from the global store
  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const selections = useAppStore((state) => state.selections);
  const restrictedJournalId = useAppStore(
    (state) => state.auth.effectiveRestrictedJournalId
  );

  // Destructure selections for easier access
  const { goods: selectedGoodsId, journal: journalSelections } = selections;

  // Fetch the journal hierarchy data using a simplified query key
  const { data: hierarchyData } = useQuery<AccountNodeData[], Error>({
    queryKey: journalKeys.hierarchy(restrictedJournalId),
    queryFn: () => fetchJournalHierarchy(restrictedJournalId),
    staleTime: Infinity,
  });
  const safeHierarchyData = useMemo(() => hierarchyData || [], [hierarchyData]);

  // Derive effective journal IDs inside the hook
  const effectiveSelectedJournalIds = useMemo(() => {
    const ids = new Set<string>();
    if (journalSelections.topLevelId) ids.add(journalSelections.topLevelId);
    journalSelections.level2Ids.forEach((id) => ids.add(id));
    journalSelections.level3Ids.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [journalSelections]);

  // Local state for modals
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [goodForJpgLinking, setGoodForJpgLinking] = useState<Good | null>(null);
  const [targetJournalForJpgLinking, setTargetJournalForJpgLinking] =
    useState<AccountNodeData | null>(null);

  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [goodForUnlinkingContext, setGoodForUnlinkingContext] =
    useState<Good | null>(null);
  const [journalForUnlinkingContext, setJournalForUnlinkingContext] =
    useState<AccountNodeData | null>(null);

  // Fetch partners for the "Link Good to Partners via Journal" modal
  const { data: partnersForJpgModal, isLoading: isLoadingPartnersForJpgModal } =
    useQuery<Partner[], Error>({
      queryKey: jpgLinkKeys.partnersForJpgModal(
        targetJournalForJpgLinking?.id ?? null
      ),
      queryFn: () =>
        fetchPartnersLinkedToJournals([targetJournalForJpgLinking!.id], false),
      enabled: !!targetJournalForJpgLinking && isLinkModalOpen,
    });

  // Fetch existing JPGLs for the "Unlink Good from Partners via Journal" modal
  const {
    data: existingJpgLinksForModal,
    isLoading: isLoadingJpgLinksForModal,
  } = useQuery<JournalPartnerGoodLinkClient[], Error>({
    queryKey: jpgLinkKeys.listForContext(
      goodForUnlinkingContext?.id ?? "",
      journalForUnlinkingContext?.id ?? ""
    ),
    queryFn: () =>
      fetchJpgLinksForGoodAndJournalContext(
        goodForUnlinkingContext!.id,
        journalForUnlinkingContext!.id
      ),
    enabled:
      !!goodForUnlinkingContext &&
      !!journalForUnlinkingContext &&
      isUnlinkModalOpen,
  });

  const createJPGLMutation = useMutation<
    JournalPartnerGoodLinkClient,
    Error,
    CreateJournalPartnerGoodLinkClientData
  >({
    mutationFn: createJournalPartnerGoodLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goodKeys.all });
      queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      queryClient.invalidateQueries({ queryKey: jpgLinkKeys.all });
    },
    onError: (error: Error) => {
      console.error("Failed to create 3-way link:", error);
      alert(`Error creating 3-way link: ${error.message}`);
    },
  });

  const deleteJPGLMutation = useMutation<{ message: string }, Error, string>({
    mutationFn: deleteJournalPartnerGoodLink,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: jpgLinkKeys.listForContext(
          goodForUnlinkingContext!.id,
          journalForUnlinkingContext!.id
        ),
      });
    },
    onError: (error: Error, linkId) => {
      console.error(`Failed to delete 3-way link ${linkId}:`, error);
      alert(`Error unlinking 3-way link: ${error.message}`);
    },
  });

  const openLinkModal = useCallback(async () => {
    if (!selectedGoodsId) {
      alert("Please select a Good first.");
      return;
    }
    const targetJournalNodeId =
      effectiveSelectedJournalIds.length > 0
        ? effectiveSelectedJournalIds[0]
        : null;
    if (!targetJournalNodeId) {
      alert("No active Journal context found to link with.");
      return;
    }

    const good = await queryClient.fetchQuery<Good>({
      queryKey: goodKeys.detail(selectedGoodsId),
      queryFn: () => fetchGoodById(selectedGoodsId),
    });
    const targetJournalNode = findNodeById(
      safeHierarchyData,
      targetJournalNodeId
    );

    if (!good || !targetJournalNode) {
      alert("Could not retrieve details for the selected Good or Journal.");
      return;
    }

    setGoodForJpgLinking(good);
    setTargetJournalForJpgLinking(targetJournalNode);
    setIsLinkModalOpen(true);
  }, [
    selectedGoodsId,
    effectiveSelectedJournalIds,
    safeHierarchyData,
    queryClient,
  ]);

  const closeLinkModal = useCallback(() => {
    setIsLinkModalOpen(false);
    setGoodForJpgLinking(null);
    setTargetJournalForJpgLinking(null);
  }, []);

  const submitLinks = useCallback(
    async (linksData: CreateJournalPartnerGoodLinkClientData[]) => {
      if (linksData.length === 0) {
        closeLinkModal();
        return;
      }
      const promises = linksData.map((linkData) =>
        createJPGLMutation.mutateAsync(linkData)
      );
      await Promise.allSettled(promises);
      closeLinkModal();
    },
    [createJPGLMutation, closeLinkModal]
  );

  const openUnlinkModal = useCallback(async () => {
    if (!selectedGoodsId) {
      alert("Please select a Good first.");
      return;
    }

    let contextJournalId: string | null = null;
    if (sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 0) {
      contextJournalId =
        effectiveSelectedJournalIds.length > 0
          ? effectiveSelectedJournalIds[0]
          : null;
    } else if (
      sliderOrder.indexOf(SLIDER_TYPES.PARTNER) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1
    ) {
      contextJournalId = journalSelections.flatId;
    }

    if (!contextJournalId) {
      alert("No active Journal context found to determine links.");
      return;
    }

    const good = await queryClient.fetchQuery<Good>({
      queryKey: goodKeys.detail(selectedGoodsId),
      queryFn: () => fetchGoodById(selectedGoodsId),
    });
    const journalNode = findNodeById(safeHierarchyData, contextJournalId);

    if (!good || !journalNode) {
      alert(
        "Could not retrieve details for the selected Good or Journal context."
      );
      return;
    }

    setGoodForUnlinkingContext(good);
    setJournalForUnlinkingContext(journalNode);
    setIsUnlinkModalOpen(true);
  }, [
    selectedGoodsId,
    sliderOrder,
    effectiveSelectedJournalIds,
    journalSelections.flatId,
    safeHierarchyData,
    queryClient,
  ]);

  const closeUnlinkModal = useCallback(() => {
    setIsUnlinkModalOpen(false);
    setGoodForUnlinkingContext(null);
    setJournalForUnlinkingContext(null);
  }, []);

  const submitUnlink = useCallback(
    async (linkIdsToUnlink: string[]) => {
      if (linkIdsToUnlink.length === 0) {
        closeUnlinkModal();
        return;
      }
      const promises = linkIdsToUnlink.map((linkId) =>
        deleteJPGLMutation.mutateAsync(linkId)
      );
      await Promise.allSettled(promises);
      closeUnlinkModal();
    },
    [deleteJPGLMutation, closeUnlinkModal]
  );

  const createSimpleJPGL = useCallback(
    (linkData: CreateJournalPartnerGoodLinkClientData) => {
      if (!linkData.journalId || !linkData.partnerId || !linkData.goodId) {
        alert("Missing required information to create the link.");
        return;
      }
      createJPGLMutation.mutate(linkData, {
        onSuccess: () => alert(`Direct link created successfully.`),
      });
    },
    [createJPGLMutation]
  );

  return {
    isLinkModalOpen,
    goodForJpgLinking,
    targetJournalForJpgLinking,
    partnersForJpgModal: partnersForJpgModal || [],
    isLoadingPartnersForJpgModal,
    isSubmittingLinkJPGL: createJPGLMutation.isPending,
    openLinkModal,
    closeLinkModal,
    submitLinks,
    isUnlinkModalOpen,
    goodForUnlinkingContext,
    journalForUnlinkingContext,
    existingJpgLinksForModal: existingJpgLinksForModal || [],
    isLoadingJpgLinksForModal,
    isSubmittingUnlinkJPGL: deleteJPGLMutation.isPending,
    openUnlinkModal,
    closeUnlinkModal,
    submitUnlink,
    createSimpleJPGL,
  };
};
