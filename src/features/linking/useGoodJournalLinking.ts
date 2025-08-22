"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { goodKeys, journalGoodLinkKeys, journalKeys } from "@/lib/queryKeys";
import { useToast } from "@/contexts/ToastContext";

// ✅ CHANGED: Services now import from the new, consistent client service files.
import {
  createJournalGoodLink,
  deleteJournalGoodLinkById,
  getJournalGoodLinks,
} from "@/services/clientJournalGoodLinkService";
import { fetchGoodById } from "@/services/clientGoodService";
import { useAppStore } from "@/store/appStore";

// ✅ CHANGED: All types are now imported from the new, type-safe locations.
import { GoodClient, JournalGoodLinkClient } from "@/lib/types/models.client";
import { CreateJournalGoodLinkPayload } from "@/lib/schemas/journalGoodLink.schema";

// No props needed.
export const useGoodJournalLinking = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  // ✅ CHANGED: state.selections.goods -> state.selections.good (for consistency)
  const selectedGoodId = useAppStore((state) => state.selections.good);

  // ✅ CHANGED: Local state now uses the new GoodClient type.
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [goodForAction, setGoodForAction] = useState<GoodClient | null>(null);

  // ✅ CHANGED: The query now uses the new service function and correct type.
  const { data: linksForUnlinking, isLoading: isLoadingLinks } = useQuery<
    JournalGoodLinkClient[],
    Error
  >({
    queryKey: journalGoodLinkKeys.listForGood(goodForAction?.id),
    queryFn: () => getJournalGoodLinks({ goodId: goodForAction!.id }),
    enabled: !!goodForAction && isUnlinkModalOpen,
  });

  const createJGLMutation = useMutation({
    // ✅ CORRECT: This already uses the new service function.
    mutationFn: createJournalGoodLink,
    onSuccess: (newLink) => {
      // Invalidation logic remains correct.
      queryClient.invalidateQueries({ queryKey: goodKeys.all });
      queryClient.invalidateQueries({
        queryKey: journalKeys.flatListByGood(newLink.goodId),
      });
      queryClient.invalidateQueries({
        queryKey: journalGoodLinkKeys.listForGood(newLink.goodId),
      });
      success("Link Created", "Good has been successfully linked to journal.");
    },
    onError: (err: Error) => {
      error("Link Failed", err.message || "Failed to link good to journal. Please try again.");
    },
  });

  const deleteJGLMutation = useMutation({
    // ✅ CHANGED: Uses the new service function `deleteJournalGoodLinkById`.
    mutationFn: deleteJournalGoodLinkById,
    onSuccess: () => {
      // Invalidation logic remains correct.
      queryClient.invalidateQueries({
        queryKey: journalGoodLinkKeys.listForGood(goodForAction!.id),
      });
      queryClient.invalidateQueries({ queryKey: goodKeys.all });
      if (goodForAction?.id) {
        queryClient.invalidateQueries({
          queryKey: journalKeys.flatListByGood(goodForAction.id),
        });
      }
      success("Link Removed", "Good has been successfully unlinked from journal.");
    },
    onError: (err: Error) => {
      error("Unlink Failed", err.message || "Failed to unlink good from journal. Please try again.");
    },
  });

  const getGoodDetails = useCallback(
    async (goodId: string): Promise<GoodClient | null> => {
      try {
        // ✅ CHANGED: fetchQuery is now typed with GoodClient.
        const good = await queryClient.fetchQuery<GoodClient, Error>({
          queryKey: goodKeys.detail(goodId),
          queryFn: () => fetchGoodById(goodId),
          staleTime: 5 * 60 * 1000,
        });
        return good;
      } catch (error) {
        console.error("Failed to fetch good details:", error);
        alert("Could not retrieve good/service details.");
        return null;
      }
    },
    [queryClient]
  );

  const openLinkModal = useCallback(async () => {
    // ✅ CHANGED: selectedGoodsId -> selectedGoodId
    if (!selectedGoodId) {
      alert("Please select a good/service first.");
      return;
    }
    const good = await getGoodDetails(selectedGoodId);
    if (good) {
      setGoodForAction(good);
      setIsLinkModalOpen(true);
    }
  }, [selectedGoodId, getGoodDetails]);

  const closeLinkModal = useCallback(() => {
    setIsLinkModalOpen(false);
    setGoodForAction(null);
  }, []);

  const submitLinks = useCallback(
    // ✅ CHANGED: The payload type now comes from the Zod schema.
    async (linksData: CreateJournalGoodLinkPayload[]) => {
      if (linksData.length === 0) {
        closeLinkModal();
        return;
      }
      const promises = linksData.map((linkData) =>
        createJGLMutation.mutateAsync(linkData)
      );
      const results = await Promise.allSettled(promises);
      const successCount = results.filter(
        (r) => r.status === "fulfilled"
      ).length;

      if (successCount > 0) {
        alert(
          `${successCount} of ${linksData.length} link(s) created successfully.`
        );
      }
      closeLinkModal();
    },
    [createJGLMutation, closeLinkModal]
  );

  const openUnlinkModal = useCallback(async () => {
    // ✅ CHANGED: selectedGoodsId -> selectedGoodId
    if (!selectedGoodId) {
      alert("Please select a good/service to unlink from journals.");
      return;
    }
    const good = await getGoodDetails(selectedGoodId);
    if (good) {
      setGoodForAction(good);
      setIsUnlinkModalOpen(true);
    }
  }, [selectedGoodId, getGoodDetails]);

  const closeUnlinkModal = useCallback(() => {
    setIsUnlinkModalOpen(false);
    setGoodForAction(null);
  }, []);

  const submitUnlink = useCallback(
    (linkIdsToUnlink: string[]) => {
      if (!goodForAction) return;
      if (linkIdsToUnlink.length === 0) {
        closeUnlinkModal();
        return;
      }
      // ✅ CHANGED: Calls the updated mutation that uses `deleteJournalGoodLinkById`.
      linkIdsToUnlink.forEach((linkId) => deleteJGLMutation.mutate(linkId));
    },
    [deleteJGLMutation, goodForAction, closeUnlinkModal]
  );

  return {
    isLinkModalOpen,
    goodForLinking: goodForAction,
    isSubmittingLinks: createJGLMutation.isPending,
    openLinkModal,
    closeLinkModal,
    submitLinks,
    isUnlinkModalOpen,
    goodForUnlinking: goodForAction,
    linksForUnlinking: linksForUnlinking || [],
    isLoadingLinks,
    isSubmittingUnlink: deleteJGLMutation.isPending,
    openUnlinkModal,
    closeUnlinkModal,
    submitUnlink,
  };
};
