// src/features/linking/usePartnerJournalLinking.ts
"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  partnerKeys,
  journalPartnerLinkKeys,
  journalKeys,
} from "@/lib/queryKeys";
import { useToast } from "@/contexts/ToastContext";

// ✅ CHANGED: Services now import from the new, consistent client service files.
import {
  createJournalPartnerLink,
  deleteJournalPartnerLinkById,
  getJournalPartnerLinks, // Using the new consolidated fetcher
} from "@/services/clientJournalPartnerLinkService";
import { fetchPartnerById } from "@/services/clientPartnerService";
import { useAppStore } from "@/store/appStore";

// ✅ CHANGED: All types are now imported from the new, type-safe locations.
import {
  PartnerClient,
  JournalPartnerLinkWithDetailsClient,
  JournalPartnerLinkClient, // The base link type
} from "@/lib/types/models.client";
import { CreateJournalPartnerLinkPayload } from "@/lib/schemas/journalPartnerLink.schema";

// The hook is now self-sufficient and takes no props.
export const usePartnerJournalLinking = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  // Consume the selected partner ID from the global store
  const selectedPartnerId = useAppStore((state) => state.selections.partner);

  // ✅ CHANGED: Local state uses the new PartnerClient type.
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [partnerForAction, setPartnerForAction] =
    useState<PartnerClient | null>(null);

  // ✅ CHANGED: The query now uses the new getJournalPartnerLinks service function.
  // The return type is updated to what the service provides. We assume the unlinking
  // modal can be adapted to work with JournalPartnerLinkClient if full details aren't fetched.
  const { data: linksForUnlinking, isLoading: isLoadingLinks } = useQuery<
    JournalPartnerLinkClient[],
    Error
  >({
    queryKey: journalPartnerLinkKeys.listForPartner(partnerForAction?.id),
    queryFn: () => getJournalPartnerLinks({ partnerId: partnerForAction!.id }),
    enabled: !!partnerForAction && isUnlinkModalOpen,
  });

  const createJPLMutation = useMutation({
    // ✅ CORRECT: This already uses the new service function.
    mutationFn: createJournalPartnerLink,
    onSuccess: (newLink) => {
      // Invalidation logic remains correct.
      queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      queryClient.invalidateQueries({
        queryKey: journalKeys.flatListByPartner(newLink.partnerId),
      });
      queryClient.invalidateQueries({
        queryKey: journalPartnerLinkKeys.listForPartner(newLink.partnerId),
      });
      success("Link Created", "Partner has been successfully linked to journal.");
    },
    onError: (err: Error) => {
      error("Link Failed", err.message || "Failed to link partner to journal. Please try again.");
    },
  });

  const deleteJPLMutation = useMutation({
    // ✅ CHANGED: Uses the new service function `deleteJournalPartnerLinkById`.
    mutationFn: deleteJournalPartnerLinkById,
    onSuccess: () => {
      // Invalidation logic remains correct.
      queryClient.invalidateQueries({
        queryKey: journalPartnerLinkKeys.listForPartner(partnerForAction!.id),
      });
      queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      if (partnerForAction?.id) {
        queryClient.invalidateQueries({
          queryKey: journalKeys.flatListByPartner(partnerForAction.id),
        });
      }
      success("Link Removed", "Partner has been successfully unlinked from journal.");
    },
    onError: (err: Error) => {
      error("Unlink Failed", err.message || "Failed to unlink partner from journal. Please try again.");
      alert(`Error unlinking: ${err.message}`);
    },
  });

  const getPartnerDetails = useCallback(
    async (partnerId: string): Promise<PartnerClient | null> => {
      try {
        // ✅ CHANGED: fetchQuery is now typed with PartnerClient.
        const partner = await queryClient.fetchQuery<PartnerClient, Error>({
          queryKey: partnerKeys.detail(partnerId),
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
    // ✅ CHANGED: The payload type now comes from the Zod schema.
    async (linksData: CreateJournalPartnerLinkPayload[]) => {
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
      // ✅ CHANGED: Calls the updated mutation that uses `deleteJournalPartnerLinkById`.
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
