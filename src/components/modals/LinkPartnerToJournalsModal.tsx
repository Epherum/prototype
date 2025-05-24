// src/components/modals/LinkPartnerToJournalsModal.tsx
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type {
  Partner,
  AccountNodeData,
  CreateJournalPartnerLinkClientData,
} from "@/lib/types";
import baseStyles from "./ModalBase.module.css"; // Assuming shared base styles
import styles from "./LinkPartnerToJournalsModal.module.css"; // Create this CSS module

interface LinkPartnerToJournalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitLinks: (linksData: CreateJournalPartnerLinkClientData[]) => void;
  partnerToLink: Partner | null;
  isSubmitting: boolean;
  onOpenJournalSelector: (
    onSelectCallback: (journalNode: AccountNodeData) => void
  ) => void;
  fullJournalHierarchy: AccountNodeData[]; // For finding node details if needed, though JournalModal gives full node
  // isJournalSelectorOpen?: boolean; // Optional: To disable close button while JournalModal is open
}

export default function LinkPartnerToJournalsModal({
  isOpen,
  onClose,
  onSubmitLinks,
  partnerToLink,
  isSubmitting,
  onOpenJournalSelector,
  fullJournalHierarchy,
}: // isJournalSelectorOpen,
LinkPartnerToJournalsModalProps) {
  const [selectedJournals, setSelectedJournals] = useState<AccountNodeData[]>(
    []
  );

  // Reset selected journals when the modal is closed or the partner changes
  useEffect(() => {
    if (!isOpen || !partnerToLink) {
      setSelectedJournals([]);
    }
  }, [isOpen, partnerToLink]);

  const handleJournalSelectedBySelector = useCallback(
    (journalNode: AccountNodeData) => {
      // This function is called by JournalModal (via Home.tsx) when a journal is selected for linking
      setSelectedJournals((prevSelected) => {
        if (prevSelected.find((j) => j.id === journalNode.id)) {
          return prevSelected; // Already selected
        }
        return [...prevSelected, journalNode];
      });
      // The JournalModal (selector) itself remains open for further selections.
      // The user closes JournalModal when they are "Done Selecting".
    },
    []
  );

  const handleRemoveJournal = (journalIdToRemove: string) => {
    setSelectedJournals((prevSelected) =>
      prevSelected.filter((j) => j.id !== journalIdToRemove)
    );
  };

  const handleTriggerJournalSelector = () => {
    // Call the prop from Home.tsx, passing our internal callback
    onOpenJournalSelector(handleJournalSelectedBySelector);
  };

  const handleSubmit = () => {
    if (!partnerToLink || selectedJournals.length === 0) {
      alert("Please select at least one journal to link.");
      return;
    }
    const linksToCreate: CreateJournalPartnerLinkClientData[] =
      selectedJournals.map((journal) => ({
        partnerId: partnerToLink.id, // Ensure partnerId is string if your type expects string
        journalId: journal.id,
        // Add any other default properties for the link if necessary
      }));
    onSubmitLinks(linksToCreate);
    // Closing the modal is typically handled by Home.tsx after successful submission (e.g., invalidating queries and then `handleCloseLinkPartnerToJournalsModal`)
    // or if onSubmitLinks itself triggers a state change that closes it.
    // For now, we assume Home.tsx's createJPLMutation onSuccess/onError will lead to modal closure if needed.
  };

  if (!isOpen) {
    // Framer Motion handles the exit animation
    return null;
  }

  return (
    <motion.div
      className={baseStyles.modalOverlay}
      onClick={onClose} // Allow closing by clicking overlay
      initial="closed"
      animate="open"
      exit="closed"
      variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className={`${baseStyles.modalContent} ${styles.linkModalContentSizing}`} // Add specific sizing if needed
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: "2%" }}
        animate={{ opacity: 1, scale: 1, y: "0%" }}
        exit={{ opacity: 0, scale: 0.95, y: "2%" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <button
          className={baseStyles.modalCloseButton}
          onClick={onClose}
          aria-label="Close link partner to journals modal"
          // disabled={isJournalSelectorOpen} // Optional: disable if journal selector is open
        >
          ×
        </button>
        <h2 className={baseStyles.modalTitle}>
          Link Partner: {partnerToLink?.name || "N/A"} to Journals
        </h2>

        <div className={styles.modalBody}>
          <button
            onClick={handleTriggerJournalSelector}
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary} ${styles.selectJournalsButton}`}
          >
            Select Journal(s) to Link
          </button>

          {selectedJournals.length > 0 && (
            <div className={styles.selectedJournalsList}>
              <h4>Selected Journals:</h4>
              <ul>
                {selectedJournals.map((journal) => (
                  <li key={journal.id}>
                    <span>
                      {journal.name} ({journal.code})
                    </span>
                    <button
                      onClick={() => handleRemoveJournal(journal.id)}
                      className={styles.removeJournalButton}
                      aria-label={`Remove ${journal.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selectedJournals.length === 0 && partnerToLink && (
            <p className={styles.noJournalsSelected}>
              No journals selected yet. Click "Select Journal(s)" to add.
            </p>
          )}
          {!partnerToLink && (
            <p className={styles.noPartnerError}>
              Error: No partner identified for linking.
            </p>
          )}
        </div>

        <div className={baseStyles.modalActions}>
          <button
            type="button"
            onClick={onClose}
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
            disabled={isSubmitting /* || isJournalSelectorOpen */}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`}
            disabled={
              isSubmitting || selectedJournals.length === 0 || !partnerToLink
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
