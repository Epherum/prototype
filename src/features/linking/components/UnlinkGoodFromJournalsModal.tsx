// src/components/modals/UnlinkGoodFromJournalsModal.tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import type {
  GoodClient,
  JournalGoodLinkClient,
  JournalClient,
} from "@/lib/types/models.client";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
// Reusing the CSS module from partner unlinking for similar structure.
// You can create a dedicated one if distinctions grow.
import unlinkStyles from "./UnlinkPartnerFromJournalsModal.module.css"; // Assuming this exists from previous step

// Define a local view-model for the component's needs
type JournalGoodLinkWithDetailsClient = JournalGoodLinkClient & {
  journal?: JournalClient;
};

interface UnlinkGoodFromJournalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  good: GoodClient; // The Good/Service from which to unlink journals
  onUnlink: (linkIdsToUnlink: string[]) => void; // Expects JournalGoodLink.id
  fetchLinksFn: () => Promise<JournalGoodLinkWithDetailsClient[]>;
  isUnlinking: boolean;
}

export default function UnlinkGoodFromJournalsModal({
  isOpen,
  onClose,
  good,
  onUnlink,
  fetchLinksFn,
  isUnlinking,
}: UnlinkGoodFromJournalsModalProps) {
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);

  const queryKey = ["goodJournalLinks", good?.id]; // Use good's ID in the query key

  const {
    data: links,
    isLoading,
    isError,
    error,
  } = useQuery<JournalGoodLinkWithDetailsClient[], Error>({
    queryKey: queryKey,
    queryFn: fetchLinksFn,
    enabled: isOpen && !!good && typeof good.id === "string" && good.id !== "", // Ensure good and good.id are valid
    staleTime: 5 * 60 * 1000,
    // refetchOnWindowFocus: false, // Optional: prevent refetch on window focus
  });

  useEffect(() => {
    if (!isOpen) {
      setSelectedLinkIds([]);
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
          `Are you sure you want to unlink ${selectedLinkIds.length} journal(s) from ${good.label}?`
        )
      ) {
        onUnlink(selectedLinkIds);
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
        className={`${baseStyles.modalContent} ${unlinkStyles.unlinkModalContentSizing}`}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: "2%" }}
        animate={{ opacity: 1, scale: 1, y: "0%" }}
        exit={{ opacity: 0, scale: 0.95, y: "2%" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <button
          className={baseStyles.modalCloseButton}
          onClick={onClose}
          aria-label="Close unlink good from journals modal"
          disabled={isUnlinking}
        >
          ×
        </button>
        <h2 className={baseStyles.modalTitle}>
          Unlink Journals from: {good.label}
        </h2>

        <div className={unlinkStyles.modalBody}>
          {isLoading && (
            <p className={unlinkStyles.loadingMessage}>
              Loading linked journals...
            </p>
          )}
          {isError && (
            <p className={unlinkStyles.errorMessage}>
              Error loading links: {error?.message}
            </p>
          )}
          {!isLoading && !isError && (!links || links.length === 0) && (
            <p className={unlinkStyles.noLinksMessage}>
              {good.label} is not currently linked to any journals.
            </p>
          )}
          {!isLoading && !isError && links && links.length > 0 && (
            <ul className={unlinkStyles.linksList}>
              {links.map(
                (
                  linkDetail // linkDetail is JournalGoodLinkWithDetails
                ) => (
                  <li key={linkDetail.id} className={unlinkStyles.linkItem}>
                    <label className={unlinkStyles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={selectedLinkIds.includes(linkDetail.id)} // Use linkDetail.id (which is JournalGoodLink.id)
                        onChange={() =>
                          handleToggleLinkSelection(linkDetail.id)
                        }
                        disabled={isUnlinking}
                        className={unlinkStyles.checkboxInput}
                      />
                      <span className={unlinkStyles.linkLabel}>
                        {linkDetail.journal?.name ||
                          `Journal ID: ${linkDetail.journalId}`}{" "}
                        {linkDetail.journal?.id &&
                          ` (${linkDetail.journal.id})`}
                      </span>
                    </label>
                  </li>
                )
              )}
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
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`}
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
