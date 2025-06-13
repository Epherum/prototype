// src/components/modals/UnlinkPartnerFromJournalsModal.tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Partner, JournalPartnerLinkWithDetails } from "@/lib/types";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./UnlinkPartnerFromJournalsModal.module.css"; // Create this

interface UnlinkPartnerFromJournalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner;
  onUnlink: (linkIdsToUnlink: string[]) => void;
  fetchLinksFn: () => Promise<JournalPartnerLinkWithDetails[]>;
  isUnlinking: boolean; // To disable buttons during unlinking
}

export default function UnlinkPartnerFromJournalsModal({
  isOpen,
  onClose,
  partner,
  onUnlink,
  fetchLinksFn,
  isUnlinking,
}: UnlinkPartnerFromJournalsModalProps) {
  const queryClient = useQueryClient();
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);

  const queryKey = ["partnerJournalLinks", partner?.id];

  const {
    data: links,
    isLoading,
    isError,
    error,
  } = useQuery<JournalPartnerLinkWithDetails[], Error>({
    queryKey: queryKey,
    queryFn: async () => {
      // Wrap fetchLinksFn to ensure partner.id is valid before calling
      if (!partner || !partner.id) {
        // This should ideally not be reached if `enabled` is correct,
        // but as a safeguard:
        console.error("fetchLinksFn called with invalid partner.id");
        throw new Error("Partner ID is required to fetch links.");
        // Or return Promise.resolve([]) if you want to show "no links" instead of error
      }
      return fetchLinksFn(); // fetchLinksFn is already `() => fetchJournalLinksForPartner(partnerForUnlinking.id)`
    },
    // Ensure the query only runs when the modal is open AND partner AND partner.id are valid
    enabled:
      isOpen &&
      !!partner &&
      typeof partner.id === "string" &&
      partner.id !== "undefined" &&
      partner.id !== "",
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isOpen) {
      setSelectedLinkIds([]); // Reset selections when modal closes
    }
  }, [isOpen]);

  const handleToggleLinkSelection = (linkId: string) => {
    setSelectedLinkIds((prev) =>
      prev.includes(linkId)
        ? prev.filter((id) => id !== linkId)
        : [...prev, linkId]
    );
  };

  const handleUnlinkSelected = () => {
    if (selectedLinkIds.length > 0) {
      if (
        window.confirm(
          `Are you sure you want to unlink ${selectedLinkIds.length} journal(s) from ${partner.name}?`
        )
      ) {
        onUnlink(selectedLinkIds);
        // Don't clear selectedLinkIds here, let query invalidation refresh the list
      }
    } else {
      alert("Please select at least one journal link to remove.");
    }
  };

  if (!isOpen) return null;

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
        className={`${baseStyles.modalContent} ${styles.unlinkModalContentSizing}`}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: "2%" }}
        animate={{ opacity: 1, scale: 1, y: "0%" }}
        exit={{ opacity: 0, scale: 0.95, y: "2%" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <button
          className={baseStyles.modalCloseButton}
          onClick={onClose}
          aria-label="Close unlink modal"
          disabled={isUnlinking}
        >
          ×
        </button>
        <h2 className={baseStyles.modalTitle}>
          Unlink Journals from: {partner.name}
        </h2>

        <div className={styles.modalBody}>
          {isLoading && (
            <p className={styles.loadingMessage}>Loading linked journals...</p>
          )}
          {isError && (
            <p className={styles.errorMessage}>
              Error loading links: {error?.message}
            </p>
          )}
          {!isLoading && !isError && (!links || links.length === 0) && (
            <p className={styles.noLinksMessage}>
              {partner.name} is not currently linked to any journals.
            </p>
          )}
          {!isLoading && !isError && links && links.length > 0 && (
            <ul className={styles.linksList}>
              {links.map((link) => (
                <li key={link.id} className={styles.linkItem}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedLinkIds.includes(link.id)}
                      onChange={() => handleToggleLinkSelection(link.id)}
                      disabled={isUnlinking}
                      className={styles.checkboxInput}
                    />
                    <span className={styles.linkLabel}>
                      {link.journalName || `Journal ID: ${link.journalId}`}
                      {link.journalCode && ` (${link.journalCode})`}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={baseStyles.modalActions}>
          <button
            type="button"
            onClick={onClose}
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
            disabled={isUnlinking}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUnlinkSelected}
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`} // Or a danger button style
            disabled={
              isUnlinking ||
              selectedLinkIds.length === 0 ||
              isLoading ||
              isError
            }
          >
            {isUnlinking
              ? "Unlinking..."
              : `Unlink Selected (${selectedLinkIds.length})`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
