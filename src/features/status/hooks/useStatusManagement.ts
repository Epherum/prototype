// src/features/status/hooks/useStatusManagement.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getAllStatuses, 
  createStatus, 
  updateStatus, 
  deleteStatus,
  getStatusUsage,
  type StatusFormData,
  type StatusUsage
} from "@/services/clientStatusService";

export const useStatusManagement = () => {
  const queryClient = useQueryClient();

  // Query for fetching all statuses
  const {
    data: statuses,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["statuses"],
    queryFn: getAllStatuses,
  });

  // Mutation for creating a new status
  const createStatusMutation = useMutation({
    mutationFn: createStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statuses"] });
    },
  });

  // Mutation for updating a status
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<StatusFormData> & Pick<StatusFormData, 'name'>) =>
      updateStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statuses"] });
    },
  });

  // Mutation for deleting a status
  const deleteStatusMutation = useMutation({
    mutationFn: deleteStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statuses"] });
    },
  });

  // Function to check status usage before deletion
  const checkStatusUsage = async (statusId: string): Promise<StatusUsage> => {
    return await getStatusUsage(statusId);
  };

  return {
    // Data
    statuses,
    isLoading,
    error,
    
    // Mutations
    createStatus: createStatusMutation,
    updateStatus: updateStatusMutation,
    deleteStatus: deleteStatusMutation,
    
    // Loading states
    isCreating: createStatusMutation.isPending,
    isUpdating: updateStatusMutation.isPending,
    isDeleting: deleteStatusMutation.isPending,
    
    // Utility functions
    checkStatusUsage,
  };
};