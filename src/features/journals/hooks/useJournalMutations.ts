// src/features/journals/hooks/useJournalMutations.ts
import { useState, useCallback } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { journalKeys } from "@/lib/queryKeys";
import {
  createJournal as createJournalApi,
  deleteJournal as deleteJournalApi,
} from "@/services/clientJournalService";
import type { CreateJournalData } from "@/app/services/journalService";
import type { JournalClient } from "@/lib/types/models.client";

interface MutationProps {
  restrictedJournalId: string | null;
  resetJournalSelections: () => void;
}

export const useJournalMutations = ({
  restrictedJournalId,
  resetJournalSelections,
}: MutationProps) => {
  const queryClient = useQueryClient();

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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: journalKeys.hierarchy(restrictedJournalId),
      });
      closeAddJournalModal();
    },
  });

  const deleteJournalMutation = useMutation<{ message: string }, Error, string>(
    {
      mutationFn: deleteJournalApi,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: journalKeys.hierarchy(restrictedJournalId),
        });
        resetJournalSelections(); // Use the passed-in reset function
      },
    }
  );

  const createJournal = useCallback(
    (formData: any) => {
      createJournalMutation.mutate({
        id: formData.code,
        name: formData.name,
        parentId: addJournalContext?.parentId,
      });
    },
    [addJournalContext, createJournalMutation]
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
