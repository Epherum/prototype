import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoAdd, IoChevronDown, IoChevronUp, IoLinkOutline } from "react-icons/io5";
import { useQuery } from "@tanstack/react-query";
import { fetchLoops } from "@/services/clientLoopService";
import { LoopWithConnections } from "@/lib/schemas/loop.schema";
import styles from "./LoopIntegrationSection.module.css";

interface LoopIntegrationData {
  loopId?: string;
  newLoop?: {
    name: string;
    description?: string;
  };
  forwardToJournalId?: string;
  backwardFromJournalId?: string;
}

interface LoopIntegrationSectionProps {
  onLoopDataChange: (data: LoopIntegrationData | null) => void;
  availableJournals: Array<{ id: string; name: string; code: string }>;
}

export const LoopIntegrationSection: React.FC<LoopIntegrationSectionProps> = ({
  onLoopDataChange,
  availableJournals,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [integrationMode, setIntegrationMode] = useState<"none" | "existing" | "new">("none");
  const [selectedLoopId, setSelectedLoopId] = useState<string>("");
  const [newLoopName, setNewLoopName] = useState("");
  const [newLoopDescription, setNewLoopDescription] = useState("");
  const [forwardToJournalId, setForwardToJournalId] = useState<string>("");
  const [backwardFromJournalId, setBackwardFromJournalId] = useState<string>("");

  // Fetch available loops (all statuses to ensure we can see existing loops)
  const { data: loops = [], isLoading: isLoadingLoops } = useQuery({
    queryKey: ["loops"],
    queryFn: () => fetchLoops(), // Fetch all loops regardless of status
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update parent when integration data changes
  useEffect(() => {
    if (integrationMode === "none") {
      onLoopDataChange(null);
      return;
    }

    const data: LoopIntegrationData = {};

    if (integrationMode === "existing" && selectedLoopId) {
      data.loopId = selectedLoopId;
    } else if (integrationMode === "new" && newLoopName.trim()) {
      data.newLoop = {
        name: newLoopName.trim(),
        description: newLoopDescription.trim() || undefined,
      };
    }

    if (forwardToJournalId) {
      data.forwardToJournalId = forwardToJournalId;
    }
    if (backwardFromJournalId) {
      data.backwardFromJournalId = backwardFromJournalId;
    }

    // Only send data if we have essential information
    if (data.loopId || data.newLoop) {
      onLoopDataChange(data);
    } else {
      onLoopDataChange(null);
    }
  }, [
    integrationMode,
    selectedLoopId,
    newLoopName,
    newLoopDescription,
    forwardToJournalId,
    backwardFromJournalId,
    onLoopDataChange,
  ]);

  const handleModeChange = (mode: "none" | "existing" | "new") => {
    setIntegrationMode(mode);
    // Reset form fields when changing modes
    setSelectedLoopId("");
    setNewLoopName("");
    setNewLoopDescription("");
    setForwardToJournalId("");
    setBackwardFromJournalId("");
  };

  return (
    <div className={styles.loopIntegrationSection}>
      <div className={styles.sectionHeader} onClick={() => setIsExpanded(!isExpanded)}>
        <IoLinkOutline className={styles.sectionIcon} />
        <span className={styles.sectionTitle}>Loop Integration (Optional)</span>
        {isExpanded ? <IoChevronUp /> : <IoChevronDown />}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={styles.expandedContent}
          >
            {/* Integration Mode Selection */}
            <div className={styles.modeSelection}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="loopMode"
                  value="none"
                  checked={integrationMode === "none"}
                  onChange={() => handleModeChange("none")}
                />
                <span>No Loop Integration</span>
              </label>

              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="loopMode"
                  value="existing"
                  checked={integrationMode === "existing"}
                  onChange={() => handleModeChange("existing")}
                />
                <span>Add to Existing Loop</span>
              </label>

              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="loopMode"
                  value="new"
                  checked={integrationMode === "new"}
                  onChange={() => handleModeChange("new")}
                />
                <span>Create New Loop</span>
              </label>
            </div>

            {/* Existing Loop Selection */}
            {integrationMode === "existing" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.formGroup}
              >
                <label htmlFor="existingLoop">Select Loop:</label>
                <select
                  id="existingLoop"
                  value={selectedLoopId}
                  onChange={(e) => setSelectedLoopId(e.target.value)}
                  className={styles.select}
                  disabled={isLoadingLoops}
                >
                  <option value="">
                    {isLoadingLoops ? "Loading loops..." : "Select a loop"}
                  </option>
                  {loops.map((loop) => (
                    <option key={loop.id} value={loop.id}>
                      {loop.name} ({loop.journalConnections.length} journals) - {loop.status}
                    </option>
                  ))}
                </select>
              </motion.div>
            )}

            {/* New Loop Creation */}
            {integrationMode === "new" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.newLoopForm}
              >
                <div className={styles.formGroup}>
                  <label htmlFor="newLoopName">Loop Name:</label>
                  <input
                    type="text"
                    id="newLoopName"
                    value={newLoopName}
                    onChange={(e) => setNewLoopName(e.target.value)}
                    placeholder="e.g., Sales Process Loop"
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="newLoopDescription">Description (Optional):</label>
                  <textarea
                    id="newLoopDescription"
                    value={newLoopDescription}
                    onChange={(e) => setNewLoopDescription(e.target.value)}
                    placeholder="Brief description of the loop's purpose"
                    className={styles.textarea}
                    rows={2}
                  />
                </div>
              </motion.div>
            )}

            {/* Connection Configuration */}
            {integrationMode !== "none" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.connectionConfig}
              >
                <h4 className={styles.connectionTitle}>Journal Connections</h4>
                <p className={styles.connectionHint}>
                  Configure how this journal connects within the loop
                </p>

                <div className={styles.connectionRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="forwardTo">Connects Forward To:</label>
                    <select
                      id="forwardTo"
                      value={forwardToJournalId}
                      onChange={(e) => setForwardToJournalId(e.target.value)}
                      className={styles.select}
                    >
                      <option value="">Select journal (optional)</option>
                      {availableJournals.map((journal) => (
                        <option key={journal.id} value={journal.id}>
                          {journal.code} - {journal.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="backwardFrom">Connects Backward From:</label>
                    <select
                      id="backwardFrom"
                      value={backwardFromJournalId}
                      onChange={(e) => setBackwardFromJournalId(e.target.value)}
                      className={styles.select}
                    >
                      <option value="">Select journal (optional)</option>
                      {availableJournals.map((journal) => (
                        <option key={journal.id} value={journal.id}>
                          {journal.code} - {journal.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export type { LoopIntegrationData };