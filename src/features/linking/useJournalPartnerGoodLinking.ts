"use client";

import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  journalKeys,
  jpgLinkKeys,
  goodKeys,
  partnerKeys,
} from "@/lib/queryKeys";
import { useToast } from "@/contexts/ToastContext";

// ✅ CHANGED: Imports now use the correct function names from the provided service files.
import {
  createJournalPartnerGoodLink,
  deleteJournalPartnerGoodLinkById,
  getJournalPartnerGoodLinks,
} from "@/services/clientJournalPartnerGoodLinkService";
import { fetchPartners } from "@/services/clientPartnerService"; // Corrected from getAllPartners
import { fetchGoodById } from "@/services/clientGoodService";
import { fetchJournalHierarchy } from "@/services/clientJournalService"; // Corrected from getJournalSubHierarchy
import { findNodeById } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";
import { useAppStore } from "@/store/appStore";

// Types are correctly imported from their new, structured source files.
import {
  GoodClient,
  PartnerClient,
  JournalPartnerGoodLinkClient,
} from "@/lib/types/models.client";
import { AccountNodeData } from "@/lib/types/ui";
import { CreateJournalPartnerGoodLinkPayload } from "@/lib/schemas/journalPartnerGoodLink.schema";
import { PaginatedPartnersResponse } from "@/services/clientPartnerService"; // Import the paginated type

// No props needed. The hook is self-contained.
export const useJournalPartnerGoodLinking = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  // Consume state from the global store
  const sliderOrder = useAppStore((state) => state.sliderOrder);
  const selections = useAppStore((state) => state.selections);
  const restrictedJournalId = useAppStore(
    (state) => state.effectiveRestrictedJournalId
  );

  const { good: selectedGoodId, journal: journalSelections } = selections;

  // ✅ CHANGED: Uses the correct `fetchJournalHierarchy` service function.
  const { data: hierarchyData } = useQuery<AccountNodeData[], Error>({
    queryKey: journalKeys.hierarchy(restrictedJournalId),
    queryFn: () => fetchJournalHierarchy(restrictedJournalId),
    staleTime: Infinity,
  });
  const safeHierarchyData = useMemo(() => hierarchyData || [], [hierarchyData]);

  const effectiveSelectedJournalIds = useMemo(() => {
    return selections.effectiveJournalIds;
  }, [selections.effectiveJournalIds]);

  // Local state uses the robust '...Client' types.
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [goodForJpgLinking, setGoodForJpgLinking] = useState<GoodClient | null>(
    null
  );
  const [targetJournalForJpgLinking, setTargetJournalForJpgLinking] =
    useState<AccountNodeData | null>(null);

  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [goodForUnlinkingContext, setGoodForUnlinkingContext] =
    useState<GoodClient | null>(null);
  const [journalForUnlinkingContext, setJournalForUnlinkingContext] =
    useState<AccountNodeData | null>(null);

  // ✅ CHANGED: Uses the correct `fetchPartners` service and the PaginatedPartnersResponse type.
  const { data: partnersResponse, isLoading: isLoadingPartnersForJpgModal } =
    useQuery<PaginatedPartnersResponse, Error>({
      queryKey: jpgLinkKeys.partnersForJpgModal(
        targetJournalForJpgLinking?.id ?? null
      ),
      queryFn: () =>
        fetchPartners({
          selectedJournalIds: [targetJournalForJpgLinking!.id],
          filterMode: "affected",
        }),
      enabled: !!targetJournalForJpgLinking && isLinkModalOpen,
    });

  // This query is correct as its service was already updated.
  const {
    data: existingJpgLinksForModal,
    isLoading: isLoadingJpgLinksForModal,
  } = useQuery<JournalPartnerGoodLinkClient[], Error>({
    queryKey: jpgLinkKeys.listForContext(
      goodForUnlinkingContext?.id ?? "",
      journalForUnlinkingContext?.id ?? ""
    ),
    queryFn: () =>
      getJournalPartnerGoodLinks({
        goodId: goodForUnlinkingContext!.id,
        journalId: journalForUnlinkingContext!.id,
      }),
    enabled:
      !!goodForUnlinkingContext &&
      !!journalForUnlinkingContext &&
      isUnlinkModalOpen,
  });

  // All mutations and other logic below this point were already correct and do not
  // need to be changed, as they interact with the correct JPGL service or use
  // data that is now correctly fetched by the updated useQuery hooks.

  const createJPGLMutation = useMutation<
    JournalPartnerGoodLinkClient,
    Error,
    CreateJournalPartnerGoodLinkPayload
  >({
    mutationFn: createJournalPartnerGoodLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goodKeys.all });
      queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      queryClient.invalidateQueries({ queryKey: jpgLinkKeys.all });
      success("3-Way Link Created", "Journal-Partner-Good relationship has been created successfully.");
    },
    onError: (err: Error) => {
      error("Link Failed", err.message || "Failed to create 3-way link. Please try again.");
    },
  });

  const deleteJPGLMutation = useMutation<void, Error, string>({
    mutationFn: deleteJournalPartnerGoodLinkById,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: jpgLinkKeys.listForContext(
          goodForUnlinkingContext!.id,
          journalForUnlinkingContext!.id
        ),
      });
      success("3-Way Link Removed", "Journal-Partner-Good relationship has been removed successfully.");
    },
    onError: (err: Error) => {
      error("Unlink Failed", err.message || "Failed to remove 3-way link. Please try again.");
    },
  });

  const openLinkModal = useCallback(async () => {
    if (!selectedGoodId) {
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

    const good = await queryClient.fetchQuery<GoodClient>({
      queryKey: goodKeys.detail(selectedGoodId),
      queryFn: () => fetchGoodById(selectedGoodId),
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
    selectedGoodId,
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
    async (linksData: CreateJournalPartnerGoodLinkPayload[]) => {
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
    if (!selectedGoodId) {
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

    const good = await queryClient.fetchQuery<GoodClient>({
      queryKey: goodKeys.detail(selectedGoodId),
      queryFn: () => fetchGoodById(selectedGoodId),
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
    selectedGoodId,
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
    (linkData: CreateJournalPartnerGoodLinkPayload) => {
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
    partnersForJpgModal: partnersResponse?.data || [],
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
