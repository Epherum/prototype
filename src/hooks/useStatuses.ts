// src/hooks/useStatuses.ts

import { useQuery } from "@tanstack/react-query";
import { getAllStatuses, type Status } from "@/services/clientStatusService";

export const useStatuses = () => {
  const {
    data: statuses,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["statuses"],
    queryFn: getAllStatuses,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Helper to get status by ID
  const getStatusById = (id: string): Status | undefined => {
    return statuses?.find(status => status.id === id);
  };

  // Helper to get default status
  const getDefaultStatus = (): Status | undefined => {
    return statuses?.find(status => status.isDefault);
  };

  // Sort statuses by display order
  const sortedStatuses = statuses?.sort((a, b) => {
    const orderA = a.displayOrder ?? 999;
    const orderB = b.displayOrder ?? 999;
    return orderA - orderB;
  });

  return {
    statuses: sortedStatuses,
    isLoading,
    error,
    getStatusById,
    getDefaultStatus,
  };
};