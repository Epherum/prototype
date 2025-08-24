// src/features/linking/components/JournalPartnerGoodLinkModal.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { IoClose, IoSearch, IoTrashOutline, IoAddOutline } from "react-icons/io5";
import type { GoodClient, PartnerClient, JournalPartnerGoodLinkClient } from "@/lib/types/models.client";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./JournalPartnerGoodLinkModal.module.css";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

export type LinkMode = "partner-to-goods" | "good-to-partners";

interface JournalPartnerGoodLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: LinkMode;
  // Context data
  selectedJournalIds: string[];
  selectedEntity: PartnerClient | GoodClient | null; // The partner or good being linked
  // Available items to link to
  availableItems: (PartnerClient | GoodClient)[];
  // Existing links for context
  existingLinks: JournalPartnerGoodLinkClient[];
  // Actions
  onCreateLinks: (linkData: Array<{
    journalId: string;
    partnerId: string;
    goodId: string;
    descriptiveText?: string;
  }>) => void;
  onDeleteLinks: (linkIds: string[]) => void;
  isSubmitting: boolean;
}

interface LinkContext {
  journalId: string;
  journalName?: string;
  partnerId: string;
  partnerName?: string;
  goodId: string;
  goodName?: string;
  existingLinkId?: string;
  descriptiveText?: string;
}

export default function JournalPartnerGoodLinkModal({
  isOpen,
  onClose,
  mode,
  selectedJournalIds,
  selectedEntity,
  availableItems,
  existingLinks,
  onCreateLinks,
  onDeleteLinks,
  isSubmitting,
}: JournalPartnerGoodLinkModalProps) {
  useBodyScrollLock(isOpen);

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectedJournalContexts, setSelectedJournalContexts] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [descriptiveTexts, setDescriptiveTexts] = useState<Record<string, string>>({});

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedItemIds(new Set());
      setSelectedJournalContexts(new Set(selectedJournalIds)); // Default to all journals
      setSearchTerm("");
      setDescriptiveTexts({});
    } else {
      setSelectedJournalContexts(new Set(selectedJournalIds));
    }
  }, [isOpen, selectedJournalIds]);

  // Filter available items based on search
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return availableItems;
    const term = searchTerm.toLowerCase();
    return availableItems.filter(item => {
      const name = 'name' in item ? item.name : 'label' in item ? item.label : '';
      return name.toLowerCase().includes(term);
    });
  }, [availableItems, searchTerm]);

  // Generate link contexts for preview
  const linkContexts = useMemo((): LinkContext[] => {
    if (!selectedEntity) return [];

    const contexts: LinkContext[] = [];
    
    selectedItemIds.forEach(itemId => {
      selectedJournalContexts.forEach(journalId => {
        const item = availableItems.find(i => i.id === itemId);
        if (!item) return;

        const isPartnerMode = mode === "partner-to-goods";
        const partnerId = String(isPartnerMode ? selectedEntity.id : itemId);
        const goodId = String(isPartnerMode ? itemId : selectedEntity.id);
        
        // Check if link already exists
        // Note: This is a simplified check - server-side validation will prevent duplicates
        const existingLink = existingLinks.find(link => 
          link.goodId === goodId &&
          link.journalPartnerLinkId // Basic check for existing link
        );

        contexts.push({
          journalId: String(journalId),
          partnerId,
          goodId,
          partnerName: isPartnerMode 
            ? ('name' in selectedEntity ? selectedEntity.name : '') 
            : ('name' in item ? item.name : ''),
          goodName: isPartnerMode 
            ? ('label' in item ? item.label : '') 
            : ('label' in selectedEntity ? selectedEntity.label : ''),
          existingLinkId: existingLink?.id,
          descriptiveText: descriptiveTexts[`${journalId}-${partnerId}-${goodId}`] || existingLink?.descriptiveText || ''
        });
      });
    });

    return contexts;
  }, [selectedEntity, selectedItemIds, selectedJournalContexts, availableItems, existingLinks, descriptiveTexts, mode]);

  const handleToggleItem = (itemId: string) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleToggleJournalContext = (journalId: string) => {
    setSelectedJournalContexts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(journalId)) {
        newSet.delete(journalId);
      } else {
        newSet.add(journalId);
      }
      return newSet;
    });
  };

  const handleSelectAllItems = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleDescriptiveTextChange = (contextKey: string, text: string) => {
    setDescriptiveTexts(prev => ({ ...prev, [contextKey]: text }));
  };

  const handleCreateLinks = () => {
    const linksToCreate = linkContexts
      .filter(context => !context.existingLinkId)
      .map(context => ({
        journalId: String(context.journalId),
        partnerId: String(context.partnerId),
        goodId: String(context.goodId),
        descriptiveText: context.descriptiveText || undefined
      }));

    if (linksToCreate.length > 0) {
      onCreateLinks(linksToCreate);
    }
  };

  const handleDeleteExistingLinks = () => {
    const linksToDelete = linkContexts
      .filter(context => context.existingLinkId)
      .map(context => context.existingLinkId!)
      .filter(Boolean);

    if (linksToDelete.length > 0) {
      onDeleteLinks(linksToDelete);
    }
  };

  const newLinksCount = linkContexts.filter(c => !c.existingLinkId).length;
  const existingLinksCount = linkContexts.filter(c => c.existingLinkId).length;

  if (!isOpen || !selectedEntity) {
    return null;
  }

  const entityName = 'name' in selectedEntity ? selectedEntity.name : 'label' in selectedEntity ? selectedEntity.label : 'Unknown';
  const targetType = mode === "partner-to-goods" ? "Goods" : "Partners";

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
        className={`${baseStyles.modalContent} ${styles.linkModalContent}`}
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
          Link <span className={baseStyles.highlight}>{entityName}</span> to {targetType}
        </h2>

        <div className={styles.modalBody}>
          {/* Journal Context Selection */}
          <div className={styles.section}>
            <h3>Journal Contexts ({selectedJournalIds.length})</h3>
            <div className={styles.journalContexts}>
              {selectedJournalIds.map(journalId => (
                <label key={journalId} className={styles.journalContext}>
                  <input
                    type="checkbox"
                    checked={selectedJournalContexts.has(journalId)}
                    onChange={() => handleToggleJournalContext(journalId)}
                  />
                  Journal {journalId}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.twoColumnLayout}>
            {/* Available Items */}
            <div className={styles.leftPanel}>
              <div className={styles.panelHeader}>
                <h3>Available {targetType}</h3>
                <div className={styles.searchContainer}>
                  <IoSearch />
                  <input
                    type="text"
                    placeholder={`Search ${targetType.toLowerCase()}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
                {filteredItems.length > 0 && (
                  <button
                    onClick={handleSelectAllItems}
                    className={styles.selectAllButton}
                  >
                    {selectedItemIds.size === filteredItems.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              
              <div className={styles.itemsList}>
                {filteredItems.length > 0 ? (
                  filteredItems.map(item => {
                    const itemName = 'name' in item ? item.name : 'label' in item ? item.label : 'Unknown';
                    return (
                      <div
                        key={item.id}
                        className={`${styles.item} ${selectedItemIds.has(item.id) ? styles.itemSelected : ''}`}
                        onClick={() => handleToggleItem(item.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedItemIds.has(item.id)}
                          onChange={() => handleToggleItem(item.id)}
                        />
                        <span>{itemName}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>
                    No {targetType.toLowerCase()} found
                  </div>
                )}
              </div>
            </div>

            {/* Link Preview */}
            <div className={styles.rightPanel}>
              <div className={styles.panelHeader}>
                <h3>Link Preview ({linkContexts.length})</h3>
              </div>
              
              <div className={styles.linkPreview}>
                {linkContexts.length > 0 ? (
                  linkContexts.map((context, index) => {
                    const contextKey = `${context.journalId}-${context.partnerId}-${context.goodId}`;
                    return (
                      <div key={contextKey} className={styles.linkContext}>
                        <div className={styles.linkHeader}>
                          <span className={styles.journalBadge}>Journal {context.journalId}</span>
                          {context.existingLinkId && (
                            <span className={styles.existingBadge}>Exists</span>
                          )}
                        </div>
                        <div className={styles.linkDetails}>
                          <div>Partner: {context.partnerName}</div>
                          <div>Good: {context.goodName}</div>
                        </div>
                        <textarea
                          placeholder="Optional description..."
                          value={context.descriptiveText}
                          onChange={(e) => handleDescriptiveTextChange(contextKey, e.target.value)}
                          className={styles.descriptiveText}
                          rows={2}
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>
                    Select {targetType.toLowerCase()} and journal contexts to preview links
                  </div>
                )}
              </div>
            </div>
          </div>
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

          {existingLinksCount > 0 && (
            <button
              type="button"
              onClick={handleDeleteExistingLinks}
              className={`${baseStyles.modalActionButton} ${styles.deleteButton}`}
              disabled={isSubmitting}
            >
              <IoTrashOutline />
              Delete {existingLinksCount} Existing
            </button>
          )}

          {newLinksCount > 0 && (
            <button
              type="button"
              onClick={handleCreateLinks}
              className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`}
              disabled={isSubmitting}
            >
              <IoAddOutline />
              {isSubmitting ? 'Creating...' : `Create ${newLinksCount} Links`}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}