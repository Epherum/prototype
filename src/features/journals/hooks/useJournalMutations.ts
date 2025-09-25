// src/features/journals/hooks/useJournalMutations.ts
import { useState, useCallback } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { journalKeys } from "@/lib/queryKeys";
import {
  createJournal as createJournalApi,
  deleteJournal as deleteJournalApi,
} from "@/services/clientJournalService";
import {
  createLoop,
  updateLoop,
} from "@/services/clientLoopService";
import { useToast } from "@/contexts/ToastContext";
import type { CreateJournalData } from "@/app/services/journalService";
import type { JournalClient } from "@/lib/types/models.client";
import type { LoopIntegrationData } from "../components/LoopIntegrationSection";

interface MutationProps {
  restrictedJournalId: string | null;
  resetJournalSelections: () => void;
}

export const useJournalMutations = ({
  restrictedJournalId,
  resetJournalSelections,
}: MutationProps) => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [isAddJournalModalOpen, setIsAddJournalModalOpen] = useState(false);
  const [addJournalContext, setAddJournalContext] = useState<any>(null);
  const [isJournalNavModalOpen, setIsJournalNavModalOpen] = useState(false);

  const openAddJournalModal = useCallback((context: any) => {
    setAddJournalContext(context);
    setIsAddJournalModalOpen(true);
  }, []);
  const closeAddJournalModal = useCallback(
    () => setIsAddJournalModalOpen(false),
    []
  );
  const openJournalNavModal = useCallback(
    () => setIsJournalNavModalOpen(true),
    []
  );
  const closeJournalNavModal = useCallback(
    () => setIsJournalNavModalOpen(false),
    []
  );

  const createJournalMutation = useMutation<
    JournalClient,
    Error,
    CreateJournalData
  >({
    mutationFn: createJournalApi,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: journalKeys.hierarchy(restrictedJournalId),
      });
      closeAddJournalModal();
      success("Journal Created", `Journal "${data.name}" has been created successfully.`);
    },
    onError: (err) => {
      error("Create Failed", err.message || "Failed to create journal. Please try again.");
    },
  });

  const deleteJournalMutation = useMutation<{ message: string }, Error, string>(
    {
      mutationFn: deleteJournalApi,
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: journalKeys.hierarchy(restrictedJournalId),
        });
        resetJournalSelections(); // Use the passed-in reset function
        success("Journal Deleted", data.message || "Journal has been deleted successfully.");
      },
      onError: (err) => {
        error("Delete Failed", err.message || "Failed to delete journal. Please try again.");
      },
    }
  );

  const createJournal = useCallback(
    async (formData: any) => {
      try {
        // First create the journal
        const journalData: CreateJournalData = {
          id: formData.code,
          name: formData.name,
          parentId: addJournalContext?.parentId,
        };

        // Create the journal
        const createdJournal = await createJournalApi(journalData);

        // Handle loop integration if provided
        const loopIntegration: LoopIntegrationData | null = formData.loopIntegration;
        if (loopIntegration) {
          if (loopIntegration.newLoop) {
            // Create new loop with this journal
            const journalIds = [createdJournal.id];

            // Add forward and backward connections if specified
            if (loopIntegration.forwardToJournalId && loopIntegration.backwardFromJournalId) {
              // Create a loop with 3 journals including the new one
              journalIds.unshift(loopIntegration.backwardFromJournalId);
              journalIds.push(loopIntegration.forwardToJournalId);
            } else if (loopIntegration.forwardToJournalId) {
              journalIds.push(loopIntegration.forwardToJournalId);
              // Add one more journal to meet minimum requirement if needed
              if (journalIds.length === 2) {
                // Need at least 3 journals, use a placeholder or ask user
                throw new Error("A loop requires at least 3 journals. Please specify both forward and backward connections or additional journals.");
              }
            } else if (loopIntegration.backwardFromJournalId) {
              journalIds.unshift(loopIntegration.backwardFromJournalId);
              // Add one more journal to meet minimum requirement if needed
              if (journalIds.length === 2) {
                throw new Error("A loop requires at least 3 journals. Please specify both forward and backward connections or additional journals.");
              }
            } else {
              // Just the new journal, need 2 more to create loop
              throw new Error("Creating a new loop requires at least 3 journals. Please specify forward and backward connections.");
            }

            await createLoop({
              name: loopIntegration.newLoop.name,
              description: loopIntegration.newLoop.description,
              journalIds: journalIds,
            });

          } else if (loopIntegration.loopId) {
            // Add journal to existing loop
            const journalIds = [createdJournal.id];

            // Add connection specifications if provided
            if (loopIntegration.forwardToJournalId) {
              journalIds.push(loopIntegration.forwardToJournalId);
            }
            if (loopIntegration.backwardFromJournalId) {
              journalIds.unshift(loopIntegration.backwardFromJournalId);
            }

            // Update the existing loop to include the new journal
            await updateLoop(loopIntegration.loopId, {
              journalIds: journalIds, // This will need to be handled by the API to merge with existing
            });
          }
        }

        // Invalidate queries and show success
        queryClient.invalidateQueries({
          queryKey: journalKeys.hierarchy(restrictedJournalId),
        });
        closeAddJournalModal();

        const successMessage = loopIntegration
          ? `Journal "${createdJournal.name}" has been created and integrated into the loop successfully.`
          : `Journal "${createdJournal.name}" has been created successfully.`;

        success("Journal Created", successMessage);

      } catch (err: any) {
        error("Create Failed", err.message || "Failed to create journal. Please try again.");
      }
    },
    [addJournalContext, queryClient, restrictedJournalId, closeAddJournalModal, success, error]
  );

  const deleteJournal = useCallback(
    (journalId: string) => {
      deleteJournalMutation.mutate(journalId);
    },
    [deleteJournalMutation]
  );

  return {
    isAddJournalModalOpen,
    addJournalContext,
    openAddJournalModal,
    closeAddJournalModal,
    isJournalNavModalOpen,
    openJournalNavModal,
    closeJournalNavModal,
    createJournal,
    isCreatingJournal: createJournalMutation.isPending,
    deleteJournal,
    isDeletingJournal: deleteJournalMutation.isPending,
  };
};
