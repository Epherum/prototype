// src/features/linking/useJournalPartnerGoodLinkManager.ts
"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import type { GoodClient, PartnerClient, JournalPartnerGoodLinkClient } from "@/lib/types/models.client";
import type { LinkMode } from "./components/JournalPartnerGoodLinkModal";
import {
  createBulkJournalPartnerGoodLinks,
  deleteBulkJournalPartnerGoodLinks,
  getLinksForPartnerInJournals,
  getLinksForGoodInJournals,
} from "@/services/clientJournalPartnerGoodLinkService";
import { fetchPartners } from "@/services/clientPartnerService";
import { getAllGoods } from "@/services/clientGoodService";

export interface LinkData {
  journalId: string;
  partnerId: string;
  goodId: string;
  descriptiveText?: string;
}

interface UseJournalPartnerGoodLinkManagerProps {
  selectedJournalIds: string[];
  selectedEntity: PartnerClient | GoodClient | null;
  mode: LinkMode;
}

export function useJournalPartnerGoodLinkManager({
  selectedJournalIds,
  selectedEntity,
  mode,
}: UseJournalPartnerGoodLinkManagerProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch available items to link to (partners or goods)
  const { data: availableItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['linkable-items', mode, selectedJournalIds],
    queryFn: async () => {
      if (selectedJournalIds.length === 0) return [];
      
      if (mode === "partner-to-goods") {
        // Fetch goods that are linked to the selected journals
        const response = await getAllGoods({
          selectedJournalIds,
          filterMode: "affected", // Only show goods linked to these journals
        });
        return response.data;
      } else {
        // Fetch partners that are linked to the selected journals
        const response = await fetchPartners({
          selectedJournalIds,
          filterMode: "affected", // Only show partners linked to these journals
        });
        return response.data;
      }
    },
    enabled: selectedJournalIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch existing links for the selected entity
  const { data: existingLinks = [], isLoading: isLoadingLinks } = useQuery({
    queryKey: ['existing-links', selectedEntity?.id, selectedJournalIds, mode],
    queryFn: async () => {
      if (!selectedEntity || selectedJournalIds.length === 0) return [];
      
      if (mode === "partner-to-goods") {
        return getLinksForPartnerInJournals(selectedEntity.id, selectedJournalIds);
      } else {
        return getLinksForGoodInJournals(selectedEntity.id, selectedJournalIds);
      }
    },
    enabled: !!selectedEntity && selectedJournalIds.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Create links mutation
  const createLinksMutation = useMutation({
    mutationFn: createBulkJournalPartnerGoodLinks,
    onSuccess: (createdLinks) => {
      toast.success(`Successfully created ${createdLinks.length} links`);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['existing-links'] });
      queryClient.invalidateQueries({ queryKey: ['goods'] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      queryClient.invalidateQueries({ queryKey: ['journal-partner-good-links'] });
      
      setIsModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to create links", error.message);
    },
  });

  // Delete links mutation
  const deleteLinksMutation = useMutation({
    mutationFn: deleteBulkJournalPartnerGoodLinks,
    onSuccess: (_, deletedLinkIds) => {
      toast.success(`Successfully deleted ${deletedLinkIds.length} links`);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['existing-links'] });
      queryClient.invalidateQueries({ queryKey: ['goods'] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      queryClient.invalidateQueries({ queryKey: ['journal-partner-good-links'] });
    },
    onError: (error: Error) => {
      toast.error("Failed to delete links", error.message);
    },
  });

  const openModal = useCallback(() => {
    if (!selectedEntity) {
      toast.error("Please select an item to link");
      return;
    }
    if (selectedJournalIds.length === 0) {
      toast.error("Please select journals to link in");
      return;
    }
    setIsModalOpen(true);
  }, [selectedEntity, selectedJournalIds, toast]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleCreateLinks = useCallback((linksData: LinkData[]) => {
    if (linksData.length === 0) {
      toast.error("No links to create");
      return;
    }

    // Transform LinkData to CreateJournalPartnerGoodLinkPayload
    const payloads = linksData.map(link => ({
      journalId: String(link.journalId),
      partnerId: String(link.partnerId),
      goodId: String(link.goodId),
      partnershipType: "STANDARD_TRANSACTION" as const,
      descriptiveText: link.descriptiveText,
    }));

    createLinksMutation.mutate(payloads);
  }, [createLinksMutation, toast]);

  const handleDeleteLinks = useCallback((linkIds: string[]) => {
    if (linkIds.length === 0) {
      toast.error("No links to delete");
      return;
    }

    deleteLinksMutation.mutate(linkIds);
  }, [deleteLinksMutation, toast]);

  const isLoading = isLoadingItems || isLoadingLinks;
  const isSubmitting = createLinksMutation.isPending || deleteLinksMutation.isPending;

  return {
    // Modal state
    isModalOpen,
    openModal,
    closeModal,
    
    // Data
    availableItems,
    existingLinks,
    
    // Actions
    handleCreateLinks,
    handleDeleteLinks,
    
    // Loading states
    isLoading,
    isSubmitting,
  };
}