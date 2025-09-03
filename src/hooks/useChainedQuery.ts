// src/hooks/useChainedQuery.ts
"use client";

import { useMemo } from "react";
import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { SLIDER_TYPES } from "@/lib/constants";
import {
  journalKeys,
  partnerKeys,
  goodKeys,
  documentKeys,
} from "@/lib/queryKeys";

// ✅ CORRECTED: Use namespace imports for clarity and to avoid conflicts.
import * as partnerService from "@/services/clientPartnerService";
import * as goodService from "@/services/clientGoodService";
import * as journalService from "@/services/clientJournalService";
import * as documentService from "@/services/clientDocumentService";

// ✅ CORRECTED: Import all necessary types from their definitive source files.
import {
  PartnerClient,
  GoodClient,
  DocumentClient,
  JournalClient,
  PaginatedResponse,
} from "@/lib/types/models.client";
import type { SliderType, AccountNodeData } from "@/lib/types/ui";
import {
  GetAllItemsOptions,
  GetAllDocumentsOptions,
  IntersectionFindOptions,
} from "@/lib/types/serviceOptions";
import { FetchPartnersParams } from "@/services/clientPartnerService";

// ✅ OPTIMIZATION: Strategic stale times based on data volatility
const STALE_TIMES = {
  JOURNALS: 30 * 60 * 1000,    // 30 min - journals rarely change
  PARTNERS: 10 * 60 * 1000,    // 10 min - partners semi-stable  
  GOODS: 5 * 60 * 1000,        // 5 min - goods more dynamic
  DOCUMENTS: 1 * 60 * 1000,    // 1 min - documents frequently updated
} as const;

/**
 * Mapper to ensure a consistent Journal data shape for the UI.
 */
const mapJournalToAccountNode = (journal: JournalClient): AccountNodeData => ({
  id: journal.id,
  name: journal.name,
  code: journal.id,
  children: [],
  isTerminal: journal.isTerminal ?? true,
});

type ChainedQueryReturnType<T extends SliderType> =
  T extends typeof SLIDER_TYPES.JOURNAL
    ? PaginatedResponse<AccountNodeData>
    : T extends typeof SLIDER_TYPES.PARTNER
    ? PaginatedResponse<PartnerClient>
    : T extends typeof SLIDER_TYPES.GOODS
    ? PaginatedResponse<GoodClient>
    : T extends typeof SLIDER_TYPES.DOCUMENT
    ? PaginatedResponse<DocumentClient>
    : PaginatedResponse<unknown>;

/**
 * A centralized, state-aware hook that constructs the correct TanStack Query options
 * for any given slider based on its position and the selections in preceding sliders.
 */
export const useChainedQuery = <T extends SliderType>(
  sliderType: T
): UseQueryOptions<ChainedQueryReturnType<T>, Error> => {
  const { sliderOrder, visibility, documentCreationState } = useAppStore(
    (state) => state.ui
  );
  const {
    effectiveJournalIds,
    journal: journalSelection,
    partner: selectedPartnerId,
    good: selectedGoodId,
    document: selectedDocumentId,
  } = useAppStore((state) => state.selections);
  const effectiveRestrictedJournalId = useAppStore((state) => state.effectiveRestrictedJournalId);

  const { isCreating, selectedPartnerIds, selectedGoodIds } = documentCreationState;
  
  // In creation mode, ignore document selections to prevent filtering subsequent sliders
  const effectiveDocumentId = isCreating ? null : selectedDocumentId;

  const queryOpts = useMemo(() => {
    const visibleOrder = sliderOrder.filter((id) => visibility[id]);
    const myIndex = visibleOrder.indexOf(sliderType);
    const documentIndex = visibleOrder.indexOf(SLIDER_TYPES.DOCUMENT);
    
    // DEBUG: Log creation mode context for Partner/Goods sliders
    if ((sliderType === SLIDER_TYPES.PARTNER || sliderType === SLIDER_TYPES.GOODS) && isCreating) {
      console.log(`🔍 [useChainedQuery] Creation mode context for ${sliderType}:`, {
        isCreating,
        visibleOrder,
        myIndex,
        documentIndex,
        hasDocumentDependency: documentIndex !== -1 && documentIndex < myIndex,
        effectiveDocumentId,
        selectedDocumentId
      });
    }

    if (myIndex === -1) {
      return queryOptions({
        queryKey: [sliderType, "disabled"],
        queryFn: async () => ({ data: [], totalCount: 0 }),
        enabled: false,
      });
    }

    // Document creation mode: disable document slider during creation
    if (isCreating && sliderType === SLIDER_TYPES.DOCUMENT) {
      return queryOptions({
        queryKey: [sliderType, "disabled_in_creation_mode"],
        queryFn: async () => ({ data: [], totalCount: 0 }),
        enabled: false,
      });
    }

    const journalIndex = visibleOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const partnerIndex = visibleOrder.indexOf(SLIDER_TYPES.PARTNER);
    const goodsIndex = visibleOrder.indexOf(SLIDER_TYPES.GOODS);

    // ✅ OPTIMIZATION: Check if any preceding slider is empty (except for document dependencies)
    const checkPrecedingSliderEmpty = (precedingIndex: number, precedingType: SliderType): boolean => {
      if (precedingIndex === -1 || precedingIndex >= myIndex) return false;
      
      // Special case: If document is before this slider, we check document selection
      if (precedingType === SLIDER_TYPES.DOCUMENT) {
        return !effectiveDocumentId;
      }
      
      // For other sliders, check their selections
      switch (precedingType) {
        case SLIDER_TYPES.JOURNAL:
          return effectiveJournalIds.length === 0 || journalSelection.rootFilter.length === 0;
        case SLIDER_TYPES.PARTNER:
          return !selectedPartnerId && selectedPartnerIds.length === 0;
        case SLIDER_TYPES.GOODS:
          return !selectedGoodId && selectedGoodIds.length === 0;
        default:
          return false;
      }
    };

    // ✅ OPTIMIZATION: For D->J->P->G pattern, only check document dependency, not sequential dependencies
    const hasDocumentDependency = documentIndex !== -1 && documentIndex < myIndex;
    
    // If document comes before this slider and is empty, disable (except for journal which can work without document)
    // BUT: During document creation mode, allow Partner/Goods sliders to populate with available options
    if (hasDocumentDependency && !effectiveDocumentId && sliderType !== SLIDER_TYPES.JOURNAL && !isCreating) {
      console.log(`🚫 [useChainedQuery] Disabling ${sliderType} due to empty document dependency (standard mode)`);
      return queryOptions({
        queryKey: [sliderType, "disabled_empty_document"],
        queryFn: async () => ({ data: [], totalCount: 0 }),
        enabled: false,
      });
    }
    
    // DEBUG: Log when we bypass document dependency during creation
    if (hasDocumentDependency && !effectiveDocumentId && isCreating && sliderType !== SLIDER_TYPES.JOURNAL) {
      console.log(`✅ [useChainedQuery] Bypassing document dependency for ${sliderType} during creation mode`);
    }
    
    // ✅ OPTIMIZATION: For sequential dependencies (non-document), check if previous slider is empty
    if (!hasDocumentDependency) {
      // Find the immediately preceding slider in the order
      const precedingSliders = visibleOrder.slice(0, myIndex);
      for (let i = precedingSliders.length - 1; i >= 0; i--) {
        const precedingType = precedingSliders[i];
        if (precedingType !== SLIDER_TYPES.DOCUMENT && checkPrecedingSliderEmpty(i, precedingType)) {
          return queryOptions({
            queryKey: [sliderType, "disabled_empty_preceding", precedingType],
            queryFn: async () => ({ data: [], totalCount: 0 }),
            enabled: false,
          });
        }
      }
    }

    switch (sliderType) {
      case SLIDER_TYPES.JOURNAL:
        // Handle document filtering first (for standard mode only)
        if (documentIndex < myIndex && effectiveDocumentId) {
          return queryOptions({
            queryKey: journalKeys.flatListByDocument(effectiveDocumentId),
            queryFn: async () => {
              const flatJournals = await journalService.fetchJournalsForDocument(
                effectiveDocumentId
              );
              const data = flatJournals.map(mapJournalToAccountNode);
              return { data, totalCount: data.length };
            },
            enabled: !!effectiveDocumentId,
            staleTime: STALE_TIMES.JOURNALS,
            select: (data) => ({
              ...data,
              data: data.data.map(journal => ({
                ...journal,
                displayName: `${journal.name} (${journal.code})`,
                isTerminal: journal.isTerminal ?? true
              }))
            }),
          });
        }
        if (goodsIndex < myIndex && selectedGoodId) {
          return queryOptions({
            queryKey: journalKeys.flatListByGood(selectedGoodId),
            queryFn: async () => {
              const flatJournals = await journalService.fetchJournalsForGoods([
                selectedGoodId,
              ]);
              const data = flatJournals.map(mapJournalToAccountNode);
              return { data, totalCount: data.length };
            },
            enabled: !!selectedGoodId,
            staleTime: STALE_TIMES.JOURNALS,
            select: (data) => ({
              ...data,
              data: data.data.map(journal => ({
                ...journal,
                displayName: `${journal.name} (${journal.code})`,
                isTerminal: journal.isTerminal ?? true
              }))
            }),
          });
        }
        if (partnerIndex < myIndex && selectedPartnerId) {
          return queryOptions({
            queryKey: journalKeys.flatListByPartner(selectedPartnerId),
            queryFn: async () => {
              const flatJournals =
                await journalService.fetchJournalsForPartners([
                  selectedPartnerId,
                ]);
              const data = flatJournals.map(mapJournalToAccountNode);
              return { data, totalCount: data.length };
            },
            enabled: !!selectedPartnerId,
            staleTime: STALE_TIMES.JOURNALS,
            select: (data) => ({
              ...data,
              data: data.data.map(journal => ({
                ...journal,
                displayName: `${journal.name} (${journal.code})`,
                isTerminal: journal.isTerminal ?? true
              }))
            }),
          });
        }
        return queryOptions({
          queryKey: journalKeys.hierarchy(effectiveRestrictedJournalId),
          queryFn: async () => {
            const data = await journalService.fetchJournalHierarchy(
              effectiveRestrictedJournalId
            );
            return { data, totalCount: data.length };
          },
          staleTime: STALE_TIMES.JOURNALS,
          select: (data) => ({
            ...data,
            data: data.data.map(journal => ({
              ...journal,
              displayName: journal.name,
              isTerminal: journal.isTerminal ?? true
            }))
          }),
        });

      case SLIDER_TYPES.PARTNER:
        
        // Handle document filtering first (for standard mode only)
        if (documentIndex < myIndex && effectiveDocumentId) {
          return queryOptions({
            queryKey: partnerKeys.listByDocument(effectiveDocumentId),
            queryFn: () => partnerService.fetchPartnersForDocument(effectiveDocumentId),
            enabled: !!effectiveDocumentId,
            staleTime: STALE_TIMES.PARTNERS,
            select: (data) => ({
              ...data,
              data: data.data.map(partner => ({
                ...partner,
                displayName: `${partner.name}`,
                isActive: true // Simplified for now
              }))
            }),
          });
        }
        
        // Handle multiple goods intersection (for J->D->G->P case in creation mode)
        if (goodsIndex < myIndex && isCreating && selectedGoodIds.length > 0) {
          const params: FetchPartnersParams = {
            intersectionOfGoodIds: selectedGoodIds,
            selectedJournalIds: effectiveJournalIds,
          };
          return queryOptions({
            queryKey: partnerKeys.list(params),
            queryFn: () => partnerService.fetchPartners(params),
            enabled: selectedGoodIds.length > 0,
            staleTime: STALE_TIMES.PARTNERS,
            select: (data) => ({
              ...data,
              data: data.data.map(partner => ({
                ...partner,
                displayName: `${partner.name}`,
                isActive: true // Simplified for now
              }))
            }),
          });
        }
        
        if (goodsIndex < myIndex && selectedGoodId) {
          const params: FetchPartnersParams = {
            intersectionOfGoodIds: [selectedGoodId],
            selectedJournalIds: effectiveJournalIds,
          };
          return queryOptions({
            queryKey: partnerKeys.list(params),
            queryFn: () => partnerService.fetchPartners(params),
            enabled: !!selectedGoodId,
            staleTime: STALE_TIMES.PARTNERS,
            select: (data) => ({
              ...data,
              data: data.data.map(partner => ({
                ...partner,
                displayName: `${partner.name}`,
                isActive: true // Simplified for now
              }))
            }),
          });
        }
        
        // Handle journal filtering for partners
        const hasJournalSelections = effectiveJournalIds.length > 0;
        const isJournalBeforePartner = journalIndex < myIndex;
        
        const params: FetchPartnersParams = {};
        
        // Only include journal filtering if we have journal selections AND journal comes before partner
        if (hasJournalSelections && isJournalBeforePartner) {
          // Handle multiple active filter modes - EXCLUDE 'pending' (only for ApprovalCenter)
          const activeFilters = journalSelection.rootFilter.filter(filter => filter !== 'pending');
          
          // Use the properly calculated effectiveJournalIds which supports unlimited levels
          params.selectedJournalIds = effectiveJournalIds;
          
          // Pass all active filter modes for multi-select support (excluding pending)
          if (activeFilters.length > 0) {
            // Use activeFilterModes for new multi-select API, keep filterMode for backward compatibility
            params.activeFilterModes = activeFilters as ('affected' | 'unaffected' | 'inProcess')[];
            // Keep the first filter as filterMode for backward compatibility
            const primaryFilterMode = activeFilters[0];
            if (primaryFilterMode && ['affected', 'unaffected', 'inProcess'].includes(primaryFilterMode)) {
              params.filterMode = primaryFilterMode as 'affected' | 'unaffected' | 'inProcess';
            }
          }
          params.permissionRootId = journalSelection.topLevelId;
          
         
        }
        
        // DEBUG: Log when Partner query is enabled during creation mode
        if (isCreating) {
          console.log(`📊 [useChainedQuery] PARTNER query enabled during creation:`, {
            params,
            hasJournalSelections,
            isJournalBeforePartner,
            effectiveJournalIds,
            visibleOrder
          });
        }
        
        return queryOptions({
          queryKey: partnerKeys.list(params),
          queryFn: () => partnerService.fetchPartners(params),
          // ✅ OPTIMIZATION: More precise enabled condition
          enabled: (() => {
            // If no journal before partner, always enabled
            if (!isJournalBeforePartner) return true;
            
            // If journal before partner, need both selections and filters (excluding 'pending')
            const hasRequiredJournalData = hasJournalSelections && journalSelection.rootFilter.filter(f => f !== 'pending').length > 0;
            
            // Additional check: if we have document dependency, we might still be enabled even without journal
            if (hasDocumentDependency && effectiveDocumentId) return true;
            
            return hasRequiredJournalData;
          })(),
          staleTime: STALE_TIMES.PARTNERS,
          select: (data) => ({
            ...data,
            data: data.data.map(partner => ({
              ...partner,
              displayName: `${partner.name}`,
              isActive: true // Simplified for now
            }))
          }),
        });

      case SLIDER_TYPES.GOODS:
        // Handle document filtering first (for standard mode only)
        if (documentIndex < myIndex && effectiveDocumentId) {
          return queryOptions({
            queryKey: goodKeys.listByDocument(effectiveDocumentId),
            queryFn: () => goodService.findGoodsForDocument(effectiveDocumentId),
            enabled: !!effectiveDocumentId,
            staleTime: STALE_TIMES.GOODS,
            select: (data) => ({
              ...data,
              data: data.data.map(good => ({
                ...good,
                displayName: `${(good as any).description || (good as any).name || 'Good'}`,
                isActive: true // Simplified for now
              }))
            }),
          });
        }
        
        // Handle multiple partners intersection (for J->D->P->G case in creation mode)
        if (partnerIndex < myIndex && isCreating && selectedPartnerIds.length > 0) {
          const params: IntersectionFindOptions = {
            partnerIds: selectedPartnerIds.map(id => BigInt(id)),
            journalIds: effectiveJournalIds,
          };
          return queryOptions({
            queryKey: goodKeys.list({
              where: { intersectionOfPartnerIds: selectedPartnerIds, journalIds: effectiveJournalIds },
            }),
            queryFn: () => goodService.findGoodsForPartners(params),
            enabled: selectedPartnerIds.length > 0,
            staleTime: STALE_TIMES.GOODS,
            select: (data) => ({
              ...data,
              data: data.data.map(good => ({
                ...good,
                displayName: `${(good as any).description || (good as any).name || 'Good'}`,
                isActive: true // Simplified for now
              }))
            }),
          });
        }
        
        if (partnerIndex < myIndex && selectedPartnerId) {
          // Standard mode: Use three-way relationship lookup for single partner + journals
          return queryOptions({
            queryKey: goodKeys.list({
              where: { forPartnerAndJournals: { partnerId: selectedPartnerId, journalIds: effectiveJournalIds } },
            }),
            queryFn: () => goodService.findGoodsForPartnerAndJournals(
              selectedPartnerId,
              effectiveJournalIds
            ),
            enabled: !!selectedPartnerId,
            staleTime: STALE_TIMES.GOODS,
            select: (data) => ({
              ...data,
              data: data.data.map(good => ({
                ...good,
                displayName: `${(good as any).description || (good as any).name || 'Good'}`,
                isActive: true // Simplified for now
              }))
            }),
          });
        }
        // Handle journal filtering for goods
        const hasJournalSelectionsForGoods = effectiveJournalIds.length > 0;
        const isJournalBeforeGoods = journalIndex < myIndex;
        
        const goodsParams: GetAllItemsOptions<{}> = {};
        
        // Only include journal filtering if we have journal selections AND journal comes before goods
        if (hasJournalSelectionsForGoods && isJournalBeforeGoods) {
          // Handle multiple active filter modes - EXCLUDE 'pending' (only for ApprovalCenter)
          const activeFilters = journalSelection.rootFilter.filter(filter => filter !== 'pending');
          
          // Use the properly calculated effectiveJournalIds which supports unlimited levels
          goodsParams.selectedJournalIds = effectiveJournalIds;
          
          // Pass all active filter modes for multi-select support (excluding pending)
          if (activeFilters.length > 0) {
            // Use activeFilterModes for new multi-select API, keep filterMode for backward compatibility
            goodsParams.activeFilterModes = activeFilters as ('affected' | 'unaffected' | 'inProcess')[];
            // Keep the first filter as filterMode for backward compatibility
            goodsParams.filterMode = activeFilters[0] as any;
          }
          goodsParams.permissionRootId = journalSelection.topLevelId;
        }
        
        // DEBUG: Log when Goods query is enabled during creation mode
        if (isCreating) {
          console.log(`📊 [useChainedQuery] GOODS query enabled during creation:`, {
            goodsParams,
            hasJournalSelectionsForGoods,
            isJournalBeforeGoods,
            effectiveJournalIds,
            visibleOrder
          });
        }
        
        return queryOptions({
          queryKey: goodKeys.list(goodsParams),
          queryFn: () => goodService.getAllGoods(goodsParams),
          // ✅ OPTIMIZATION: More precise enabled condition
          enabled: (() => {
            // If no journal before goods, always enabled
            if (!isJournalBeforeGoods) return true;
            
            // If journal before goods, need both selections and filters (excluding 'pending')
            const hasRequiredJournalData = hasJournalSelectionsForGoods && journalSelection.rootFilter.filter(f => f !== 'pending').length > 0;
            
            // Additional check: if we have document dependency, we might still be enabled even without journal
            if (hasDocumentDependency && effectiveDocumentId) return true;
            
            return hasRequiredJournalData;
          })(),
          staleTime: STALE_TIMES.GOODS,
          select: (data) => ({
            ...data,
            data: data.data.map(good => ({
              ...good,
              displayName: `${(good as any).description || (good as any).name || 'Good'}`,
              isActive: true // Simplified for now
            }))
          }),
        });

      case SLIDER_TYPES.DOCUMENT:
        const docParams: GetAllDocumentsOptions = {
          filterByJournalIds:
            journalIndex < myIndex && effectiveJournalIds.length > 0
              ? effectiveJournalIds
              : undefined,
          filterByPartnerIds:
            partnerIndex < myIndex && selectedPartnerId
              ? [selectedPartnerId]
              : undefined,
          filterByGoodIds:
            goodsIndex < myIndex && selectedGoodId
              ? [selectedGoodId]
              : undefined,
        };
        const hasFilters =
          !!docParams.filterByJournalIds ||
          !!docParams.filterByPartnerIds ||
          !!docParams.filterByGoodIds;
        
        // When Document is in first position, enable query to show all user-accessible documents
        const isDocumentFirst = myIndex === 0;
        
        return queryOptions({
          queryKey: documentKeys.list(docParams),
          queryFn: () => documentService.getAllDocuments(docParams),
          // ✅ OPTIMIZATION: More precise enabled condition
          enabled: (() => {
            // If document is first in order, always enabled to show all accessible documents
            if (isDocumentFirst) return true;
            
            // If we have any filters, enabled
            if (hasFilters) return true;
            
            // Otherwise disabled to avoid unnecessary queries
            return false;
          })(),
          staleTime: STALE_TIMES.DOCUMENTS,
          select: (data) => ({
            ...data,
            data: data.data.map(document => ({
              ...document,
              displayName: `Document ${document.id}`,
              isApproved: true // Simplified for now
            }))
          }),
        });

      default:
        return queryOptions({
          queryKey: [sliderType, "unhandled"],
          queryFn: async () => ({ data: [], totalCount: 0 }),
          enabled: false,
        });
    }
  }, [
    sliderType,
    sliderOrder,
    visibility,
    isCreating,
    effectiveJournalIds,
    journalSelection,
    JSON.stringify(journalSelection.rootFilter.filter(f => f !== 'pending')), // Exclude 'pending' from dependencies
    journalSelection.topLevelId,
    journalSelection.level2Ids.length, // Track array length changes
    journalSelection.level3Ids.length,
    selectedPartnerId,
    selectedPartnerIds,
    selectedGoodId,
    selectedGoodIds,
    selectedDocumentId,
    effectiveRestrictedJournalId,
  ]);


  // ✅ FIX: Cast to `unknown` first to resolve the complex type inference error.
  // This is a standard and safe pattern for this specific TanStack Query + useMemo scenario.
  return queryOpts as unknown as UseQueryOptions<
    ChainedQueryReturnType<T>,
    Error
  >;
};
