// src/features/linking/usePartnerJournalLinking.ts
"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createJournalPartnerLink,
  deleteJournalPartnerLink,
  fetchJournalLinksForPartner,
} from "@/services/clientJournalPartnerLinkService";
// Assuming fetchPartnerById exists in your client service
import { fetchPartnerById } from "@/services/clientPartnerService";
import { useAppStore } from "@/store/appStore";

import type {
  Partner,
  CreateJournalPartnerLinkClientData,
  JournalPartnerLinkWithDetails,
} from "@/lib/types";

// The hook is now self-sufficient and takes no props.
export const usePartnerJournalLinking = () => {
  const queryClient = useQueryClient();

  // Consume the selected partner ID from the global store
  const selectedPartnerId = useAppStore((state) => state.selections.partner);

  // Local state for modals and the specific entity being acted upon
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [partnerForAction, setPartnerForAction] = useState<Partner | null>(
    null
  );

  const { data: linksForUnlinking, isLoading: isLoadingLinks } = useQuery<
    JournalPartnerLinkWithDetails[],
    Error
  >({
    queryKey: ["partnerJournalLinks", partnerForAction?.id],
    queryFn: () => fetchJournalLinksForPartner(partnerForAction!.id),
    enabled: !!partnerForAction && isUnlinkModalOpen,
  });

  const createJPLMutation = useMutation({
    mutationFn: createJournalPartnerLink,
    onSuccess: (newLink) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({
        queryKey: ["flatJournalsFilteredByPartner", newLink.partnerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["partnerJournalLinks", newLink.partnerId],
      });
    },
    onError: (error: Error) => {
      console.error("Failed to create journal-partner link:", error);
      alert(`Error linking partner to journal: ${error.message}`);
    },
  });

  const deleteJPLMutation = useMutation({
    mutationFn: deleteJournalPartnerLink,
    onSuccess: (data) => {
      alert(data.message || `Link unlinked successfully!`);
      queryClient.invalidateQueries({
        queryKey: ["partnerJournalLinks", partnerForAction?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      if (partnerForAction?.id) {
        queryClient.invalidateQueries({
          queryKey: ["flatJournalsFilteredByPartner", partnerForAction.id],
        });
      }
    },
    onError: (error: Error) => {
      console.error(`Failed to unlink partner-journal:`, error);
      alert(`Error unlinking: ${error.message}`);
    },
  });

  const getPartnerDetails = useCallback(
    async (partnerId: string): Promise<Partner | null> => {
      try {
        // <<-- FIX: The generic arguments for fetchQuery are corrected.
        // It should be <TQueryFnData, TError>. TQueryData defaults to TQueryFnData.
        const partner = await queryClient.fetchQuery<Partner, Error>({
          queryKey: ["partnerDetails", partnerId],
          queryFn: () => fetchPartnerById(partnerId),
          staleTime: 5 * 60 * 1000,
        });
        return partner;
      } catch (error) {
        console.error("Failed to fetch partner details:", error);
        alert("Could not retrieve partner details.");
        return null;
      }
    },
    [queryClient]
  );

  const openLinkModal = useCallback(async () => {
    if (!selectedPartnerId) {
      alert("Please select a partner first.");
      return;
    }
    const partner = await getPartnerDetails(selectedPartnerId);
    if (partner) {
      setPartnerForAction(partner);
      setIsLinkModalOpen(true);
    }
  }, [selectedPartnerId, getPartnerDetails]);

  const closeLinkModal = useCallback(() => {
    setIsLinkModalOpen(false);
    setPartnerForAction(null);
  }, []);

  const submitLinks = useCallback(
    async (linksData: CreateJournalPartnerLinkClientData[]) => {
      if (linksData.length === 0) {
        closeLinkModal();
        return;
      }
      const promises = linksData.map((linkData) =>
        createJPLMutation.mutateAsync(linkData)
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
    [createJPLMutation, closeLinkModal]
  );

  const openUnlinkModal = useCallback(async () => {
    if (!selectedPartnerId) {
      alert("Please select a partner to unlink from journals.");
      return;
    }
    const partner = await getPartnerDetails(selectedPartnerId);
    if (partner) {
      setPartnerForAction(partner);
      setIsUnlinkModalOpen(true);
    }
  }, [selectedPartnerId, getPartnerDetails]);

  const closeUnlinkModal = useCallback(() => {
    setIsUnlinkModalOpen(false);
    setPartnerForAction(null);
  }, []);

  const submitUnlink = useCallback(
    (linkIdsToUnlink: string[]) => {
      if (!partnerForAction) return;
      if (linkIdsToUnlink.length === 0) {
        closeUnlinkModal();
        return;
      }
      linkIdsToUnlink.forEach((linkId) => deleteJPLMutation.mutate(linkId));
    },
    [deleteJPLMutation, partnerForAction, closeUnlinkModal]
  );

  return {
    isLinkModalOpen,
    partnerForLinking: partnerForAction,
    isSubmittingLinks: createJPLMutation.isPending,
    openLinkModal,
    closeLinkModal,
    submitLinks,
    isUnlinkModalOpen,
    partnerForUnlinking: partnerForAction,
    linksForUnlinking: linksForUnlinking || [],
    isLoadingLinks,
    isSubmittingUnlink: deleteJPLMutation.isPending,
    openUnlinkModal,
    closeUnlinkModal,
    submitUnlink,
  };
};
