// src/components/modals/LinkGoodToPartnersViaJournalModal.tsx
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type {
  Good,
  Partner,
  AccountNodeData,
  CreateJournalPartnerGoodLinkClientData,
} from "@/lib/types";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import listStyles from "./LinkGoodToPartnersViaJournalModal.module.css"; // A new CSS module for the list items
import { IoClose } from "react-icons/io5";

interface LinkGoodToPartnersViaJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitLinks: (linksData: CreateJournalPartnerGoodLinkClientData[]) => void;
  goodToLink: Good | null;
  targetJournal: AccountNodeData | null;
  availablePartners: Partner[]; // Pre-fetched list of partners linked to targetJournal
  isSubmitting: boolean;
}

export default function LinkGoodToPartnersViaJournalModal({
  isOpen,
  onClose,
  onSubmitLinks,
  goodToLink,
  targetJournal,
  availablePartners,
  isSubmitting,
}: LinkGoodToPartnersViaJournalModalProps) {
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedPartnerIds(new Set());
    }
  }, [isOpen]);

  const handleTogglePartnerSelection = (partnerId: string) => {
    setSelectedPartnerIds((prevSelectedIds) => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(partnerId)) {
        newSelectedIds.delete(partnerId);
      } else {
        newSelectedIds.add(partnerId);
      }
      return newSelectedIds;
    });
  };

  const handleSubmit = () => {
    if (!goodToLink || !targetJournal || selectedPartnerIds.size === 0) {
      alert("Good, target journal, and at least one partner must be selected.");
      return;
    }

    const linksToCreate: CreateJournalPartnerGoodLinkClientData[] = Array.from(
      selectedPartnerIds
    ).map((partnerId) => ({
      journalId: targetJournal.id,
      partnerId: partnerId,
      goodId: String(goodToLink.id),
      partnershipType: "STANDARD_TRANSACTION", // IMPORTANT: Or make this configurable/derived
      // descriptiveText: `Link for ${goodToLink.label} with partner ${partnerId} under ${targetJournal.name}`,
    }));

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
        className={`${baseStyles.modalContent} ${listStyles.linkModalContentSizing}`} // Use a class for sizing
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
          Link Good:{" "}
          <span className={baseStyles.highlight}>
            {goodToLink?.label || "N/A"}
          </span>
          <br />
          Via Journal:{" "}
          <span className={baseStyles.highlight}>
            {targetJournal?.name || "N/A"} ({targetJournal?.code || ""})
          </span>
          <br />
          To Partner(s):
        </h2>

        <div className={listStyles.modalBodyWithList}>
          {availablePartners.length > 0 ? (
            <ul className={listStyles.itemsList}>
              {availablePartners.map((partner) => (
                <li
                  key={partner.id}
                  className={`${listStyles.item} ${
                    selectedPartnerIds.has(partner.id)
                      ? listStyles.itemSelected
                      : ""
                  }`}
                  onClick={() => handleTogglePartnerSelection(partner.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedPartnerIds.has(partner.id)}
                    onChange={() => handleTogglePartnerSelection(partner.id)}
                    className={listStyles.checkbox}
                  />
                  <span className={listStyles.itemName}>{partner.name}</span>
                  <span className={listStyles.itemDetail}>
                    {partner.registrationNumber ||
                      `ID: ${partner.id.substring(0, 6)}...`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={listStyles.noItemsMessage}>
              No partners found linked to the target journal{" "}
              <span className={baseStyles.highlight}>
                ({targetJournal?.name})
              </span>
              . Please link partners to this journal first.
            </p>
          )}
          {!goodToLink ||
            (!targetJournal && (
              <p className={listStyles.errorMessage}>
                Error: Good or Target Journal context is missing.
              </p>
            ))}
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
              isSubmitting ||
              selectedPartnerIds.size === 0 ||
              !goodToLink ||
              !targetJournal ||
              availablePartners.length === 0
            }
          >
            {isSubmitting
              ? "Linking..."
              : `Link with ${selectedPartnerIds.size} Partner(s)`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
