import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoChevronDown, IoChevronUp, IoLinkOutline, IoCheckmarkCircle, IoSearchOutline, IoClose, IoAdd } from "react-icons/io5";
import { useQuery } from "@tanstack/react-query";
import { fetchLoops } from "@/services/clientLoopService";
import VisualLoopSelector from "./VisualLoopSelector";
import JournalModal from "./JournalModal";
import LoopVisualization from "@/features/loops/components/LoopVisualization";
import { useJournalManager } from "../useJournalManager";
import { AccountNodeData } from "@/lib/types/ui";
import styles from "./LoopIntegrationSection.module.css";

interface EnhancedLoopIntegrationData {
  beforeJournalId?: string;
  afterJournalId?: string;
  selectedLoopId?: string;
  createNewLoop?: boolean;
  newLoopName?: string;
  newLoopDescription?: string;
  insertAfterJournalId?: string;
  insertBeforeJournalId?: string;
}

interface EnhancedLoopIntegrationSectionProps {
  onLoopDataChange: (data: EnhancedLoopIntegrationData | null) => void;
  availableJournals: Array<{ id: string; name: string; code: string }>;
  newJournalId?: string;
  newJournalName?: string;
}

interface DetectedConnection {
  connectionExists: boolean;
  loops: Array<{
    id: string;
    name: string;
    path: Array<{ id: string; name: string }>;
  }>;
}

export const EnhancedLoopIntegrationSection: React.FC<EnhancedLoopIntegrationSectionProps> = ({
  onLoopDataChange,
  availableJournals,
  newJournalId,
  newJournalName,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [beforeJournalId, setBeforeJournalId] = useState<string>("");
  const [afterJournalId, setAfterJournalId] = useState<string>("");
  const [detectedConnection, setDetectedConnection] = useState<DetectedConnection | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [selectedLoopForManual, setSelectedLoopForManual] = useState<string>("");
  const [createNewLoop, setCreateNewLoop] = useState(false);
  const [insertAfterJournalId, setInsertAfterJournalId] = useState<string>("");
  const [insertBeforeJournalId, setInsertBeforeJournalId] = useState<string>("");
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [modalSelectionType, setModalSelectionType] = useState<'before' | 'after'>('before');
  const [newLoopName, setNewLoopName] = useState<string>("");
  const [newLoopDescription, setNewLoopDescription] = useState<string>("");

  // Get journal hierarchy for modal
  const journalManager = useJournalManager();

  // Fetch available loops
  const { data: loops = [], isLoading: isLoadingLoops } = useQuery({
    queryKey: ["loops"],
    queryFn: () => fetchLoops(),
    staleTime: 5 * 60 * 1000,
  });


  // Create journal map for visualization
  const journalMap = useMemo(() => {
    return availableJournals.reduce((acc, journal) => {
      acc[journal.id] = journal;
      return acc;
    }, {} as Record<string, any>);
  }, [availableJournals]);

  // Modal handlers
  const openJournalModal = (type: 'before' | 'after') => {
    setModalSelectionType(type);
    setIsJournalModalOpen(true);
  };

  const handleJournalSelection = (node: AccountNodeData) => {
    if (modalSelectionType === 'before') {
      setBeforeJournalId(node.id);
    } else {
      setAfterJournalId(node.id);
    }
    setIsJournalModalOpen(false);
    // Reset manual selections when changing journal selections
    setSelectedLoopForManual("");
    setCreateNewLoop(false);
    setInsertAfterJournalId("");
    setInsertBeforeJournalId("");
  };

  // Get selected loop for preview
  const selectedLoop = useMemo(() => {
    if (detectedConnection?.connectionExists && detectedConnection.loops.length > 0) {
      return loops.find(loop => loop.id === detectedConnection.loops[0].id);
    }
    if (selectedLoopForManual) {
      return loops.find(loop => loop.id === selectedLoopForManual);
    }
    return null;
  }, [detectedConnection, selectedLoopForManual, loops]);

  // Check if new journal already exists in selected loop
  const journalExistsInLoop = useMemo(() => {
    if (!selectedLoop || !newJournalId) return false;

    const existingJournalIds = new Set();
    selectedLoop.journalConnections.forEach(conn => {
      existingJournalIds.add(conn.fromJournalId);
      existingJournalIds.add(conn.toJournalId);
    });

    return existingJournalIds.has(newJournalId);
  }, [selectedLoop, newJournalId]);

  // Detect connection when both journals are selected
  useEffect(() => {
    const detectConnection = async () => {
      console.log('🔍 detectConnection: Called with', { beforeJournalId, afterJournalId });

      if (!beforeJournalId || !afterJournalId) {
        console.log('🔍 detectConnection: Missing journals, clearing detection');
        setDetectedConnection(null);
        return;
      }

      console.log('🔍 detectConnection: Starting detection...');
      setIsDetecting(true);
      try {
        const response = await fetch('/api/loops/detect-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            beforeJournalId,
            afterJournalId,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('🔍 detectConnection: Result received', result);
          setDetectedConnection(result);
        }
      } catch (error) {
        console.error('Error detecting connection:', error);
        setDetectedConnection(null);
      } finally {
        setIsDetecting(false);
      }
    };

    detectConnection();
  }, [beforeJournalId, afterJournalId]);

  // Update parent when integration data changes
  useEffect(() => {
    // If journal already exists in any selected loop, don't send integration data
    if (journalExistsInLoop) {
      onLoopDataChange(null);
      return;
    }

    const data: EnhancedLoopIntegrationData = {
      beforeJournalId: beforeJournalId || undefined,
      afterJournalId: afterJournalId || undefined,
    };

    if (detectedConnection?.connectionExists && detectedConnection.loops.length > 0) {
      data.selectedLoopId = detectedConnection.loops[0].id;
    } else if (selectedLoopForManual) {
      data.selectedLoopId = selectedLoopForManual;
    } else if (createNewLoop && beforeJournalId && afterJournalId) {
      data.createNewLoop = true;
      data.newLoopName = newLoopName;
      data.newLoopDescription = newLoopDescription;
    }

    if (insertAfterJournalId) data.insertAfterJournalId = insertAfterJournalId;
    if (insertBeforeJournalId) data.insertBeforeJournalId = insertBeforeJournalId;

    // Only send data if we have meaningful integration information
    if (data.selectedLoopId || data.createNewLoop || data.beforeJournalId || data.afterJournalId) {
      onLoopDataChange(data);
    } else {
      onLoopDataChange(null);
    }
  }, [
    beforeJournalId,
    afterJournalId,
    detectedConnection,
    selectedLoopForManual,
    createNewLoop,
    newLoopName,
    newLoopDescription,
    insertAfterJournalId,
    insertBeforeJournalId,
    onLoopDataChange,
    journalExistsInLoop,
  ]);

  // Generate preview loop for new loop creation
  const previewLoop = useMemo(() => {
    if (!createNewLoop || !beforeJournalId || !afterJournalId || !newJournalId) return null;

    // Create a temporary loop structure for visualization
    return {
      id: 'preview',
      name: newLoopName || 'New Loop',
      description: newLoopDescription || '',
      journalConnections: [
        {
          id: '1',
          sequence: 1,
          fromJournalId: beforeJournalId,
          toJournalId: newJournalId,
          loopId: 'preview',
          createdAt: new Date(),
          updatedAt: new Date(),
          fromJournal: { id: beforeJournalId, name: availableJournals.find(j => j.id === beforeJournalId)?.name || '' },
          toJournal: { id: newJournalId, name: `J${newJournalId}` }
        },
        {
          id: '2',
          sequence: 2,
          fromJournalId: newJournalId,
          toJournalId: afterJournalId,
          loopId: 'preview',
          createdAt: new Date(),
          updatedAt: new Date(),
          fromJournal: { id: newJournalId, name: `J${newJournalId}` },
          toJournal: { id: afterJournalId, name: availableJournals.find(j => j.id === afterJournalId)?.name || '' }
        },
        {
          id: '3',
          sequence: 3,
          fromJournalId: afterJournalId,
          toJournalId: beforeJournalId,
          loopId: 'preview',
          createdAt: new Date(),
          updatedAt: new Date(),
          fromJournal: { id: afterJournalId, name: availableJournals.find(j => j.id === afterJournalId)?.name || '' },
          toJournal: { id: beforeJournalId, name: availableJournals.find(j => j.id === beforeJournalId)?.name || '' }
        },
      ],
      status: 'ACTIVE' as const,
      entityState: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdById: 'preview',
      createdByIp: 'preview',
      deletedById: null as any,
      deletedByIp: null as any,
      deletedAt: null as any,
    };
  }, [createNewLoop, beforeJournalId, afterJournalId, newJournalId, newLoopName, newLoopDescription]);

  const handleJournalSelect = (journalId: string, type: 'before' | 'after') => {
    if (type === 'before') {
      setBeforeJournalId(journalId);
    } else {
      setAfterJournalId(journalId);
    }
    // Reset manual selections when changing journal selections
    setSelectedLoopForManual("");
    setCreateNewLoop(false);
    setInsertAfterJournalId("");
    setInsertBeforeJournalId("");
  };

  const handleClearSelection = (type: 'before' | 'after') => {
    if (type === 'before') {
      setBeforeJournalId("");
    } else {
      setAfterJournalId("");
    }
  };

  const renderJournalSelector = (
    value: string,
    onClear: () => void,
    label: string,
    type: 'before' | 'after'
  ) => {
    const selectedJournal = availableJournals.find(j => j.id === value);

    return (
      <div className={styles.formGroup}>
        <label>{label}</label>
        <div className={styles.journalSelectorContainer}>
          {selectedJournal ? (
            <div className={styles.selectedJournal}>
              <span>{selectedJournal.code} - {selectedJournal.name}</span>
              <button type="button" onClick={onClear} className={styles.clearButton}>
                <IoClose />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openJournalModal(type)}
              className={styles.selectJournalButton}
            >
              <IoAdd className={styles.addIcon} />
              Select Journal
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderDetectedConnection = () => {
    if (!detectedConnection?.connectionExists || !detectedConnection.loops.length) return null;

    const detectedLoop = detectedConnection.loops[0];
    const beforeJournal = availableJournals.find(j => j.id === beforeJournalId);
    const afterJournal = availableJournals.find(j => j.id === afterJournalId);

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.detectedConnection}
      >
        <div className={styles.detectionHeader}>
          <IoCheckmarkCircle className={styles.successIcon} />
          <h4>✓ Connection Detected!</h4>
        </div>

        <p className={styles.detectionMessage}>
          Found existing connection <strong>{beforeJournal?.code} → {afterJournal?.code}</strong> in:
        </p>
        <p className={styles.loopName}>"{detectedLoop.name}"</p>

        <div className={styles.insertionPrompt}>
          {journalExistsInLoop ? (
            <div className={styles.warningMessage}>
              <p>⚠️ <strong>Cannot insert J{newJournalId}</strong> - this journal already exists in the loop.</p>
              <p>Please select different before/after journals or choose a different loop.</p>
            </div>
          ) : (
            <>
              <p>Insert <strong>J{newJournalId}</strong> between {beforeJournal?.code} and {afterJournal?.code}?</p>
              <p className={styles.resultPreview}>
                This will create the connection: {beforeJournal?.code} → <strong>J{newJournalId}</strong> → {afterJournal?.code}
              </p>
            </>
          )}

          <div className={styles.detectionActions}>
            <button
              type="button"
              onClick={() => {
                // Accept the automatic detection
                setSelectedLoopForManual("");
                setCreateNewLoop(false);
              }}
              className={styles.primaryButton}
              disabled={journalExistsInLoop}
            >
              {journalExistsInLoop ? 'Cannot Insert (Duplicate)' : 'Insert Here'}
            </button>
            <button
              type="button"
              onClick={() => {
                // Continue to manual selection
                setDetectedConnection(null);
              }}
              className={styles.secondaryButton}
            >
              Choose Different Loop
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderManualSelection = () => {
    if (detectedConnection?.connectionExists) return null;

    const shouldShowOptions = beforeJournalId || afterJournalId || (!beforeJournalId && !afterJournalId);
    const canCreateNewLoop = beforeJournalId && afterJournalId;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.manualSelection}
      >
        <h4>Select Loop for Journal Integration</h4>

        <div className={styles.optionGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="loopOption"
              checked={!!selectedLoopForManual}
              onChange={() => {
                setSelectedLoopForManual(loops[0]?.id || "");
                setCreateNewLoop(false);
              }}
            />
            <span>Add to existing loop</span>
          </label>

          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="loopOption"
              checked={createNewLoop}
              onChange={() => {
                setCreateNewLoop(true);
                setSelectedLoopForManual("");
              }}
              disabled={!canCreateNewLoop}
            />
            <span>Create new loop {!canCreateNewLoop && "(requires both before/after journals)"}</span>
          </label>
        </div>

        {selectedLoopForManual && (
          <div className={styles.formGroup}>
            <label>Select Loop:</label>
            <select
              value={selectedLoopForManual}
              onChange={(e) => setSelectedLoopForManual(e.target.value)}
              className={styles.select}
              disabled={isLoadingLoops}
            >
              <option value="">
                {isLoadingLoops ? "Loading loops..." : "Select a loop"}
              </option>
              {loops.map((loop) => (
                <option key={loop.id} value={loop.id}>
                  {loop.name} ({loop.journalConnections?.length || 0} journals)
                </option>
              ))}
            </select>
          </div>
        )}
      </motion.div>
    );
  };

  // Simple preview - just show original loop for detected connections
  const modifiedLoop = useMemo(() => {
    // If journal already exists in loop, return null to prevent display
    if (journalExistsInLoop) {
      return null;
    }

    // For detected connections, just return the original loop
    // We'll show a simple text preview instead of trying to modify the visualization
    return selectedLoop;
  }, [selectedLoop, journalExistsInLoop]);

  // Create enhanced journal map that includes the new journal
  const enhancedJournalMap = useMemo(() => {
    return {
      ...journalMap,
      ...(newJournalId ? {
        [newJournalId]: {
          id: newJournalId,
          code: `J${newJournalId}`,
          name: newJournalName || `Journal ${newJournalId}`,
          isTerminal: true
        }
      } : {})
    };
  }, [journalMap, newJournalId, newJournalName]);

  // Create enhanced journal map for the manual selector
  const enhancedJournalMapForSelector = useMemo(() => {
    return {
      ...journalMap,
      ...(newJournalId ? {
        [newJournalId]: {
          id: newJournalId,
          code: `J${newJournalId}`,
          name: newJournalName || `Journal ${newJournalId}`,
          isTerminal: true
        }
      } : {})
    };
  }, [journalMap, newJournalId, newJournalName]);

  const renderLoopPreview = () => {
    if (!selectedLoop) return null;

    // For manual selection, show the visual loop selector
    if (!detectedConnection?.connectionExists) {
      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.loopPreview}
        >
          <h4>Loop: "{selectedLoop.name}"</h4>
          <VisualLoopSelector
            loop={selectedLoop}
            journalMap={enhancedJournalMapForSelector}
            newJournalId={newJournalId}
            newJournalName={newJournalName}
            onInsertionPointsChange={(afterId, beforeId) => {
              setInsertAfterJournalId(afterId || "");
              setInsertBeforeJournalId(beforeId || "");
            }}
            compact={true}
            beforeJournalId={beforeJournalId}
            afterJournalId={afterJournalId}
          />
        </motion.div>
      );
    }

    // Check if journal already exists in the loop
    if (journalExistsInLoop) {
      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.loopPreview}
        >
          <div className={styles.warningMessage}>
            <h4>⚠️ Cannot Insert Journal</h4>
            <p>Journal <strong>J{newJournalId}</strong> already exists in loop "{selectedLoop.name}".</p>
            <p>Duplicate journals are not allowed in loops. Please select different before/after journals or choose a different loop.</p>
          </div>
        </motion.div>
      );
    }

    // For detected connections, show simple preview
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.loopPreview}
      >
        <h4>Loop Preview: "{selectedLoop.name}"</h4>
        <div className={styles.detectedPreview}>
          <p>Will insert <strong>J{newJournalId}</strong> between {beforeJournalId} and {afterJournalId}</p>

          {modifiedLoop && (
            <LoopVisualization
              loop={modifiedLoop}
              journalMap={enhancedJournalMap}
              compact={true}
              className={styles.previewVisualization}
              selectedJournalIds={newJournalId ? [newJournalId] : []}
            />
          )}
        </div>
      </motion.div>
    );
  };

  const renderNewLoopForm = () => {
    if (!createNewLoop) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.newLoopForm}
      >
        <h4>Create New Loop</h4>
        <div className={styles.formGroup}>
          <label>Loop Name *</label>
          <input
            type="text"
            value={newLoopName}
            onChange={(e) => setNewLoopName(e.target.value)}
            placeholder="Enter loop name"
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Description (Optional)</label>
          <textarea
            value={newLoopDescription}
            onChange={(e) => setNewLoopDescription(e.target.value)}
            placeholder="Enter loop description"
            className={styles.textarea}
          />
        </div>

        {previewLoop && (
          <div className={styles.newLoopPreview}>
            <h5>Loop Preview</h5>
            <LoopVisualization
              loop={previewLoop}
              journalMap={journalMap}
              compact={true}
              className={styles.newLoopVisualization}
            />
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className={styles.loopIntegrationSection}>
      <div className={styles.sectionHeader} onClick={() => setIsExpanded(!isExpanded)}>
        <IoLinkOutline className={styles.sectionIcon} />
        <span className={styles.sectionTitle}>Connect J{newJournalId} to Existing Loops</span>
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
            {/* Phase 2: Connection Selection */}
            <div className={styles.connectionInterface}>
              {renderJournalSelector(
                beforeJournalId,
                () => handleClearSelection('before'),
                "Before Journal (Optional):",
                'before'
              )}

              {renderJournalSelector(
                afterJournalId,
                () => handleClearSelection('after'),
                "After Journal (Optional):",
                'after'
              )}

              {/* Preview Chain */}
              {(beforeJournalId || afterJournalId) && (
                <div className={styles.previewChain}>
                  <span>Preview Chain: </span>
                  {beforeJournalId && <span>{beforeJournalId}</span>}
                  {beforeJournalId && <span className={styles.arrow}>→</span>}
                  <strong>J{newJournalId}</strong>
                  {afterJournalId && <span className={styles.arrow}>→</span>}
                  {afterJournalId && <span>{afterJournalId}</span>}
                </div>
              )}
            </div>

            {/* Phase 3: Automatic Detection or Manual Selection */}
            {isDetecting && (
              <div className={styles.detecting}>
                <span>Detecting existing connections...</span>
              </div>
            )}

            {renderDetectedConnection()}
            {renderManualSelection()}
            {renderNewLoopForm()}
            {renderLoopPreview()}
          </motion.div>
        )}
      </AnimatePresence>

      <JournalModal
        isOpen={isJournalModalOpen}
        onClose={() => setIsJournalModalOpen(false)}
        hierarchy={journalManager.hierarchyData}
        onSelectForLinking={handleJournalSelection}
        modalTitle={`Select ${modalSelectionType === 'before' ? 'Before' : 'After'} Journal`}
      />
    </div>
  );
};

export type { EnhancedLoopIntegrationData };