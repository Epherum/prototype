// src/hooks/usePartnerJournalLinking.ts
import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createJournalPartnerLink,
  deleteJournalPartnerLink,
  fetchJournalLinksForPartner, // If needed directly by the hook for the unlink modal
} from "@/services/clientJournalPartnerLinkService";
import type {
  Partner,
  AccountNodeData,
  CreateJournalPartnerLinkClientData,
  FetchPartnersParams, // For query key structure
} from "@/lib/types";

export interface UsePartnerJournalLinkingProps {
  selectedPartnerId: string | null;
  partnerData: Partner[] | undefined; // Full list of partners to find the selected one
  // partnerQueryKeyParamsStructure: FetchPartnersParams | undefined; // Structure for invalidating partner list
  onOpenJournalSelector: (
    onSelectCallback: (journalNode: AccountNodeData) => void
  ) => void;
  // currentHierarchy?: AccountNodeData[]; // Pass if LinkPartnerToJournalsModal needs it directly
}

export const usePartnerJournalLinking = ({
  selectedPartnerId,
  partnerData,
  // partnerQueryKeyParamsStructure,
  onOpenJournalSelector,
}: // currentHierarchy,
UsePartnerJournalLinkingProps) => {
  const queryClient = useQueryClient();

  const [
    isLinkPartnerToJournalsModalOpen,
    setIsLinkPartnerToJournalsModalOpen,
  ] = useState(false);
  const [partnerForLinking, setPartnerForLinking] = useState<Partner | null>(
    null
  );

  const [isUnlinkPartnerModalOpen, setIsUnlinkPartnerModalOpen] =
    useState(false);
  const [partnerForUnlinking, setPartnerForUnlinking] =
    useState<Partner | null>(null);

  // Mutations
  const createJPLMutation = useMutation({
    mutationFn: createJournalPartnerLink,
    onSuccess: (newLink) => {
      // Invalidate queries that might be affected by this new link
      // The specific partner query key structure would be ideal here.
      // For now, a broader invalidation or a more specific one based on newLink.partnerId
      queryClient.invalidateQueries({ queryKey: ["partners"] }); // General partner list
      queryClient.invalidateQueries({
        queryKey: ["flatJournalsFilteredByPartner", newLink.partnerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["partnerJournalLinks", newLink.partnerId],
      }); // For Unlink modal list
      // alert(`Successfully linked Partner ${newLink.partnerId} to Journal ${newLink.journalId}.`);
    },
    onError: (error: Error) => {
      console.error("Failed to create journal-partner link:", error);
      alert(`Error linking partner to journal: ${error.message}`);
    },
  });

  const deleteJPLMutation = useMutation({
    mutationFn: deleteJournalPartnerLink,
    onSuccess: (data, variables) => {
      // variables could be the linkId or { partnerId, journalId }
      alert(data.message || `Link unlinked successfully!`);
      queryClient.invalidateQueries({
        queryKey: ["partnerJournalLinks", partnerForUnlinking?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      if (partnerForUnlinking?.id) {
        queryClient.invalidateQueries({
          queryKey: ["flatJournalsFilteredByPartner", partnerForUnlinking.id],
        });
      }
    },
    onError: (error: Error, linkIdOrContext) => {
      console.error(
        `Failed to unlink partner-journal:`,
        error,
        linkIdOrContext
      );
      alert(`Error unlinking: ${error.message}`);
    },
  });

  // Handlers for LinkPartnerToJournalsModal
  const openLinkPartnerToJournalsModalHandler = useCallback(() => {
    if (selectedPartnerId && partnerData) {
      const partner = partnerData.find((p) => p.id === selectedPartnerId);
      if (partner) {
        setPartnerForLinking(partner);
        setIsLinkPartnerToJournalsModalOpen(true);
      } else {
        alert("Selected partner data not found.");
      }
    } else {
      alert("Please select a partner first or partner data is not loaded.");
    }
  }, [selectedPartnerId, partnerData]);

  const closeLinkPartnerToJournalsModalHandler = useCallback(() => {
    setIsLinkPartnerToJournalsModalOpen(false);
    setPartnerForLinking(null);
  }, []);

  const submitLinkPartnerToJournalsHandler = useCallback(
    async (linksData: CreateJournalPartnerLinkClientData[]) => {
      if (linksData.length === 0) {
        closeLinkPartnerToJournalsModalHandler();
        return;
      }

      let successCount = 0;
      const promises = linksData.map((linkData) =>
        createJPLMutation
          .mutateAsync(linkData)
          .then(() => {
            successCount++;
          })
          .catch((error) => {
            // Error already handled by mutation's onError
            console.error(
              `Failed to link a journal for partner ${linkData.partnerId} during batch:`,
              error
            );
          })
      );

      await Promise.allSettled(promises);

      if (successCount > 0) {
        alert(
          `${successCount} of ${linksData.length} link(s) created successfully.`
        );
      }
      if (successCount !== linksData.length) {
        // Individual errors alerted by mutation's onError
        // alert(`Some links could not be created. Check console for details.`);
      }
      closeLinkPartnerToJournalsModalHandler();
    },
    [createJPLMutation, closeLinkPartnerToJournalsModalHandler]
  );

  // Handlers for UnlinkPartnerFromJournalsModal
  const openUnlinkPartnerModalHandler = useCallback(() => {
    if (selectedPartnerId && partnerData) {
      const partner = partnerData.find((p) => p.id === selectedPartnerId);
      if (partner) {
        setPartnerForUnlinking(partner);
        setIsUnlinkPartnerModalOpen(true);
        // Note: handleClosePartnerOptionsMenu() would be called in page.tsx if this handler is passed to the menu
      } else {
        alert("Selected partner data not found for unlinking.");
      }
    } else {
      alert("Please select a partner first or partner data is not loaded.");
    }
  }, [selectedPartnerId, partnerData]);

  const closeUnlinkPartnerModalHandler = useCallback(() => {
    setIsUnlinkPartnerModalOpen(false);
    setPartnerForUnlinking(null);
  }, []);

  const submitUnlinkPartnerHandler = useCallback(
    (linkIdsToUnlink: string[]) => {
      if (!partnerForUnlinking) return;
      if (linkIdsToUnlink.length === 0) {
        closeUnlinkPartnerModalHandler();
        return;
      }
      // For simplicity, deleting one by one. Could batch if backend supports.
      linkIdsToUnlink.forEach((linkId) => {
        deleteJPLMutation.mutate(linkId); // Pass partnerId if needed by mutationFn
      });
      // Consider if modal should close immediately or wait.
      // For now, assuming UnlinkModal manages its own state refresh and closing on success/error of individual unlinks.
      // If all unlinks are successful, or after all attempts, you might close it:
      // closeUnlinkPartnerModalHandler(); // Or the modal itself calls this.
    },
    [deleteJPLMutation, partnerForUnlinking, closeUnlinkPartnerModalHandler]
  );

  const fetchLinksForUnlinkModal = useCallback((partnerId: string) => {
    return fetchJournalLinksForPartner(partnerId);
  }, []);

  return {
    // Link Modal
    isLinkPartnerToJournalsModalOpen,
    partnerForLinking,
    openLinkPartnerToJournalsModalHandler,
    closeLinkPartnerToJournalsModalHandler,
    submitLinkPartnerToJournalsHandler,
    isSubmittingLinkPartnerToJournals: createJPLMutation.isPending,
    // Unlink Modal
    isUnlinkPartnerModalOpen,
    partnerForUnlinking,
    openUnlinkPartnerModalHandler,
    closeUnlinkPartnerModalHandler,
    submitUnlinkPartnerHandler,
    isSubmittingUnlinkPartner: deleteJPLMutation.isPending,
    // Utilities
    onOpenJournalSelector, // Pass through the prop for the modal to use
    fetchLinksForUnlinkModal,
  };
};
