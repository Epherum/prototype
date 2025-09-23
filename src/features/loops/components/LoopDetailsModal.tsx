//src/features/loops/components/LoopDetailsModal.tsx
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { IoClose, IoCreate, IoTrash, IoPlay, IoPause } from "react-icons/io5";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoopWithConnections } from "@/lib/schemas/loop.schema";
import { updateLoop, deleteLoop } from "@/services/clientLoopService";
import { fetchJournalsForSelection } from "@/services/clientJournalService";
import { useAppStore } from "@/store/appStore";
import LoopVisualization from "./LoopVisualization";
import styles from "./LoopDetailsModal.module.css";

interface LoopDetailsModalProps {
  loop: LoopWithConnections;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (loop: LoopWithConnections) => void;
}

const LoopDetailsModal: React.FC<LoopDetailsModalProps> = ({
  loop,
  isOpen,
  onClose,
  onEdit,
}) => {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  // Fetch journals for display names
  const { data: allJournals = [] } = useQuery({
    queryKey: ["journals", "selection", user.restrictedTopLevelJournalId],
    queryFn: () => fetchJournalsForSelection(user.restrictedTopLevelJournalId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Create journal lookup map
  const journalMap = useMemo(() => {
    return allJournals.reduce((acc, journal) => {
      acc[journal.id] = journal;
      return acc;
    }, {} as Record<string, any>);
  }, [allJournals]);

  // Update loop status mutation
  const updateLoopMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      updateLoop(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loops"] });
    },
  });

  // Delete loop mutation
  const deleteLoopMutation = useMutation({
    mutationFn: deleteLoop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loops"] });
      onClose();
    },
  });

  const handleToggleStatus = () => {
    const newStatus = loop.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    updateLoopMutation.mutate({
      id: loop.id,
      updates: { status: newStatus }
    });
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the loop "${loop.name}"? This action cannot be undone.`)) {
      deleteLoopMutation.mutate(loop.id);
    }
  };

  // Sort connections by sequence for proper path display
  const sortedConnections = useMemo(() => {
    return [...loop.journalConnections].sort((a, b) => a.sequence - b.sequence);
  }, [loop.journalConnections]);

  // Get complete loop path with journal names
  const loopPath = useMemo(() => {
    const path = sortedConnections.map(conn => {
      const journal = journalMap[conn.fromJournalId];
      return {
        id: conn.fromJournalId,
        name: journal?.name || `Journal ${conn.fromJournalId}`,
        isTerminal: journal?.isTerminal || false,
      };
    });

    // Add closing connection back to first journal
    if (path.length > 0) {
      path.push({ ...path[0] });
    }

    return path;
  }, [sortedConnections, journalMap]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return styles.statusBadgeActive;
      case "INACTIVE":
        return styles.statusBadgeInactive;
      case "DRAFT":
        return styles.statusBadgeDraft;
      default:
        return styles.statusBadgeDefault;
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={styles.modalOverlay}
      onClick={onClose}
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
          <div className={styles.headerLeft}>
            <h2 className={styles.modalTitle}>{loop.name}</h2>
            <div className={`${styles.statusBadge} ${getStatusBadgeClass(loop.status)}`}>
              {loop.status}
            </div>
          </div>
          <div className={styles.headerActions}>
            {onEdit && (
              <button
                onClick={() => onEdit(loop)}
                className={styles.actionButton}
                title="Edit Loop"
                disabled={updateLoopMutation.isPending}
              >
                <IoCreate />
              </button>
            )}
            <button
              onClick={handleToggleStatus}
              className={styles.actionButton}
              title={loop.status === "ACTIVE" ? "Deactivate" : "Activate"}
              disabled={updateLoopMutation.isPending}
            >
              {loop.status === "ACTIVE" ? <IoPause /> : <IoPlay />}
            </button>
            <button
              onClick={handleDelete}
              className={`${styles.actionButton} ${styles.actionButtonDanger}`}
              title="Delete Loop"
              disabled={deleteLoopMutation.isPending}
            >
              <IoTrash />
            </button>
            <button
              onClick={onClose}
              className={styles.closeButton}
              title="Close"
            >
              <IoClose />
            </button>
          </div>
        </div>

        <div className={styles.modalBody}>
          {/* Description */}
          {loop.description && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Description</h3>
              <p className={styles.description}>{loop.description}</p>
            </div>
          )}

          {/* Loop Visualization */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Loop Visualization</h3>
            <div className={styles.visualizationContainer}>
              <LoopVisualization
                loop={loop}
                journalMap={journalMap}
                compact={false}
              />
            </div>
          </div>

          {/* Vertical Path Display */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Transaction Flow Path</h3>
            <div className={styles.pathContainer}>
              {loopPath.map((journal, index) => (
                <div key={`${journal.id}-${index}`} className={styles.pathStep}>
                  <div className={styles.pathStepContent}>
                    <div className={styles.stepNumber}>{index + 1}</div>
                    <div className={styles.stepDetails}>
                      <div className={styles.journalName}>{journal.name}</div>
                      <div className={styles.journalId}>ID: {journal.id}</div>
                      {journal.isTerminal && (
                        <div className={styles.terminalBadge}>Terminal</div>
                      )}
                    </div>
                    {index < loopPath.length - 1 && (
                      <div className={styles.transactionType}>
                        {index === loopPath.length - 2 ? (
                          <span className={styles.closingFlow}>
                            ← Closes loop back to start
                          </span>
                        ) : (
                          <span className={styles.normalFlow}>
                            → Credit flows to next journal
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {index < loopPath.length - 1 && (
                    <div className={styles.pathArrow}>↓</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Loop Information */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Loop Information</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Total Journals:</span>
                <span className={styles.infoValue}>{loop.journalConnections.length}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Created:</span>
                <span className={styles.infoValue}>
                  {new Date(loop.createdAt).toLocaleDateString()} at{" "}
                  {new Date(loop.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Last Updated:</span>
                <span className={styles.infoValue}>
                  {new Date(loop.updatedAt).toLocaleDateString()} at{" "}
                  {new Date(loop.updatedAt).toLocaleTimeString()}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Status:</span>
                <span className={styles.infoValue}>
                  <span className={`${styles.statusBadge} ${getStatusBadgeClass(loop.status)}`}>
                    {loop.status}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Overlay */}
        {(updateLoopMutation.isPending || deleteLoopMutation.isPending) && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner}></div>
            <p>
              {updateLoopMutation.isPending && "Updating loop..."}
              {deleteLoopMutation.isPending && "Deleting loop..."}
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default LoopDetailsModal;