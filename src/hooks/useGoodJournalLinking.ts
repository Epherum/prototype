// src/hooks/useGoodJournalLinking.ts
import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createJournalGoodLink,
  deleteJournalGoodLink,
  fetchJournalLinksForGood,
} from "@/services/clientJournalGoodLinkService";
import type {
  Good,
  AccountNodeData,
  CreateJournalGoodLinkClientData,
  // FetchGoodsParams, // If needed for specific query key structure
} from "@/lib/types";

export interface UseGoodJournalLinkingProps {
  selectedGoodsId: string | null;
  goodsData: Good[] | undefined; // Full list of goods to find the selected one
  // goodsQueryKeyParamsStructure: FetchGoodsParams | undefined; // For invalidating goods list
  onOpenJournalSelector: (
    onSelectCallback: (journalNode: AccountNodeData) => void
  ) => void;
  // currentHierarchy?: AccountNodeData[]; // Pass if LinkGoodToJournalsModal needs it directly
}

export const useGoodJournalLinking = ({
  selectedGoodsId,
  goodsData,
  // goodsQueryKeyParamsStructure,
  onOpenJournalSelector,
}: // currentHierarchy,
UseGoodJournalLinkingProps) => {
  const queryClient = useQueryClient();

  const [isLinkGoodToJournalsModalOpen, setIsLinkGoodToJournalsModalOpen] =
    useState(false);
  const [goodForLinking, setGoodForLinking] = useState<Good | null>(null);

  const [isUnlinkGoodModalOpen, setIsUnlinkGoodModalOpen] = useState(false);
  const [goodForUnlinking, setGoodForUnlinking] = useState<Good | null>(null);

  // Mutations
  const createJGLMutation = useMutation({
    mutationFn: createJournalGoodLink,
    onSuccess: (newLink) => {
      queryClient.invalidateQueries({ queryKey: ["goods"] }); // General goods list
      queryClient.invalidateQueries({
        queryKey: ["flatJournalsFilteredByGood", newLink.goodId], // If useJournalManager uses this
      });
      queryClient.invalidateQueries({
        queryKey: ["goodJournalLinks", newLink.goodId],
      }); // For Unlink modal list
      // alert(`Successfully linked Good ${newLink.goodId} to Journal ${newLink.journalId}.`);
    },
    onError: (error: Error) => {
      console.error("Failed to create journal-good link:", error);
      alert(`Error linking good to journal: ${error.message}`);
    },
  });

  const deleteJGLMutation = useMutation({
    mutationFn: deleteJournalGoodLink,
    onSuccess: (data, variables) => {
      alert(data.message || `Journal-Good link unlinked successfully!`);
      queryClient.invalidateQueries({
        queryKey: ["goodJournalLinks", goodForUnlinking?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["goods"] });
      if (goodForUnlinking?.id) {
        queryClient.invalidateQueries({
          queryKey: ["flatJournalsFilteredByGood", goodForUnlinking.id],
        });
      }
    },
    onError: (error: Error, linkIdOrContext) => {
      console.error(`Failed to unlink good-journal:`, error, linkIdOrContext);
      alert(`Error unlinking good from journal: ${error.message}`);
    },
  });

  // Handlers for LinkGoodToJournalsModal
  const openLinkGoodToJournalsModalHandler = useCallback(() => {
    if (selectedGoodsId && goodsData) {
      const good = goodsData.find((g) => g.id === selectedGoodsId);
      if (good) {
        setGoodForLinking(good);
        setIsLinkGoodToJournalsModalOpen(true);
      } else {
        alert("Selected good/service data not found.");
      }
    } else {
      alert("Please select a good/service first or goods data is not loaded.");
    }
  }, [selectedGoodsId, goodsData]);

  const closeLinkGoodToJournalsModalHandler = useCallback(() => {
    setIsLinkGoodToJournalsModalOpen(false);
    setGoodForLinking(null);
  }, []);

  const submitLinkGoodToJournalsHandler = useCallback(
    async (linksData: CreateJournalGoodLinkClientData[]) => {
      if (linksData.length === 0) {
        closeLinkGoodToJournalsModalHandler();
        return;
      }

      let successCount = 0;
      const promises = linksData.map((linkData) =>
        createJGLMutation
          .mutateAsync(linkData)
          .then(() => {
            successCount++;
          })
          .catch((error) => {
            console.error(
              `Failed to link a journal for good ${linkData.goodId} during batch:`,
              error
            );
          })
      );

      await Promise.allSettled(promises);

      if (successCount > 0) {
        alert(
          `${successCount} of ${linksData.length} good-journal link(s) created successfully.`
        );
      }
      closeLinkGoodToJournalsModalHandler();
    },
    [createJGLMutation, closeLinkGoodToJournalsModalHandler]
  );

  // Handlers for UnlinkGoodFromJournalsModal
  const openUnlinkGoodModalHandler = useCallback(() => {
    if (selectedGoodsId && goodsData) {
      const good = goodsData.find((g) => g.id === selectedGoodsId);
      if (good) {
        setGoodForUnlinking(good);
        setIsUnlinkGoodModalOpen(true);
      } else {
        alert("Selected good/service data not found for unlinking.");
      }
    } else {
      alert("Please select a good/service first or goods data is not loaded.");
    }
  }, [selectedGoodsId, goodsData]);

  const closeUnlinkGoodModalHandler = useCallback(() => {
    setIsUnlinkGoodModalOpen(false);
    setGoodForUnlinking(null);
  }, []);

  const submitUnlinkGoodHandler = useCallback(
    (linkIdsToUnlink: string[]) => {
      if (!goodForUnlinking) return;
      if (linkIdsToUnlink.length === 0) {
        closeUnlinkGoodModalHandler();
        return;
      }
      linkIdsToUnlink.forEach((linkId) => {
        deleteJGLMutation.mutate(linkId);
      });
    },
    [deleteJGLMutation, goodForUnlinking, closeUnlinkGoodModalHandler]
  );

  const fetchLinksForGoodUnlinkModal = useCallback((goodId: string) => {
    return fetchJournalLinksForGood(goodId);
  }, []);

  return {
    // Link Modal
    isLinkGoodToJournalsModalOpen,
    goodForLinking,
    openLinkGoodToJournalsModalHandler,
    closeLinkGoodToJournalsModalHandler,
    submitLinkGoodToJournalsHandler,
    isSubmittingLinkGoodToJournals: createJGLMutation.isPending,
    // Unlink Modal
    isUnlinkGoodModalOpen,
    goodForUnlinking,
    openUnlinkGoodModalHandler,
    closeUnlinkGoodModalHandler,
    submitUnlinkGoodHandler,
    isSubmittingUnlinkGood: deleteJGLMutation.isPending,
    // Utilities
    onOpenJournalSelector,
    fetchLinksForGoodUnlinkModal,
  };
};
