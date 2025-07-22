// src/features/journals/hooks/useJournalData.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChainedQuery } from "@/hooks/useChainedQuery";
import { SLIDER_TYPES } from "@/lib/constants";
import type { AccountNodeData, Journal } from "@/lib/types";

export const useJournalData = (isJournalSliderPrimary: boolean) => {
  const journalQueryOptions = useChainedQuery(SLIDER_TYPES.JOURNAL);
  const journalQuery = useQuery(journalQueryOptions);

  const isHierarchyMode = useMemo(() => {
    const queryKey = journalQueryOptions.queryKey || [];
    // The query key itself tells us which mode we are in.
    return (
      isJournalSliderPrimary &&
      (queryKey.includes("hierarchy") || queryKey[0] === "journalHierarchy")
    );
  }, [journalQueryOptions.queryKey, isJournalSliderPrimary]);

  const hierarchyData = useMemo(() => {
    return isHierarchyMode
      ? (journalQuery.data?.data as AccountNodeData[]) || []
      : [];
  }, [journalQuery.data, isHierarchyMode]);

  const flatJournalData = useMemo(() => {
    return !isHierarchyMode ? (journalQuery.data?.data as Journal[]) || [] : [];
  }, [journalQuery.data, isHierarchyMode]);

  return {
    isHierarchyMode,
    hierarchyData,
    flatJournalData,
    isLoading: journalQuery.isLoading,
    isError: journalQuery.isError,
    error: journalQuery.error,
  };
};
