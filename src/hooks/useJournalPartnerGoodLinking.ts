// src/hooks/useJournalPartnerGoodLinking.ts
import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createJournalPartnerGoodLink,
  deleteJournalPartnerGoodLink,
  fetchJpgLinksForGoodAndJournalContext,
} from "@/services/clientJournalPartnerGoodLinkService";
import { fetchPartnersLinkedToJournals } from "@/services/clientPartnerService"; // For LinkGoodToPartnersViaJournalModal
import { findNodeById } from "@/lib/helpers";
import { SLIDER_TYPES } from "@/lib/constants";
import type {
  Good,
  Partner,
  AccountNodeData,
  CreateJournalPartnerGoodLinkClientData,
  JournalPartnerGoodLinkClient,
  // FetchGoodsParams, // If needed for specific query key structure
} from "@/lib/types";

export interface UseJournalPartnerGoodLinkingProps {
  selectedGoodsId: string | null;
  goodsData: Good[] | undefined;
  effectiveSelectedJournalIds: string[];
  selectedJournalIdForPjgFiltering: string | null; // For P-J-G context
  currentHierarchy: AccountNodeData[] | undefined;
  sliderOrder: string[];
  // goodsQueryKeyParamsStructure: FetchGoodsParams | undefined; // For invalidating goods list
  // Props for determining canLink/canUnlink might be passed or calculated inside
}

export const useJournalPartnerGoodLinking = ({
  selectedGoodsId,
  goodsData,
  effectiveSelectedJournalIds,
  selectedJournalIdForPjgFiltering,
  currentHierarchy,
  sliderOrder,
}: // goodsQueryKeyParamsStructure,
UseJournalPartnerGoodLinkingProps) => {
  const queryClient = useQueryClient();

  // State for LinkGoodToPartnersViaJournalModal
  const [
    isLinkGoodToPartnersViaJournalModalOpen,
    setIsLinkGoodToPartnersViaJournalModalOpen,
  ] = useState(false);
  const [goodForJpgLinking, setGoodForJpgLinking] = useState<Good | null>(null);
  const [targetJournalForJpgLinking, setTargetJournalForJpgLinking] =
    useState<AccountNodeData | null>(null);
  const [partnersForJpgModal, setPartnersForJpgModal] = useState<Partner[]>([]);
  const [isLoadingPartnersForJpgModal, setIsLoadingPartnersForJpgModal] =
    useState(false);

  // State for UnlinkGoodFromPartnersViaJournalModal
  const [
    isUnlinkGoodFromPartnersViaJournalModalOpen,
    setIsUnlinkGoodFromPartnersViaJournalModalOpen,
  ] = useState(false);
  const [goodForUnlinkingContext, setGoodForUnlinkingContext] =
    useState<Good | null>(null);
  const [journalForUnlinkingContext, setJournalForUnlinkingContext] =
    useState<AccountNodeData | null>(null);
  const [existingJpgLinksForModal, setExistingJpgLinksForModal] = useState<
    JournalPartnerGoodLinkClient[]
  >([]);
  const [isLoadingJpgLinksForModal, setIsLoadingJpgLinksForModal] =
    useState(false);

  // Mutations
  const createJPGLMutation = useMutation<
    JournalPartnerGoodLinkClient,
    Error,
    CreateJournalPartnerGoodLinkClientData
  >({
    mutationFn: createJournalPartnerGoodLink,
    onSuccess: (newLink) => {
      queryClient.invalidateQueries({ queryKey: ["goods"] }); // Broad for now
      // Potentially a specific query for JPGLs if you display them directly
      if (newLink.journalPartnerLinkId) {
        // This structure might vary
        queryClient.invalidateQueries({
          queryKey: ["jpgLinks", newLink.journalPartnerLinkId],
        });
      }
      // alert(`3-way link created successfully!`);
    },
    onError: (error: Error) => {
      console.error("Failed to create 3-way link:", error);
      alert(`Error creating 3-way link: ${error.message}`);
    },
  });

  const deleteJPGLMutation = useMutation<{ message: string }, Error, string>({
    mutationFn: (linkId: string) => deleteJournalPartnerGoodLink(linkId),
    onSuccess: (data, deletedLinkId) => {
      alert(
        data.message || `3-way link ${deletedLinkId} unlinked successfully!`
      );
      queryClient.invalidateQueries({ queryKey: ["goods"] }); // Broad for now
      if (goodForUnlinkingContext && journalForUnlinkingContext) {
        queryClient.invalidateQueries({
          queryKey: [
            "jpgLinksForContext",
            goodForUnlinkingContext.id,
            journalForUnlinkingContext.id,
          ],
        });
      }
    },
    onError: (error: Error, linkId) => {
      console.error(`Failed to delete 3-way link ${linkId}:`, error);
      alert(`Error unlinking 3-way link: ${error.message}`);
    },
  });

  // Handlers for LinkGoodToPartnersViaJournalModal
  const openLinkGoodToPartnersViaJournalModalHandler = useCallback(async () => {
    if (!selectedGoodsId || !goodsData) {
      alert("Please select a Good first.");
      return;
    }
    const good = goodsData.find((g) => g.id === selectedGoodsId);
    if (!good) {
      alert("Selected Good data not found.");
      return;
    }

    // For J-G context (Goods is 2nd after Journal), effectiveSelectedJournalIds is key.
    if ((effectiveSelectedJournalIds || []).length === 0) {
      alert("No active Journal context found to link with.");
      return;
    }
    const targetJournalNodeId = (effectiveSelectedJournalIds || [])[0]; // Simplistic pick
    const targetJournalNode = findNodeById(
      currentHierarchy,
      targetJournalNodeId
    );

    if (!targetJournalNode) {
      alert(
        `Journal node for ID ${targetJournalNodeId} not found in hierarchy.`
      );
      return;
    }

    setGoodForJpgLinking(good);
    setTargetJournalForJpgLinking(targetJournalNode);
    setIsLoadingPartnersForJpgModal(true);
    setIsLinkGoodToPartnersViaJournalModalOpen(true);

    try {
      const partners = await fetchPartnersLinkedToJournals(
        [targetJournalNode.id],
        false
      );
      setPartnersForJpgModal(partners);
    } catch (error) {
      console.error("Error fetching partners for JPG linking modal:", error);
      alert("Could not load partners for the selected journal.");
      setPartnersForJpgModal([]);
    } finally {
      setIsLoadingPartnersForJpgModal(false);
    }
  }, [
    selectedGoodsId,
    goodsData,
    effectiveSelectedJournalIds,
    currentHierarchy,
  ]);

  const closeLinkGoodToPartnersViaJournalModalHandler = useCallback(() => {
    setIsLinkGoodToPartnersViaJournalModalOpen(false);
    setGoodForJpgLinking(null);
    setTargetJournalForJpgLinking(null);
    setPartnersForJpgModal([]);
    setIsLoadingPartnersForJpgModal(false); // Ensure this is reset
  }, []);

  const submitLinkGoodToPartnersViaJournalHandler = useCallback(
    async (linksData: CreateJournalPartnerGoodLinkClientData[]) => {
      if (linksData.length === 0) {
        closeLinkGoodToPartnersViaJournalModalHandler();
        return;
      }
      let successCount = 0;
      const promises = linksData.map((linkData) =>
        createJPGLMutation
          .mutateAsync(linkData)
          .then(() => successCount++)
          .catch((error) => {
            console.error("Error creating JPGL during batch:", error);
          })
      );
      await Promise.allSettled(promises);
      if (successCount > 0) {
        alert(
          `${successCount} of ${linksData.length} link(s) created successfully.`
        );
      }
      closeLinkGoodToPartnersViaJournalModalHandler();
    },
    [createJPGLMutation, closeLinkGoodToPartnersViaJournalModalHandler]
  );

  // Handlers for UnlinkGoodFromPartnersViaJournalModal
  const openUnlinkGoodFromPartnersViaJournalModalHandler =
    useCallback(async () => {
      if (!selectedGoodsId || !goodsData) {
        alert("Please select a Good first.");
        return;
      }
      const good = goodsData.find((g) => g.id === selectedGoodsId);
      if (!good) {
        alert("Selected Good data not found.");
        return;
      }

      let contextJournalNodeId: string | null = null;
      const journalSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
      const partnerSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);
      const goodSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);

      if (
        journalSliderIndex === 0 &&
        (goodSliderIndex === 1 || goodSliderIndex === 2)
      ) {
        contextJournalNodeId =
          (effectiveSelectedJournalIds || []).length > 0
            ? effectiveSelectedJournalIds[0]
            : null;
      } else if (
        partnerSliderIndex === 0 &&
        journalSliderIndex === 1 &&
        goodSliderIndex === 2
      ) {
        contextJournalNodeId = selectedJournalIdForPjgFiltering;
      }

      if (!contextJournalNodeId) {
        alert("No active Journal context found to determine links.");
        return;
      }
      const journalNode = findNodeById(currentHierarchy, contextJournalNodeId);
      if (!journalNode) {
        alert(`Journal node for ID ${contextJournalNodeId} not found.`);
        return;
      }

      setGoodForUnlinkingContext(good);
      setJournalForUnlinkingContext(journalNode);
      setIsLoadingJpgLinksForModal(true);
      setIsUnlinkGoodFromPartnersViaJournalModalOpen(true);

      try {
        const links = await fetchJpgLinksForGoodAndJournalContext(
          good.id,
          journalNode.id
        );
        setExistingJpgLinksForModal(links);
      } catch (error) {
        console.error(
          "Error fetching existing JPGLs for unlinking modal:",
          error
        );
        alert("Could not load existing links for this context.");
        setExistingJpgLinksForModal([]);
      } finally {
        setIsLoadingJpgLinksForModal(false);
      }
    }, [
      selectedGoodsId,
      goodsData,
      sliderOrder,
      effectiveSelectedJournalIds,
      selectedJournalIdForPjgFiltering,
      currentHierarchy,
    ]);

  const closeUnlinkGoodFromPartnersViaJournalModalHandler = useCallback(() => {
    setIsUnlinkGoodFromPartnersViaJournalModalOpen(false);
    setGoodForUnlinkingContext(null);
    setJournalForUnlinkingContext(null);
    setExistingJpgLinksForModal([]);
    setIsLoadingJpgLinksForModal(false); // Ensure reset
  }, []);

  const submitUnlinkGoodFromPartnersViaJournalHandler = useCallback(
    async (linkIdsToUnlink: string[]) => {
      if (linkIdsToUnlink.length === 0) {
        closeUnlinkGoodFromPartnersViaJournalModalHandler();
        return;
      }
      let successCount = 0;
      const promises = linkIdsToUnlink.map((linkId) =>
        deleteJPGLMutation
          .mutateAsync(linkId)
          .then(() => successCount++)
          .catch((error) => {
            console.error("Error deleting JPGL during batch:", error);
          })
      );
      await Promise.allSettled(promises);
      if (successCount > 0) {
        alert(`${successCount} link(s) unlinked successfully.`);
      }
      closeUnlinkGoodFromPartnersViaJournalModalHandler();
    },
    [deleteJPGLMutation, closeUnlinkGoodFromPartnersViaJournalModalHandler]
  );

  // +++ NEW HANDLER for direct/simple link creation +++
  const createSimpleJPGLHandler = useCallback(
    (linkData: CreateJournalPartnerGoodLinkClientData) => {
      if (!linkData.journalId || !linkData.partnerId || !linkData.goodId) {
        alert("Missing required information to create the link.");
        return;
      }
      createJPGLMutation.mutate(linkData, {
        onSuccess: (newLink) => {
          // You might want a specific alert or action for this simple link
          alert(`Direct link created for Good ${newLink.goodId}.`);
          // Invalidation is handled by the mutation's main onSuccess
        },
        onError: (error) => {
          // Error is already handled by the mutation's main onError,
          // but you could add more specific logging or UI feedback here if needed.
          console.error("Error during simple JPGL creation:", error);
        },
      });
    },
    [createJPGLMutation] // Depends on the mutation
  );

  return {
    // Link Modal
    isLinkGoodToPartnersViaJournalModalOpen,
    goodForJpgLinking,
    targetJournalForJpgLinking,
    partnersForJpgModal,
    isLoadingPartnersForJpgModal,
    openLinkGoodToPartnersViaJournalModalHandler,
    closeLinkGoodToPartnersViaJournalModalHandler,
    submitLinkGoodToPartnersViaJournalHandler,
    isSubmittingLinkJPGL: createJPGLMutation.isPending,
    createSimpleJPGLHandler,
    isCreatingSimpleJPGL: createJPGLMutation.isPending, // Or use a separate mutation if you need distinct pending states

    // Unlink Modal
    isUnlinkGoodFromPartnersViaJournalModalOpen,
    goodForUnlinkingContext,
    journalForUnlinkingContext,
    existingJpgLinksForModal,
    isLoadingJpgLinksForModal,
    openUnlinkGoodFromPartnersViaJournalModalHandler,
    closeUnlinkGoodFromPartnersViaJournalModalHandler,
    submitUnlinkGoodFromPartnersViaJournalHandler,
    isSubmittingUnlinkJPGL: deleteJPGLMutation.isPending,
  };
};
