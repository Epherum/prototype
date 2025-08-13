// src/features/linking/components/LinkPartnerToJournalsModal.tsx
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type { GoodClient } from "@/lib/types/models.client";
import type { AccountNodeData } from "@/lib/types/ui";
import type { CreateJournalGoodLinkPayload } from "@/lib/schemas/journalGoodLink.schema";
import baseStyles from "@/features/shared/components/ModalBase.module.css"; // Assuming shared base styles

// Reusing the CSS module from partner linking for similar structure.
// You can create a dedicated one if distinctions grow.
import linkStyles from "./LinkItemToJournalsModal.module.css";

interface LinkGoodToJournalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitLinks: (linksData: CreateJournalGoodLinkPayload[]) => void;
  goodToLink: GoodClient | null;
  isSubmitting: boolean;
  onOpenJournalSelector: (
    onSelectCallback: (journalNode: AccountNodeData) => void
  ) => void;
}

export default function LinkGoodToJournalsModal({
  isOpen,
  onClose,
  onSubmitLinks,
  goodToLink,
  isSubmitting,
  onOpenJournalSelector,
}: LinkGoodToJournalsModalProps) {
  const [selectedJournals, setSelectedJournals] = useState<AccountNodeData[]>(
    []
  );

  useEffect(() => {
    if (!isOpen || !goodToLink) {
      setSelectedJournals([]);
    }
  }, [isOpen, goodToLink]);

  const handleJournalSelectedBySelector = useCallback(
    (journalNode: AccountNodeData) => {
      setSelectedJournals((prevSelected) => {
        if (prevSelected.find((j) => j.id === journalNode.id)) {
          return prevSelected; // Already selected
        }
        return [...prevSelected, journalNode];
      });
    },
    []
  );

  const handleRemoveJournal = (journalIdToRemove: string) => {
    setSelectedJournals((prevSelected) =>
      prevSelected.filter((j) => j.id !== journalIdToRemove)
    );
  };

  const handleTriggerJournalSelector = () => {
    onOpenJournalSelector(handleJournalSelectedBySelector);
  };

  const handleSubmit = () => {
    if (!goodToLink || selectedJournals.length === 0) {
      alert("Please select at least one journal to link.");
      return;
    }
    const linksToCreate: CreateJournalGoodLinkPayload[] = selectedJournals.map(
      (journal) => ({
        goodId: goodToLink.id,
        journalId: journal.id,
      })
    );
    onSubmitLinks(linksToCreate);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <motion.div
      className={baseStyles.modalOverlay}
      onClick={onClose}
      initial="closed"
      animate="open"
      exit="closed"
      variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className={`${baseStyles.modalContent} ${linkStyles.linkModalContentSizing}`}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: "2%" }}
        animate={{ opacity: 1, scale: 1, y: "0%" }}
        exit={{ opacity: 0, scale: 0.95, y: "2%" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <button
          className={baseStyles.modalCloseButton}
          onClick={onClose}
          aria-label="Close link good to journals modal"
        >
          ×
        </button>
        <h2 className={baseStyles.modalTitle}>
          Link Good/Service: {goodToLink?.label || "N/A"} to Journals
        </h2>

        <div className={linkStyles.modalBody}>
          <button
            onClick={handleTriggerJournalSelector}
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary} ${linkStyles.selectJournalsButton}`}
          >
            Select Journal(s) to Link
          </button>

          {selectedJournals.length > 0 && (
            <div className={linkStyles.selectedJournalsList}>
              <h4>Selected Journals:</h4>
              <ul>
                {selectedJournals.map((journal) => (
                  <li key={journal.id}>
                    <span>
                      {journal.name} ({journal.code})
                    </span>
                    <button
                      onClick={() => handleRemoveJournal(journal.id)}
                      className={linkStyles.removeJournalButton}
                      aria-label={`Remove ${journal.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selectedJournals.length === 0 && goodToLink && (
            <p className={linkStyles.noJournalsSelected}>
              No journals selected yet. Click "Select Journal(s)" to add.
            </p>
          )}
          {!goodToLink && (
            <p
              className={
                linkStyles.noPartnerError /* Reusing class, might rename to noItemError */
              }
            >
              Error: No Good/Service identified for linking.
            </p>
          )}
        </div>

        <div className={baseStyles.modalActions}>
          <button
            type="button"
            onClick={onClose}
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`}
            disabled={
              isSubmitting || selectedJournals.length === 0 || !goodToLink
            }
          >
            {isSubmitting
              ? "Linking..."
              : `Link to ${selectedJournals.length} Journal(s)`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
