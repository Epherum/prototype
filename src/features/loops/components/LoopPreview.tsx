// src/features/loops/components/LoopPreview.tsx
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { IoArrowForward, IoCheckmarkCircle } from "react-icons/io5";
import { LoopWithConnections } from "@/lib/schemas/loop.schema";
import LoopVisualization from "./LoopVisualization";
import styles from "./LoopPreview.module.css";

interface LoopPreviewProps {
  currentLoop?: LoopWithConnections;
  newJournalId: string;
  newJournalName: string;
  journalMap: Record<string, any>;
  forwardToJournalId?: string;
  backwardFromJournalId?: string;
  onSwapJournals?: (journalId1: string, journalId2: string) => void;
  onForwardToChange?: (journalId: string) => void;
  onBackwardFromChange?: (journalId: string) => void;
  availableJournals: Array<{ id: string; name: string; code: string }>;
  newLoopName?: string;
}

const LoopPreview: React.FC<LoopPreviewProps> = ({
  currentLoop,
  newJournalId,
  newJournalName,
  journalMap,
  forwardToJournalId,
  backwardFromJournalId,
  onSwapJournals,
  onForwardToChange,
  onBackwardFromChange,
  availableJournals,
  newLoopName,
}) => {
  // Create enhanced journal map with new journal
  const enhancedJournalMap = useMemo(() => {
    return {
      ...journalMap,
      [newJournalId]: {
        id: newJournalId,
        name: newJournalName,
        isTerminal: true, // Assume new journal is terminal for preview
      },
    };
  }, [journalMap, newJournalId, newJournalName]);

  // Generate preview loop with the new journal integrated
  const previewLoop = useMemo(() => {
    if (currentLoop) {
      // Existing loop integration
      const currentConnections = [...currentLoop.journalConnections]
        .sort((a, b) => a.sequence - b.sequence);

      let newConnections = [...currentConnections];

      if (forwardToJournalId || backwardFromJournalId) {
        // Find insertion point
        let insertIndex = 0;

        if (backwardFromJournalId && forwardToJournalId) {
          // Insert between specific journals
          const backwardIndex = currentConnections.findIndex(
            conn => conn.fromJournalId === backwardFromJournalId
          );
          if (backwardIndex >= 0) {
            insertIndex = backwardIndex + 1;
          }
        } else if (backwardFromJournalId) {
          // Insert after specific journal
          const backwardIndex = currentConnections.findIndex(
            conn => conn.fromJournalId === backwardFromJournalId
          );
          if (backwardIndex >= 0) {
            insertIndex = backwardIndex + 1;
          }
        } else if (forwardToJournalId) {
          // Insert before specific journal
          const forwardIndex = currentConnections.findIndex(
            conn => conn.fromJournalId === forwardToJournalId
          );
          if (forwardIndex >= 0) {
            insertIndex = forwardIndex;
          }
        }

        // Update connection to point to new journal
        if (insertIndex > 0) {
          newConnections[insertIndex - 1] = {
            ...newConnections[insertIndex - 1],
            toJournalId: newJournalId,
          };
        }

        // Insert new journal connection
        const toJournalId = insertIndex < currentConnections.length
          ? currentConnections[insertIndex].fromJournalId
          : currentConnections[0].fromJournalId;

        newConnections.splice(insertIndex, 0, {
          id: `preview-new-${insertIndex}`,
          loopId: currentLoop.id,
          fromJournalId: newJournalId,
          toJournalId,
          sequence: insertIndex,
          createdAt: new Date(),
          updatedAt: new Date(),
          fromJournal: { id: newJournalId, name: newJournalName },
          toJournal: {
            id: toJournalId,
            name: enhancedJournalMap[toJournalId]?.name || `Journal ${toJournalId}`
          },
        });

        // Update sequences for subsequent connections
        for (let i = insertIndex + 1; i < newConnections.length; i++) {
          newConnections[i] = {
            ...newConnections[i],
            sequence: i,
          };
        }
      } else {
        // Add at the end by default
        const lastConnection = currentConnections[currentConnections.length - 1];
        const firstConnection = currentConnections[0];

        // Update last connection to point to new journal
        newConnections[newConnections.length - 1] = {
          ...lastConnection,
          toJournalId: newJournalId,
        };

        // Add new connection from new journal back to first journal
        newConnections.push({
          id: `preview-new-end`,
          loopId: currentLoop.id,
          fromJournalId: newJournalId,
          toJournalId: firstConnection.fromJournalId,
          sequence: newConnections.length,
          createdAt: new Date(),
          updatedAt: new Date(),
          fromJournal: { id: newJournalId, name: newJournalName },
          toJournal: {
            id: firstConnection.fromJournalId,
            name: enhancedJournalMap[firstConnection.fromJournalId]?.name || `Journal ${firstConnection.fromJournalId}`
          },
        });
      }

      return {
        ...currentLoop,
        journalConnections: newConnections,
      };
    } else {
      // New loop creation - start with just the new journal
      return {
        id: "preview-new-loop",
        name: newLoopName || "New Loop",
        description: null,
        status: "DRAFT" as const,
        entityState: "ACTIVE" as const,
        createdById: "",
        createdByIp: "",
        deletedById: "",
        deletedByIp: "",
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        journalConnections: [{
          id: "preview-single",
          loopId: "preview-new-loop",
          fromJournalId: newJournalId,
          toJournalId: newJournalId,
          sequence: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          fromJournal: { id: newJournalId, name: newJournalName },
          toJournal: { id: newJournalId, name: newJournalName },
        }],
      };
    }
  }, [currentLoop, newJournalId, newJournalName, forwardToJournalId, backwardFromJournalId, enhancedJournalMap, newLoopName]);

  // Get selected journals for swapping
  const [selectedJournalIds, setSelectedJournalIds] = React.useState<string[]>([]);

  const handleJournalSelect = (journalId: string) => {
    setSelectedJournalIds(prev => {
      if (prev.includes(journalId)) {
        return prev.filter(id => id !== journalId);
      } else if (prev.length < 2) {
        return [...prev, journalId];
      } else {
        return [prev[1], journalId]; // Replace first selection
      }
    });
  };

  const handleSwapJournals = (journalId1: string, journalId2: string) => {
    onSwapJournals?.(journalId1, journalId2);
    setSelectedJournalIds([]); // Clear selection after swap
  };

  return (
    <div className={styles.loopPreview}>
      <div className={styles.previewHeader}>
        <h4 className={styles.previewTitle}>
          {currentLoop ? `Preview: Adding "${newJournalName}" to "${currentLoop.name}"` : `Preview: New Loop with "${newJournalName}"`}
        </h4>
      </div>

      <div className={styles.previewContent}>
        {currentLoop && (
          <div className={styles.beforeAfter}>
            {/* Current state */}
            <div className={styles.currentState}>
              <h5 className={styles.stateTitle}>Current Loop</h5>
              <LoopVisualization
                loop={currentLoop}
                journalMap={journalMap}
                compact={true}
                className={styles.currentVisualization}
              />
            </div>

            {/* Arrow */}
            <div className={styles.arrow}>
              <IoArrowForward />
            </div>

            {/* Preview state */}
            <div className={styles.previewState}>
              <h5 className={styles.stateTitle}>After Adding Journal</h5>
              <LoopVisualization
                loop={previewLoop}
                journalMap={enhancedJournalMap}
                compact={true}
                className={styles.previewVisualization}
                selectedJournalIds={selectedJournalIds}
                onJournalSelect={handleJournalSelect}
                onSwapJournals={handleSwapJournals}
                allowSwapping={true}
              />
            </div>
          </div>
        )}

        {!currentLoop && (
          <div className={styles.newLoopPreview}>
            <LoopVisualization
              loop={previewLoop}
              journalMap={enhancedJournalMap}
              compact={false}
              className={styles.newLoopVisualization}
            />
            <div className={styles.newLoopHint}>
              <IoCheckmarkCircle />
              <span>This will create a new loop starting with "{newJournalName}". Add more journals to complete the loop.</span>
            </div>
          </div>
        )}

        {/* Connection Configuration for Existing Loops */}
        {currentLoop && (onForwardToChange || onBackwardFromChange) && (
          <div className={styles.connectionConfig}>
            <h5 className={styles.configTitle}>Fine-tune Journal Position</h5>
            <div className={styles.connectionControls}>
              {onBackwardFromChange && (
                <div className={styles.formGroup}>
                  <label htmlFor="backwardFrom">Insert After:</label>
                  <select
                    id="backwardFrom"
                    value={backwardFromJournalId || ""}
                    onChange={(e) => onBackwardFromChange(e.target.value)}
                    className={styles.select}
                  >
                    <option value="">Select position (optional)</option>
                    {currentLoop.journalConnections
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((conn) => {
                        const journal = journalMap[conn.fromJournalId];
                        return (
                          <option key={conn.fromJournalId} value={conn.fromJournalId}>
                            After: {journal?.name || `Journal ${conn.fromJournalId}`}
                          </option>
                        );
                      })}
                  </select>
                </div>
              )}

              {onForwardToChange && (
                <div className={styles.formGroup}>
                  <label htmlFor="forwardTo">Insert Before:</label>
                  <select
                    id="forwardTo"
                    value={forwardToJournalId || ""}
                    onChange={(e) => onForwardToChange(e.target.value)}
                    className={styles.select}
                  >
                    <option value="">Select position (optional)</option>
                    {currentLoop.journalConnections
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((conn) => {
                        const journal = journalMap[conn.fromJournalId];
                        return (
                          <option key={conn.fromJournalId} value={conn.fromJournalId}>
                            Before: {journal?.name || `Journal ${conn.fromJournalId}`}
                          </option>
                        );
                      })}
                  </select>
                </div>
              )}
            </div>
            <div className={styles.swapHint}>
              <span>💡 You can also click two journals in the preview to swap their positions</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoopPreview;