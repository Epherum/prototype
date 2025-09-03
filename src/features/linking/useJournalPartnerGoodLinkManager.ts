// src/features/linking/useJournalPartnerGoodLinkManager.ts
"use client";

import { useState, useCallback, useMemo } from "react";
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

  // Extract journal IDs that the selected entity is linked to
  const entityLinkedJournalIds = useMemo(() => {
    if (!selectedEntity) return [];
    
    if (mode === "partner-to-goods" && 'journalPartnerLinks' in selectedEntity) {
      return selectedEntity.journalPartnerLinks?.map(link => link.journalId).filter(Boolean) || [];
    } else if (mode === "good-to-partners" && 'journalGoodLinks' in selectedEntity) {
      return selectedEntity.journalGoodLinks?.map(link => link.journalId).filter(Boolean) || [];
    }
    
    return [];
  }, [selectedEntity, mode]);

  // Fetch available items to link to (partners or goods) with color coding
  const { data: rawAvailableItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['linkable-items', mode, entityLinkedJournalIds],
    queryFn: async () => {
      if (entityLinkedJournalIds.length === 0) return [];
      
      if (mode === "partner-to-goods") {
        // Fetch goods that are linked to the same journals as the selected partner
        const response = await getAllGoods({
          selectedJournalIds: entityLinkedJournalIds,
          filterMode: "affected", // Only show goods linked to these journals
        });
        return response.data;
      } else {
        // Fetch partners that are linked to the same journals as the selected good
        const response = await fetchPartners({
          selectedJournalIds: entityLinkedJournalIds,
          filterMode: "affected", // Only show partners linked to these journals
        });
        return response.data;
      }
    },
    enabled: entityLinkedJournalIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Enhance items with shared journal information for color coding
  const availableItems = useMemo(() => {
    if (!selectedEntity || entityLinkedJournalIds.length === 0) return rawAvailableItems;
    
    return rawAvailableItems.map(item => {
      let itemJournalIds: string[] = [];
      
      if (mode === "partner-to-goods" && 'journalGoodLinks' in item) {
        itemJournalIds = item.journalGoodLinks?.map(link => link.journalId).filter(Boolean) || [];
      } else if (mode === "good-to-partners" && 'journalPartnerLinks' in item) {
        itemJournalIds = item.journalPartnerLinks?.map(link => link.journalId).filter(Boolean) || [];
      }
      
      // Find shared journals
      const sharedJournals = itemJournalIds.filter(journalId => 
        entityLinkedJournalIds.includes(journalId)
      );
      
      // Color code based on shared journals
      let colorCode = '';
      if (sharedJournals.length === entityLinkedJournalIds.length) {
        colorCode = 'full-match'; // All entity's journals are shared
      } else if (sharedJournals.length > 0) {
        colorCode = 'partial-match'; // Some journals are shared
      }
      
      return {
        ...item,
        sharedJournals,
        sharedJournalCount: sharedJournals.length,
        totalJournalCount: itemJournalIds.length,
        colorCode,
        // Add to matchedFilters for existing color coding system
        matchedFilters: colorCode ? [colorCode] : [],
      };
    });
  }, [rawAvailableItems, selectedEntity, entityLinkedJournalIds, mode]);

  // Fetch existing links for the selected entity
  const { data: existingLinks = [], isLoading: isLoadingLinks } = useQuery({
    queryKey: ['existing-links', selectedEntity?.id, entityLinkedJournalIds, mode],
    queryFn: async () => {
      if (!selectedEntity || entityLinkedJournalIds.length === 0) return [];
      
      if (mode === "partner-to-goods") {
        return getLinksForPartnerInJournals(selectedEntity.id, entityLinkedJournalIds);
      } else {
        return getLinksForGoodInJournals(selectedEntity.id, entityLinkedJournalIds);
      }
    },
    enabled: !!selectedEntity && entityLinkedJournalIds.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Create links mutation
  const createLinksMutation = useMutation({
    mutationFn: createBulkJournalPartnerGoodLinks,
    onSuccess: (createdLinks) => {
      if (createdLinks.length > 0) {
        toast.success(`Successfully created ${createdLinks.length} links`);
        
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['existing-links'] });
        queryClient.invalidateQueries({ queryKey: ['goods'] });
        queryClient.invalidateQueries({ queryKey: ['partners'] });
        queryClient.invalidateQueries({ queryKey: ['journal-partner-good-links'] });
        
        setIsModalOpen(false);
      } else {
        toast.warning("No links were created. Please check console for details.");
      }
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
      partnerId: link.partnerId,
      goodId: link.goodId,
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
    entityLinkedJournalIds,
    
    // Actions
    handleCreateLinks,
    handleDeleteLinks,
    
    // Loading states
    isLoading,
    isSubmitting,
  };
}