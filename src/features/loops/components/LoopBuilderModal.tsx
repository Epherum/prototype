//src/features/loops/components/LoopBuilderModal.tsx
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IoClose,
  IoAdd,
  IoRemove,
  IoArrowUp,
  IoArrowDown,
  IoSearch,
  IoCheckmark,
  IoWarning,
  IoRefresh,
} from "react-icons/io5";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoopWithConnections, CreateLoopPayload, UpdateLoopPayload } from "@/lib/schemas/loop.schema";
import { createLoop, updateLoop } from "@/services/clientLoopService";
import { fetchJournalsForSelection } from "@/services/clientJournalService";
import { useAppStore } from "@/store/appStore";
import LoopVisualization from "./LoopVisualization";
import styles from "./LoopBuilderModal.module.css";

interface LoopBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingLoop?: LoopWithConnections | null;
  onSuccess?: (loop: LoopWithConnections) => void;
}

interface JournalOption {
  id: string;
  name: string;
  isTerminal: boolean;
  parentId?: string;
}

interface ValidationError {
  type: 'error' | 'warning';
  message: string;
}

const LoopBuilderModal: React.FC<LoopBuilderModalProps> = ({
  isOpen,
  onClose,
  editingLoop,
  onSuccess,
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(editingLoop?.name || "");
  const [description, setDescription] = useState(editingLoop?.description || "");
  const [selectedJournalIds, setSelectedJournalIds] = useState<string[]>(
    editingLoop?.journalConnections
      ?.sort((a, b) => a.sequence - b.sequence)
      ?.map(conn => conn.fromJournalId) || []
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);
  const isEditing = !!editingLoop;

  // Fetch available journals
  const { data: allJournals = [], isLoading: journalsLoading } = useQuery({
    queryKey: ["journals", "selection", user.restrictedTopLevelJournalId],
    queryFn: () => fetchJournalsForSelection(user.restrictedTopLevelJournalId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Transform journals for easier working
  const journalOptions = useMemo((): JournalOption[] => {
    return allJournals.map(journal => ({
      id: journal.id,
      name: journal.name,
      isTerminal: journal.isTerminal,
      parentId: journal.parentId,
    }));
  }, [allJournals]);

  // Create journal lookup map
  const journalMap = useMemo(() => {
    return journalOptions.reduce((acc, journal) => {
      acc[journal.id] = journal;
      return acc;
    }, {} as Record<string, JournalOption>);
  }, [journalOptions]);

  // Filter journals for selection
  const filteredJournals = useMemo(() => {
    let filtered = journalOptions;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(journal =>
        journal.name.toLowerCase().includes(term) ||
        journal.id.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [journalOptions, searchTerm]);

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: CreateLoopPayload | { id: string; updates: UpdateLoopPayload }) => {
      if (isEditing && 'id' in data) {
        return updateLoop(data.id, data.updates);
      } else {
        return createLoop(data as CreateLoopPayload);
      }
    },
    onSuccess: (loop: LoopWithConnections) => {
      queryClient.invalidateQueries({ queryKey: ["loops"] });
      onSuccess?.(loop);
      handleClose();
    },
  });

  // Validation
  const validation = useMemo((): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Basic validation
    if (!name.trim()) {
      errors.push({ type: 'error', message: 'Loop name is required' });
    }

    if (selectedJournalIds.length < 3) {
      errors.push({ type: 'error', message: 'Loop must contain at least 3 journals' });
    }

    // Check for duplicates
    const uniqueJournals = new Set(selectedJournalIds);
    if (uniqueJournals.size !== selectedJournalIds.length) {
      errors.push({ type: 'error', message: 'Loop cannot contain duplicate journals' });
    }

    // Check for non-existent journals
    const missingJournals = selectedJournalIds.filter(id => !journalMap[id]);
    if (missingJournals.length > 0) {
      errors.push({
        type: 'error',
        message: `Some selected journals no longer exist: ${missingJournals.join(', ')}`
      });
    }

    // Warnings for terminal journals
    const terminalJournals = selectedJournalIds.filter(id => journalMap[id]?.isTerminal);
    if (terminalJournals.length === 0) {
      errors.push({
        type: 'warning',
        message: 'Consider including at least one terminal journal for balanced transactions'
      });
    }

    return errors;
  }, [name, selectedJournalIds, journalMap]);

  const hasErrors = validation.some(v => v.type === 'error');

  const handleClose = () => {
    setStep(1);
    setName(editingLoop?.name || "");
    setDescription(editingLoop?.description || "");
    setSelectedJournalIds(
      editingLoop?.journalConnections
        ?.sort((a, b) => a.sequence - b.sequence)
        ?.map(conn => conn.fromJournalId) || []
    );
    setSearchTerm("");
    setIsSubmitting(false);
    onClose();
  };

  const handleJournalToggle = (journalId: string) => {
    setSelectedJournalIds(prev => {
      if (prev.includes(journalId)) {
        return prev.filter(id => id !== journalId);
      } else {
        return [...prev, journalId];
      }
    });
  };

  const handleJournalReorder = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= selectedJournalIds.length) return;

    const newOrder = [...selectedJournalIds];
    [newOrder[fromIndex], newOrder[toIndex]] = [newOrder[toIndex], newOrder[fromIndex]];
    setSelectedJournalIds(newOrder);
  };

  const handleRemoveJournal = (journalId: string) => {
    setSelectedJournalIds(prev => prev.filter(id => id !== journalId));
  };

  const handleSubmit = async () => {
    if (hasErrors) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        journalIds: selectedJournalIds,
      };

      if (isEditing) {
        mutation.mutate({ id: editingLoop.id, updates: payload });
      } else {
        mutation.mutate(payload);
      }
    } catch (error) {
      console.error("Error submitting loop:", error);
      setIsSubmitting(false);
    }
  };

  // Mock loop for preview
  const previewLoop = useMemo(() => {
    if (selectedJournalIds.length < 2) return null;

    const connections = selectedJournalIds.map((fromId, index) => {
      const toId = selectedJournalIds[(index + 1) % selectedJournalIds.length];
      return {
        id: `preview-${index}`,
        loopId: "preview",
        fromJournalId: fromId,
        toJournalId: toId,
        sequence: index,
        createdAt: new Date(),
        updatedAt: new Date(),
        fromJournal: { id: fromId, name: journalMap[fromId]?.name || `Journal ${fromId}` },
        toJournal: { id: toId, name: journalMap[toId]?.name || `Journal ${toId}` },
      };
    });

    return {
      id: "preview",
      name: name || "Preview Loop",
      description: description || null,
      status: "DRAFT" as const,
      entityState: "ACTIVE" as const,
      createdById: user.id || "",
      createdByIp: "",
      deletedById: "",
      deletedByIp: "",
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      journalConnections: connections,
    };
  }, [selectedJournalIds, journalMap, name, description, user?.id]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={styles.modalOverlay}
      onClick={handleClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {isEditing ? `Edit Loop: ${editingLoop.name}` : "Create New Loop"}
          </h2>
          <button
            onClick={handleClose}
            className={styles.closeButton}
            disabled={isSubmitting}
          >
            <IoClose />
          </button>
        </div>

        {/* Steps Indicator */}
        <div className={styles.stepsIndicator}>
          {[1, 2, 3, 4].map((stepNum) => (
            <button
              key={stepNum}
              onClick={() => setStep(stepNum)}
              className={`${styles.stepButton} ${
                stepNum === step ? styles.stepActive : ""
              } ${stepNum < step ? styles.stepCompleted : ""}`}
              disabled={isSubmitting}
            >
              {stepNum < step ? <IoCheckmark /> : stepNum}
            </button>
          ))}
        </div>

        <div className={styles.modalBody}>
          <AnimatePresence mode="wait">
            {/* Step 1: Basic Information */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={styles.step}
              >
                <h3 className={styles.stepTitle}>Basic Information</h3>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="loop-name">
                    Loop Name *
                  </label>
                  <input
                    id="loop-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter a descriptive name for this loop"
                    className={styles.input}
                    disabled={isSubmitting}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="loop-description">
                    Description (Optional)
                  </label>
                  <textarea
                    id="loop-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the purpose of this accounting loop"
                    className={styles.textarea}
                    rows={3}
                    disabled={isSubmitting}
                  />
                </div>
              </motion.div>
            )}

            {/* Step 2: Journal Selection */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={styles.step}
              >
                <h3 className={styles.stepTitle}>Select Journals</h3>
                <div className={styles.searchContainer}>
                  <IoSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search journals..."
                    className={styles.searchInput}
                    disabled={isSubmitting}
                  />
                </div>

                <div className={styles.journalSelection}>
                  <div className={styles.availableJournals}>
                    <h4>Available Journals ({filteredJournals.length})</h4>
                    <div className={styles.journalList}>
                      {journalsLoading ? (
                        <div className={styles.loadingState}>Loading journals...</div>
                      ) : filteredJournals.length === 0 ? (
                        <div className={styles.emptyState}>
                          {searchTerm ? "No journals match your search" : "No journals available"}
                        </div>
                      ) : (
                        filteredJournals.map((journal) => (
                          <div
                            key={journal.id}
                            className={`${styles.journalItem} ${
                              selectedJournalIds.includes(journal.id)
                                ? styles.journalSelected
                                : ""
                            }`}
                            onClick={() => handleJournalToggle(journal.id)}
                          >
                            <div className={styles.journalInfo}>
                              <span className={styles.journalName}>{journal.name}</span>
                              <span className={styles.journalId}>ID: {journal.id}</span>
                            </div>
                            <div className={styles.journalBadges}>
                              {journal.isTerminal && (
                                <span className={styles.terminalBadge}>Terminal</span>
                              )}
                              {selectedJournalIds.includes(journal.id) && (
                                <IoCheckmark className={styles.selectedIcon} />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className={styles.selectedJournals}>
                    <h4>Selected Journals ({selectedJournalIds.length}/∞)</h4>
                    <div className={styles.selectedList}>
                      {selectedJournalIds.length === 0 ? (
                        <div className={styles.emptyState}>
                          Select at least 3 journals to create a loop
                        </div>
                      ) : (
                        selectedJournalIds.map((journalId, index) => {
                          const journal = journalMap[journalId];
                          return (
                            <div key={journalId} className={styles.selectedItem}>
                              <div className={styles.selectedItemOrder}>{index + 1}</div>
                              <div className={styles.selectedItemInfo}>
                                <span className={styles.selectedItemName}>
                                  {journal?.name || `Unknown Journal ${journalId}`}
                                </span>
                                {journal?.isTerminal && (
                                  <span className={styles.terminalBadge}>T</span>
                                )}
                              </div>
                              <div className={styles.selectedItemActions}>
                                <button
                                  onClick={() => handleJournalReorder(index, 'up')}
                                  disabled={index === 0 || isSubmitting}
                                  className={styles.reorderButton}
                                  title="Move up"
                                >
                                  <IoArrowUp />
                                </button>
                                <button
                                  onClick={() => handleJournalReorder(index, 'down')}
                                  disabled={index === selectedJournalIds.length - 1 || isSubmitting}
                                  className={styles.reorderButton}
                                  title="Move down"
                                >
                                  <IoArrowDown />
                                </button>
                                <button
                                  onClick={() => handleRemoveJournal(journalId)}
                                  className={styles.removeButton}
                                  disabled={isSubmitting}
                                  title="Remove"
                                >
                                  <IoRemove />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Preview and Validation */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={styles.step}
              >
                <h3 className={styles.stepTitle}>Loop Preview</h3>

                {/* Validation Messages */}
                {validation.length > 0 && (
                  <div className={styles.validationContainer}>
                    {validation.map((error, index) => (
                      <div
                        key={index}
                        className={`${styles.validationMessage} ${
                          error.type === 'error' ? styles.validationError : styles.validationWarning
                        }`}
                      >
                        <IoWarning />
                        <span>{error.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Loop Preview */}
                {previewLoop && (
                  <div className={styles.previewContainer}>
                    <LoopVisualization
                      loop={previewLoop}
                      journalMap={journalMap}
                      compact={false}
                      className={styles.previewVisualization}
                    />
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={styles.step}
              >
                <h3 className={styles.stepTitle}>Review and Confirm</h3>
                <div className={styles.confirmationContent}>
                  <div className={styles.summaryGrid}>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Loop Name:</span>
                      <span className={styles.summaryValue}>{name}</span>
                    </div>
                    {description && (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Description:</span>
                        <span className={styles.summaryValue}>{description}</span>
                      </div>
                    )}
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Total Journals:</span>
                      <span className={styles.summaryValue}>{selectedJournalIds.length}</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Loop Path:</span>
                      <span className={styles.summaryValue}>
                        {selectedJournalIds
                          .map(id => journalMap[id]?.name || `Journal ${id}`)
                          .join(" → ")} → {journalMap[selectedJournalIds[0]]?.name || `Journal ${selectedJournalIds[0]}`}
                      </span>
                    </div>
                  </div>

                  {hasErrors && (
                    <div className={styles.errorSummary}>
                      <IoWarning />
                      <span>Please fix the validation errors before creating the loop.</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer with navigation */}
        <div className={styles.modalFooter}>
          <div className={styles.footerLeft}>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className={styles.secondaryButton}
                disabled={isSubmitting}
              >
                Previous
              </button>
            )}
          </div>

          <div className={styles.footerRight}>
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                className={styles.primaryButton}
                disabled={step === 1 && !name.trim()}
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className={styles.primaryButton}
                disabled={hasErrors || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <IoRefresh className={styles.spinning} />
                    {isEditing ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    {isEditing ? "Update Loop" : "Create Loop"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error display */}
        {mutation.error && (
          <div className={styles.errorContainer}>
            <IoWarning />
            <span>
              {mutation.error instanceof Error
                ? mutation.error.message
                : "An error occurred while saving the loop"}
            </span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default LoopBuilderModal;