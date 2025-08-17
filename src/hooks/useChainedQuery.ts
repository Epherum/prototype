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
    const documentIndex = visibleOrder.indexOf(SLIDER_TYPES.DOCUMENT);

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
        });

      case SLIDER_TYPES.PARTNER:
        
        // Handle document filtering first (for standard mode only)
        if (documentIndex < myIndex && effectiveDocumentId) {
          return queryOptions({
            queryKey: partnerKeys.listByDocument(effectiveDocumentId),
            queryFn: () => partnerService.fetchPartnersForDocument(effectiveDocumentId),
            enabled: !!effectiveDocumentId,
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
          });
        }
        
        // Handle journal filtering for partners
        const hasJournalSelections = effectiveJournalIds.length > 0;
        const isJournalBeforePartner = journalIndex < myIndex;
        
        const params: FetchPartnersParams = {};
        
        // Only include journal filtering if we have journal selections AND journal comes before partner
        if (hasJournalSelections && isJournalBeforePartner) {
          // Handle multiple filter modes - for now, use the first one but ensure all are included in query key
          const activeFilters = journalSelection.rootFilter;
          const primaryFilterMode = activeFilters[0];
          
          if (primaryFilterMode === 'affected') {
            // For affected mode, we need only the terminal (deepest) journals
            // If level3Ids exist, use those; otherwise use level2Ids; otherwise use topLevelId
            const terminalIds = journalSelection.level3Ids.length > 0 
              ? journalSelection.level3Ids
              : journalSelection.level2Ids.length > 0 
                ? journalSelection.level2Ids
                : journalSelection.topLevelId ? [journalSelection.topLevelId] : [];
            params.selectedJournalIds = terminalIds;
          } else {
            // For unaffected and inProcess modes, use the full effective path
            params.selectedJournalIds = effectiveJournalIds;
          }
          
          if (primaryFilterMode && ['affected', 'unaffected', 'inProcess'].includes(primaryFilterMode)) {
            params.filterMode = primaryFilterMode as 'affected' | 'unaffected' | 'inProcess';
          }
          params.permissionRootId = journalSelection.topLevelId;
          
          // Include all filters in params to ensure query key changes when filters change
          params.allFilters = activeFilters;
          
          // Debug logging
          console.log('Partner query params:', {
            hasJournalSelections,
            isJournalBeforePartner,
            allEffectiveIds: effectiveJournalIds,
            selectedJournalIds: params.selectedJournalIds,
            filterMode: params.filterMode,
            allFilters: params.allFilters,
            permissionRootId: params.permissionRootId,
            level2Ids: journalSelection.level2Ids,
            level3Ids: journalSelection.level3Ids
          });
        }
        
        return queryOptions({
          queryKey: partnerKeys.list(params),
          queryFn: () => partnerService.fetchPartners(params),
          // Only enabled if no journal selection is required OR if we have selections
          enabled: !isJournalBeforePartner || hasJournalSelections,
        });

      case SLIDER_TYPES.GOODS:
        // Handle document filtering first (for standard mode only)
        if (documentIndex < myIndex && effectiveDocumentId) {
          return queryOptions({
            queryKey: goodKeys.listByDocument(effectiveDocumentId),
            queryFn: () => goodService.findGoodsForDocument(effectiveDocumentId),
            enabled: !!effectiveDocumentId,
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
          });
        }
        // Handle journal filtering for goods
        const hasJournalSelectionsForGoods = effectiveJournalIds.length > 0;
        const isJournalBeforeGoods = journalIndex < myIndex;
        
        const goodsParams: GetAllItemsOptions<{}> = {};
        
        // Only include journal filtering if we have journal selections AND journal comes before goods
        if (hasJournalSelectionsForGoods && isJournalBeforeGoods) {
          goodsParams.selectedJournalIds = effectiveJournalIds;
          goodsParams.filterMode = journalSelection.rootFilter[0] as any;
          goodsParams.permissionRootId = journalSelection.topLevelId;
        }
        
        return queryOptions({
          queryKey: goodKeys.list(goodsParams),
          queryFn: () => goodService.getAllGoods(goodsParams),
          // Only enabled if no journal selection is required OR if we have selections
          enabled: !isJournalBeforeGoods || hasJournalSelectionsForGoods,
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
        return queryOptions({
          queryKey: documentKeys.list(docParams),
          queryFn: () => documentService.getAllDocuments(docParams),
          enabled: hasFilters,
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
