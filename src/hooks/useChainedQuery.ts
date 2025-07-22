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
import type {
  SliderType,
  PaginatedPartnersResponse,
  PaginatedGoodsResponse,
  PaginatedDocumentsResponse,
  // ✅ 1. IMPORT the new consistent response type for Journals
  PaginatedJournalResponse,
} from "@/lib/types";

// Import ALL data-fetching functions
import {
  fetchPartners,
  getPartnersForGoods,
} from "@/services/clientPartnerService";
import { fetchGoods, getGoodsForPartners } from "@/services/clientGoodService";
import {
  fetchJournalHierarchy,
  fetchJournalsLinkedToGood,
  fetchJournalsLinkedToPartner,
} from "@/services/clientJournalService";
import { fetchDocuments } from "@/services/clientDocumentService";

// ✅ 2. UPDATE the conditional return type to use the consistent Journal response type
type ChainedQueryReturnType<T extends SliderType> =
  T extends typeof SLIDER_TYPES.JOURNAL
    ? PaginatedJournalResponse // This was the source of the error
    : T extends typeof SLIDER_TYPES.PARTNER
    ? PaginatedPartnersResponse
    : T extends typeof SLIDER_TYPES.GOODS
    ? PaginatedGoodsResponse
    : T extends typeof SLIDER_TYPES.DOCUMENT
    ? PaginatedDocumentsResponse
    : unknown;

export const useChainedQuery = <T extends SliderType>(
  sliderType: T
): UseQueryOptions<ChainedQueryReturnType<T>, Error> => {
  const ui = useAppStore((state) => state.ui);
  const selections = useAppStore((state) => state.selections);
  const auth = useAppStore((state) => state.auth);

  const { sliderOrder, visibility, documentCreationState } = ui;
  const { isCreating, mode, lockedPartnerIds, lockedGoodIds } =
    documentCreationState;
  const { effectiveRestrictedJournalId } = auth;
  const { effectiveJournalIds } = selections;

  const queryOpts = useMemo(() => {
    const visibleOrder = sliderOrder.filter((id) => visibility[id]);
    const myIndex = visibleOrder.indexOf(sliderType);

    if (myIndex === -1) {
      return queryOptions({
        queryKey: [sliderType, "disabled"],
        queryFn: async () => ({ data: [], total: 0 }), // Return consistent shape
        enabled: false,
      });
    }

    if (isCreating) {
      const creationJournalContextId =
        selections.journal.level3Ids[0] ??
        selections.journal.level2Ids[0] ??
        selections.journal.flatId ??
        selections.journal.topLevelId;

      switch (sliderType) {
        case SLIDER_TYPES.PARTNER:
          if (
            (mode === "INTERSECT_FROM_GOOD" || mode === "LOCK_GOOD") &&
            lockedGoodIds.length > 0
          ) {
            return queryOptions({
              queryKey: partnerKeys.list({
                forGoodsIntersection: lockedGoodIds,
                journalId: creationJournalContextId,
              }),
              queryFn: () =>
                getPartnersForGoods(lockedGoodIds, creationJournalContextId!),
              enabled: !!creationJournalContextId,
              staleTime: Infinity,
            });
          }
          break;
        case SLIDER_TYPES.GOODS:
          if (mode === "LOCK_PARTNER" && lockedPartnerIds.length > 0) {
            return queryOptions({
              queryKey: goodKeys.list({
                forPartnerId: lockedPartnerIds[0],
                forJournalIds: [creationJournalContextId],
              }),
              queryFn: () =>
                fetchGoods({
                  forPartnerId: lockedPartnerIds[0],
                  forJournalIds: [creationJournalContextId],
                  includeJournalChildren: true,
                }),
              enabled: !!creationJournalContextId,
              staleTime: Infinity,
            });
          }
          if (
            mode === "INTERSECT_FROM_PARTNER" &&
            lockedPartnerIds.length > 0
          ) {
            return queryOptions({
              queryKey: goodKeys.list({
                forPartnersIntersection: lockedPartnerIds,
                journalId: creationJournalContextId,
              }),
              queryFn: () =>
                getGoodsForPartners(
                  lockedPartnerIds,
                  creationJournalContextId!
                ),
              enabled: !!creationJournalContextId,
              staleTime: Infinity,
            });
          }
          break;
        case SLIDER_TYPES.DOCUMENT:
          return queryOptions({
            queryKey: documentKeys.list("CREATION_MODE"),
            queryFn: async () => ({ data: [], total: 0 }), // Return consistent shape
            enabled: false,
          });
      }
    }

    const journalIndex = visibleOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const partnerIndex = visibleOrder.indexOf(SLIDER_TYPES.PARTNER);
    const goodsIndex = visibleOrder.indexOf(SLIDER_TYPES.GOODS);

    switch (sliderType) {
      // ✅ 3. WRAP all Journal query functions to return the consistent object shape
      case SLIDER_TYPES.JOURNAL: {
        // ✅ START: REORDERED AND CORRECTED LOGIC
        // This is the primary case: If the Journal slider is first in the visible order,
        // it must fetch the full hierarchy.
        if (myIndex === 0) {
          return queryOptions({
            queryKey: journalKeys.hierarchy(effectiveRestrictedJournalId),
            queryFn: async () => {
              const hierarchy = await fetchJournalHierarchy(
                effectiveRestrictedJournalId
              );
              return { data: hierarchy, total: hierarchy.length };
            },
            enabled: true,
          });
        }

        // Case for being filtered by Goods:
        if (goodsIndex < myIndex && selections.goods) {
          return queryOptions({
            queryKey: journalKeys.flatListByGood(selections.goods),
            queryFn: async () => {
              const journals = await fetchJournalsLinkedToGood(
                selections.goods!
              );
              return { data: journals, total: journals.length };
            },
            enabled: !!selections.goods,
          });
        }

        // Case for being filtered by Partners:
        if (partnerIndex < myIndex && selections.partner) {
          return queryOptions({
            queryKey: journalKeys.flatListByPartner(selections.partner),
            queryFn: async () => {
              const journals = await fetchJournalsLinkedToPartner(
                selections.partner!
              );
              return { data: journals, total: journals.length };
            },
            enabled: !!selections.partner,
          });
        }

        // Fallback case (should ideally not be hit with the explicit myIndex === 0 check, but safe to have)
        // This will fetch the hierarchy if it's not first and not filtered, which is a reasonable default.
        return queryOptions({
          queryKey: journalKeys.hierarchy(effectiveRestrictedJournalId),
          queryFn: async () => {
            const hierarchy = await fetchJournalHierarchy(
              effectiveRestrictedJournalId
            );
            return { data: hierarchy, total: hierarchy.length };
          },
          enabled: true,
        });
        // ✅ END: REORDERED AND CORRECTED LOGIC
      }
      case SLIDER_TYPES.PARTNER: {
        const baseParams: Record<string, any> = {
          restrictedJournalId: effectiveRestrictedJournalId,
        };
        // 🔧 MODIFIED: Use the new authoritative IDs.
        if (journalIndex < myIndex) {
          baseParams.forJournalIds = effectiveJournalIds;
        }
        if (goodsIndex < myIndex && selections.goods) {
          const params = {
            forGoodsIntersection: [selections.goods],
            // Use the first effective ID as the context, or fallback.
            journalId: effectiveJournalIds[0],
            ...baseParams,
          };
          return queryOptions({
            queryKey: partnerKeys.list(params),
            queryFn: () =>
              getPartnersForGoods([selections.goods!], effectiveJournalIds[0]),
            // 🔧 MODIFIED: The query is enabled only if we have effective IDs.
            enabled: !!selections.goods && effectiveJournalIds.length > 0,
          });
        }
        return queryOptions({
          queryKey: partnerKeys.list(baseParams),
          queryFn: () => fetchPartners(baseParams),
          // 🔧 MODIFIED: The query is enabled only if we have effective IDs.
          enabled:
            journalIndex < myIndex ? effectiveJournalIds.length > 0 : true,
        });
      }
      case SLIDER_TYPES.GOODS: {
        const baseParams: Record<string, any> = {
          restrictedJournalId: effectiveRestrictedJournalId,
        };
        // 🔧 MODIFIED: Use the new authoritative IDs.
        if (journalIndex < myIndex) {
          baseParams.forJournalIds = effectiveJournalIds;
        }
        if (partnerIndex < myIndex && selections.partner) {
          const params = { ...baseParams, forPartnerId: selections.partner };
          return queryOptions({
            queryKey: goodKeys.list(params),
            queryFn: () => fetchGoods(params),
            // 🔧 MODIFIED: The query is enabled only if we have effective IDs.
            enabled:
              !!selections.partner &&
              (journalIndex < myIndex ? effectiveJournalIds.length > 0 : true),
          });
        }
        return queryOptions({
          queryKey: goodKeys.list(baseParams),
          queryFn: () => fetchGoods(baseParams),
          // 🔧 MODIFIED: The query is enabled only if we have effective IDs.
          enabled:
            journalIndex < myIndex ? effectiveJournalIds.length > 0 : true,
        });
      }
      case SLIDER_TYPES.DOCUMENT: {
        return queryOptions({
          queryKey: documentKeys.list(selections.partner),
          queryFn: () => fetchDocuments(selections.partner!),
          enabled: !isCreating && !!selections.partner,
        });
      }
      default:
        return queryOptions({
          queryKey: [sliderType, "unhandled"],
          queryFn: async () => ({ data: [], total: 0 }), // Return consistent shape
          enabled: false,
        });
    }
  }, [ui, selections, auth, sliderType]);

  return queryOpts as unknown as UseQueryOptions<
    ChainedQueryReturnType<T>,
    Error
  >;
};
