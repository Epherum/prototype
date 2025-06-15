// src/hooks/useGoodJournalLinking.ts
"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { goodKeys, journalGoodLinkKeys, journalKeys } from "@/lib/queryKeys";

import {
  createJournalGoodLink,
  deleteJournalGoodLink,
  fetchJournalLinksForGood,
} from "@/services/clientJournalGoodLinkService";
// Assuming this service function exists, e.g., created from the partner one.
import { fetchGoodById } from "@/services/clientGoodService";
import { useAppStore } from "@/store/appStore";

import type {
  Good,
  CreateJournalGoodLinkClientData,
  JournalGoodLinkWithDetails,
} from "@/lib/types";

// No props needed.
export const useGoodJournalLinking = () => {
  const queryClient = useQueryClient();

  const selectedGoodsId = useAppStore((state) => state.selections.goods);

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [goodForAction, setGoodForAction] = useState<Good | null>(null);

  const { data: linksForUnlinking, isLoading: isLoadingLinks } = useQuery<
    JournalGoodLinkWithDetails[],
    Error
  >({
    queryKey: journalGoodLinkKeys.listForGood(goodForAction?.id),
    queryFn: () => fetchJournalLinksForGood(goodForAction!.id),
    enabled: !!goodForAction && isUnlinkModalOpen,
  });

  const createJGLMutation = useMutation({
    mutationFn: createJournalGoodLink,
    onSuccess: (newLink) => {
      queryClient.invalidateQueries({ queryKey: goodKeys.all });
      queryClient.invalidateQueries({
        queryKey: journalKeys.flatListByGood(newLink.goodId),
      });
      queryClient.invalidateQueries({
        queryKey: journalGoodLinkKeys.listForGood(newLink.goodId),
      });
    },
    onError: (error: Error) => {
      console.error("Failed to create journal-good link:", error);
      alert(`Error linking good to journal: ${error.message}`);
    },
  });

  const deleteJGLMutation = useMutation({
    mutationFn: deleteJournalGoodLink,
    onSuccess: (data) => {
      alert(data.message || `Link unlinked successfully!`);
      queryClient.invalidateQueries({
        queryKey: journalGoodLinkKeys.listForGood(goodForAction!.id),
      });
      queryClient.invalidateQueries({ queryKey: goodKeys.all });
      if (goodForAction?.id) {
        queryClient.invalidateQueries({
          queryKey: journalKeys.flatListByGood(goodForAction.id),
        });
      }
    },
    onError: (error: Error) => {
      console.error(`Failed to unlink good-journal:`, error);
      alert(`Error unlinking: ${error.message}`);
    },
  });

  const getGoodDetails = useCallback(
    async (goodId: string): Promise<Good | null> => {
      try {
        const good = await queryClient.fetchQuery<Good, Error>({
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
    if (!selectedGoodsId) {
      alert("Please select a good/service first.");
      return;
    }
    const good = await getGoodDetails(selectedGoodsId);
    if (good) {
      setGoodForAction(good);
      setIsLinkModalOpen(true);
    }
  }, [selectedGoodsId, getGoodDetails]);

  const closeLinkModal = useCallback(() => {
    setIsLinkModalOpen(false);
    setGoodForAction(null);
  }, []);

  const submitLinks = useCallback(
    async (linksData: CreateJournalGoodLinkClientData[]) => {
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
    if (!selectedGoodsId) {
      alert("Please select a good/service to unlink from journals.");
      return;
    }
    const good = await getGoodDetails(selectedGoodsId);
    if (good) {
      setGoodForAction(good);
      setIsUnlinkModalOpen(true);
    }
  }, [selectedGoodsId, getGoodDetails]);

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
