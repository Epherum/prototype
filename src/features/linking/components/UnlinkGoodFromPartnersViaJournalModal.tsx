// src/components/modals/UnlinkGoodFromPartnersViaJournalModal.tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type {
  GoodClient,
  JournalPartnerGoodLinkClient,
  JournalPartnerLinkWithDetailsClient,
} from "@/lib/types/models.client";
import type { AccountNodeData } from "@/lib/types/ui";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import listStyles from "./UnlinkPartnerFromJournalsModal.module.css"; // Reuse the list styling
import { IoClose } from "react-icons/io5";

// Define a local view-model for the component's needs, combining the new base types
type JournalPartnerGoodLinkWithDetails = JournalPartnerGoodLinkClient & {
  descriptiveText?: string;
  journalPartnerLink?: JournalPartnerLinkWithDetailsClient; // This includes the nested partner
};

interface UnlinkGoodFromPartnersViaJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmUnlink: (linkIdsToUnlink: string[]) => void; // Callback with array of JPGL IDs
  goodToUnlink: GoodClient | null;
  contextJournal: AccountNodeData | null;
  existingLinks: JournalPartnerGoodLinkWithDetails[]; // Pre-fetched list of JPGLs
  isSubmitting: boolean; // For the overall unlink operation
  isLoadingLinks?: boolean; // To show loading state for the list initially
}

export default function UnlinkGoodFromPartnersViaJournalModal({
  isOpen,
  onClose,
  onConfirmUnlink,
  goodToUnlink,
  contextJournal,
  existingLinks,
  isSubmitting,
  isLoadingLinks = false,
}: UnlinkGoodFromPartnersViaJournalModalProps) {
  // Handle body scroll lock
  useBodyScrollLock(isOpen);
  
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedLinkIds(new Set());
    }
  }, [isOpen]);

  const handleToggleLinkSelection = (linkId: string) => {
    setSelectedLinkIds((prevSelectedIds) => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(linkId)) {
        newSelectedIds.delete(linkId);
      } else {
        newSelectedIds.add(linkId);
      }
      return newSelectedIds;
    });
  };

  const handleSubmit = () => {
    if (selectedLinkIds.size === 0) {
      alert("Please select at least one link to remove.");
      return;
    }
    onConfirmUnlink(Array.from(selectedLinkIds));
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
        className={`${baseStyles.modalContent} ${listStyles.linkModalContentSizing}`}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: "2%" }}
        animate={{ opacity: 1, scale: 1, y: "0%" }}
        exit={{ opacity: 0, scale: 0.95, y: "2%" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <button
          className={baseStyles.modalCloseButton}
          onClick={onClose}
          aria-label="Close modal"
        >
          <IoClose size={24} />
        </button>
        <h2 className={baseStyles.modalTitle}>
          Unlink Good:{" "}
          <span className={baseStyles.highlight}>
            {goodToUnlink?.label || "N/A"}
          </span>
          <br />
          From Partner(s) via Journal:{" "}
          <span className={baseStyles.highlight}>
            {contextJournal?.name || "N/A"} ({contextJournal?.code || ""})
          </span>
        </h2>

        <div className={listStyles.modalBodyWithList}>
          {isLoadingLinks && (
            <p className={listStyles.noItemsMessage}>Loading links...</p>
          )}
          {!isLoadingLinks && existingLinks.length > 0 && (
            <ul className={listStyles.itemsList}>
              {existingLinks.map((link) => (
                <li
                  key={link.id} // JPGL's own ID
                  className={`${listStyles.item} ${
                    selectedLinkIds.has(link.id) ? listStyles.itemSelected : ""
                  }`}
                  onClick={() => handleToggleLinkSelection(link.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedLinkIds.has(link.id)}
                    onChange={() => handleToggleLinkSelection(link.id)}
                    className={listStyles.checkbox}
                  />
                  <span className={listStyles.itemName}>
                    {link.journalPartnerLink?.partner?.name ||
                      "Unknown Partner"}
                  </span>
                  <span className={listStyles.itemDetail}>
                    {link.descriptiveText ||
                      `Link ID: ${link.id.substring(0, 6)}...`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!isLoadingLinks && existingLinks.length === 0 && (
            <p className={listStyles.noItemsMessage}>
              No existing links found for this Good with Partners via this
              Journal.
            </p>
          )}
          {(!goodToUnlink || !contextJournal) && !isLoadingLinks && (
            <p className={listStyles.errorMessage}>
              Error: Good or Context Journal information is missing.
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
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary} ${baseStyles.modalButtonDanger}`} // Added danger for unlink
            disabled={
              isSubmitting ||
              isLoadingLinks ||
              selectedLinkIds.size === 0 ||
              existingLinks.length === 0 || // Can't submit if no links to select from
              !goodToUnlink ||
              !contextJournal
            }
          >
            {isSubmitting
              ? "Unlinking..."
              : `Unlink ${selectedLinkIds.size} Selected`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
