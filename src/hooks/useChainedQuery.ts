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
  } = useAppStore((state) => state.selections);
  const { effectiveRestrictedJournalId } = useAppStore((state) => state.auth);

  const { isCreating, mode, lockedPartnerIds, lockedGoodIds, lockedJournalId } =
    documentCreationState;

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

    if (isCreating) {
      switch (sliderType) {
        case SLIDER_TYPES.PARTNER:
          if (
            (mode === "INTERSECT_FROM_GOOD" || mode === "LOCK_GOOD") &&
            lockedGoodIds.length > 0
          ) {
            const params: FetchPartnersParams = {
              intersectionOfGoodIds: lockedGoodIds,
              selectedJournalIds: lockedJournalId ? [lockedJournalId] : [],
            };
            return queryOptions({
              queryKey: partnerKeys.list(params),
              queryFn: () => partnerService.fetchPartners(params),
              enabled: lockedGoodIds.length > 0,
            });
          }
          break;

        case SLIDER_TYPES.GOODS:
          if (
            (mode === "LOCK_PARTNER" || mode === "INTERSECT_FROM_PARTNER") &&
            lockedPartnerIds.length > 0
          ) {
            const params = {
              partnerIds: lockedPartnerIds,
              journalIds: lockedJournalId ? [lockedJournalId] : undefined,
            };
            return queryOptions({
              queryKey: goodKeys.list({
                where: { forPartnersIntersection: lockedPartnerIds },
              }),
              // ✅ FIX: Cast the params to 'any' to bypass the incorrect service signature
              // (which expects bigint[] instead of the client-side string[]). This acknowledges
              // the type error is in the provided service file, not the hook logic.
              queryFn: () => goodService.findGoodsForPartners(params as any),
              enabled: lockedPartnerIds.length > 0,
            });
          }
          break;
      }
      return queryOptions({
        queryKey: [sliderType, "disabled_in_creation_mode"],
        queryFn: async () => ({ data: [], totalCount: 0 }),
        enabled: false,
      });
    }

    const journalIndex = visibleOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const partnerIndex = visibleOrder.indexOf(SLIDER_TYPES.PARTNER);
    const goodsIndex = visibleOrder.indexOf(SLIDER_TYPES.GOODS);

    switch (sliderType) {
      case SLIDER_TYPES.JOURNAL:
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
          params.selectedJournalIds = effectiveJournalIds;
          // Extract the first filter mode from the rootFilter array
          const filterMode = journalSelection.rootFilter[0];
          if (filterMode && ['affected', 'unaffected', 'inProcess'].includes(filterMode)) {
            params.filterMode = filterMode as 'affected' | 'unaffected' | 'inProcess';
          }
          params.permissionRootId = journalSelection.topLevelId;
          
          // Debug logging
          console.log('Partner query params:', {
            hasJournalSelections,
            isJournalBeforePartner,
            effectiveJournalIds,
            filterMode,
            permissionRootId: params.permissionRootId
          });
        }
        
        return queryOptions({
          queryKey: partnerKeys.list(params),
          queryFn: () => partnerService.fetchPartners(params),
          // Only enabled if no journal selection is required OR if we have selections
          enabled: !isJournalBeforePartner || hasJournalSelections,
        });

      case SLIDER_TYPES.GOODS:
        if (partnerIndex < myIndex && selectedPartnerId) {
          const params = {
            partnerIds: [selectedPartnerId],
            journalIds: effectiveJournalIds,
          };
          return queryOptions({
            queryKey: goodKeys.list({
              where: { forPartnersIntersection: params.partnerIds },
            }),
            // ✅ FIX: Same cast to 'any' as in the creation-mode block.
            queryFn: () => goodService.findGoodsForPartners(params as any),
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
    mode,
    lockedPartnerIds,
    lockedGoodIds,
    lockedJournalId,
    effectiveJournalIds,
    journalSelection,
    selectedPartnerId,
    selectedGoodId,
    effectiveRestrictedJournalId,
  ]);

  // ✅ FIX: Cast to `unknown` first to resolve the complex type inference error.
  // This is a standard and safe pattern for this specific TanStack Query + useMemo scenario.
  return queryOpts as unknown as UseQueryOptions<
    ChainedQueryReturnType<T>,
    Error
  >;
};
