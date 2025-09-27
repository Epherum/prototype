import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoCheckmarkCircle, IoWarning } from "react-icons/io5";
import { LoopWithConnections } from "@/lib/schemas/loop.schema";
import LoopVisualization from "@/features/loops/components/LoopVisualization";
import styles from "./VisualLoopSelector.module.css";

interface JournalNode {
  id: string;
  name: string;
  isTerminal: boolean;
  position: { x: number; y: number };
  sequence: number;
}

interface VisualLoopSelectorProps {
  loop: LoopWithConnections;
  journalMap: Record<string, any>;
  newJournalId?: string;
  newJournalName?: string;
  onInsertionPointsChange: (afterJournalId: string | null, beforeJournalId: string | null) => void;
  compact?: boolean;
  beforeJournalId?: string;
  afterJournalId?: string;
}

const VisualLoopSelector: React.FC<VisualLoopSelectorProps> = ({
  loop,
  journalMap,
  newJournalId,
  newJournalName,
  onInsertionPointsChange,
  compact = false,
  beforeJournalId,
  afterJournalId,
}) => {
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [isValidSelection, setIsValidSelection] = useState<boolean>(false);

  // Calculate node positions and connections
  const { nodes, connections } = useMemo(() => {
    const sortedConnections = [...loop.journalConnections].sort((a, b) => a.sequence - b.sequence);
    const journalCount = sortedConnections.length;

    if (journalCount === 0) {
      return { nodes: [], connections: [] };
    }

    // Calculate circle dimensions
    const radius = compact ? 80 : 120;
    const centerX = compact ? 100 : 150;
    const centerY = compact ? 100 : 150;

    // Create nodes with positions
    const nodes: JournalNode[] = sortedConnections.map((conn, index) => {
      const angle = (index * 2 * Math.PI) / journalCount - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      const journal = journalMap[conn.fromJournalId];
      return {
        id: conn.fromJournalId,
        name: journal?.name || `Journal ${conn.fromJournalId}`,
        isTerminal: journal?.isTerminal || false,
        position: { x, y },
        sequence: conn.sequence,
      };
    });

    // Create connection lines
    const connectionLines = sortedConnections.map((conn, index) => {
      const fromNode = nodes[index];
      const toNode = nodes[(index + 1) % nodes.length];

      return {
        id: `${conn.fromJournalId}-${conn.toJournalId}`,
        from: fromNode,
        to: toNode,
        sequence: conn.sequence,
        fromJournalId: conn.fromJournalId,
        toJournalId: conn.toJournalId,
      };
    });

    return { nodes, connections: connectionLines };
  }, [loop.journalConnections, journalMap, compact]);

  // Check if two nodes are adjacent
  const areNodesAdjacent = (nodeId1: string, nodeId2: string): boolean => {
    const connection = connections.find(
      conn =>
        (conn.fromJournalId === nodeId1 && conn.toJournalId === nodeId2) ||
        (conn.fromJournalId === nodeId2 && conn.toJournalId === nodeId1)
    );
    return !!connection;
  };

  // Handle node clicks
  const handleNodeClick = (journalId: string) => {
    if (selectedNodes.includes(journalId)) {
      // Deselect the node
      setSelectedNodes(prev => prev.filter(id => id !== journalId));
    } else if (selectedNodes.length === 0) {
      // First selection
      setSelectedNodes([journalId]);
    } else if (selectedNodes.length === 1) {
      // Second selection - check if adjacent
      const firstNode = selectedNodes[0];
      if (areNodesAdjacent(firstNode, journalId)) {
        setSelectedNodes([firstNode, journalId]);
      } else {
        // Replace with new selection
        setSelectedNodes([journalId]);
      }
    } else {
      // Reset and start new selection (when clicking a third node)
      setSelectedNodes([journalId]);
    }
  };

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedNodes([]);
  };

  // Update validity and notify parent when selection changes
  useEffect(() => {
    if (selectedNodes.length === 2) {
      const [node1, node2] = selectedNodes;
      const adjacent = areNodesAdjacent(node1, node2);
      setIsValidSelection(adjacent);

      if (adjacent) {
        // Determine which node comes first in the loop sequence
        const connection = connections.find(conn =>
          (conn.fromJournalId === node1 && conn.toJournalId === node2) ||
          (conn.fromJournalId === node2 && conn.toJournalId === node1)
        );

        if (connection) {
          // The "after" node is where the new journal will be inserted after
          // The "before" node is where the new journal will connect to
          onInsertionPointsChange(connection.fromJournalId, connection.toJournalId);
        }
      } else {
        onInsertionPointsChange(null, null);
      }
    } else {
      setIsValidSelection(false);
      onInsertionPointsChange(null, null);
    }
  }, [selectedNodes, connections, onInsertionPointsChange]);


  const svgSize = compact ? 200 : 300;

  // Animation variants
  const nodeVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: (index: number) => ({
      scale: 1,
      opacity: 1,
      transition: {
        delay: index * 0.1,
        duration: 0.3,
        ease: "easeOut",
      },
    }),
    hover: {
      scale: 1.1,
      transition: { duration: 0.2 },
    },
  };

  const connectionVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: (index: number) => ({
      pathLength: 1,
      opacity: 1,
      transition: {
        delay: index * 0.1 + 0.3,
        duration: 0.5,
        ease: "easeInOut",
      },
    }),
  };

  if (nodes.length === 0) {
    return (
      <div className={styles.selector}>
        <div className={styles.emptyState}>
          <p>No loop data to display</p>
        </div>
      </div>
    );
  }

  // Calculate overlay nodes for chain insertion
  const overlayNodes = useMemo(() => {
    if (!isValidSelection || selectedNodes.length !== 2) {
      return [];
    }

    const [node1, node2] = selectedNodes;
    const connection = connections.find(conn =>
      (conn.fromJournalId === node1 && conn.toJournalId === node2) ||
      (conn.fromJournalId === node2 && conn.toJournalId === node1)
    );

    if (!connection) return [];

    const fromNode = connection.from;
    const toNode = connection.to;

    // Calculate positions along the connection line
    const dx = toNode.position.x - fromNode.position.x;
    const dy = toNode.position.y - fromNode.position.y;

    // Create chain of nodes
    const chainNodes = [];
    let currentIndex = 0;

    // Add beforeJournalId if specified
    if (beforeJournalId) {
      currentIndex++;
      const ratio = currentIndex / (1 + (beforeJournalId ? 1 : 0) + 1 + (afterJournalId ? 1 : 0));
      chainNodes.push({
        id: beforeJournalId,
        code: journalMap[beforeJournalId]?.code || beforeJournalId,
        name: journalMap[beforeJournalId]?.name || beforeJournalId,
        position: {
          x: fromNode.position.x + dx * ratio,
          y: fromNode.position.y + dy * ratio
        },
        type: 'before',
        isTerminal: journalMap[beforeJournalId]?.isTerminal || false
      });
    }

    // Add the new journal
    currentIndex++;
    const newJournalRatio = currentIndex / (1 + (beforeJournalId ? 1 : 0) + 1 + (afterJournalId ? 1 : 0));
    chainNodes.push({
      id: newJournalId || 'NEW',
      code: newJournalId || 'NEW',
      name: newJournalName || `Journal ${newJournalId || 'NEW'}`,
      position: {
        x: fromNode.position.x + dx * newJournalRatio,
        y: fromNode.position.y + dy * newJournalRatio
      },
      type: 'new',
      isTerminal: true
    });

    // Add afterJournalId if specified
    if (afterJournalId) {
      currentIndex++;
      const ratio = currentIndex / (1 + (beforeJournalId ? 1 : 0) + 1 + (afterJournalId ? 1 : 0));
      chainNodes.push({
        id: afterJournalId,
        code: journalMap[afterJournalId]?.code || afterJournalId,
        name: journalMap[afterJournalId]?.name || afterJournalId,
        position: {
          x: fromNode.position.x + dx * ratio,
          y: fromNode.position.y + dy * ratio
        },
        type: 'after',
        isTerminal: journalMap[afterJournalId]?.isTerminal || false
      });
    }

    return chainNodes;
  }, [isValidSelection, selectedNodes, connections, beforeJournalId, newJournalId, newJournalName, afterJournalId, journalMap]);

  // Update instructions based on preview state
  const instructionsContent = useMemo(() => {
    if (isValidSelection && selectedNodes.length === 2) {
      const chainDescription = (() => {
        const parts = [];
        if (beforeJournalId) parts.push(journalMap[beforeJournalId]?.code || beforeJournalId);
        parts.push(newJournalId || 'NEW');
        if (afterJournalId) parts.push(journalMap[afterJournalId]?.code || afterJournalId);
        return parts.join(' → ');
      })();

      return {
        title: "Chain Insertion Preview",
        description: (
          <>
            Inserting chain: <strong>{chainDescription}</strong> between{' '}
            <strong>{journalMap[selectedNodes[0]]?.code || selectedNodes[0]}</strong> and{' '}
            <strong>{journalMap[selectedNodes[1]]?.code || selectedNodes[1]}</strong>
          </>
        ),
        showBackButton: true
      };
    }

    return {
      title: "Select Insertion Point",
      description: (
        <>
          Click two adjacent journals where the new journal chain will be inserted.
          <AnimatePresence mode="wait">
            {selectedNodes.length === 1 && (
              <motion.span
                key="selected-hint"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                {' '}Selected: <strong>{journalMap[selectedNodes[0]]?.code || selectedNodes[0]}</strong>. Now select an adjacent journal.
              </motion.span>
            )}
          </AnimatePresence>
        </>
      ),
      showBackButton: false
    };
  }, [isValidSelection, selectedNodes, beforeJournalId, newJournalId, newJournalName, afterJournalId, journalMap]);

  return (
    <motion.div
      className={styles.selector}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <motion.div
        className={styles.instructions}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <h4>{instructionsContent.title}</h4>
        <p>{instructionsContent.description}</p>
        {(selectedNodes.length > 0 || instructionsContent.showBackButton) && (
          <motion.div
            className={styles.selectionActions}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={handleClearSelection}
              className={styles.clearSelectionButton}
              type="button"
            >
              {instructionsContent.showBackButton ? '← Choose Different Insertion Point' : 'Clear Selection'}
            </button>
          </motion.div>
        )}
      </motion.div>

      <motion.div
        className={styles.visualizationContainer}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className={styles.svg}
        >
          {/* Connection lines with arrows */}
          <defs>
            <marker
              id="arrowhead-selector"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
              className={styles.arrowMarker}
            >
              <polygon points="0 0, 10 3.5, 0 7" />
            </marker>
          </defs>

          {connections.map((connection, index) => {
            const isSelectedConnection = selectedNodes.length === 2 &&
              ((connection.fromJournalId === selectedNodes[0] && connection.toJournalId === selectedNodes[1]) ||
               (connection.fromJournalId === selectedNodes[1] && connection.toJournalId === selectedNodes[0]));

            // Calculate arrow position
            const dx = connection.to.position.x - connection.from.position.x;
            const dy = connection.to.position.y - connection.from.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const unitX = dx / distance;
            const unitY = dy / distance;

            // Adjust start and end points
            const nodeRadius = compact ? 20 : 25;
            const startX = connection.from.position.x + unitX * nodeRadius;
            const startY = connection.from.position.y + unitY * nodeRadius;
            const endX = connection.to.position.x - unitX * nodeRadius;
            const endY = connection.to.position.y - unitY * nodeRadius;

            return (
              <motion.path
                key={connection.id}
                d={`M ${startX} ${startY} L ${endX} ${endY}`}
                className={`${styles.connectionLine} ${
                  isSelectedConnection ? styles.selectedConnection : ''
                }`}
                markerEnd="url(#arrowhead-selector)"
                variants={connectionVariants}
                initial="hidden"
                animate="visible"
                custom={index}
              />
            );
          })}

          {/* Journal nodes */}
          {nodes.map((node, index) => {
            const isSelected = selectedNodes.includes(node.id);

            return (
              <g key={node.id}>
                <motion.circle
                  cx={node.position.x}
                  cy={node.position.y}
                  r={compact ? 20 : 25}
                  className={`${styles.journalNode} ${
                    node.isTerminal ? styles.terminalNode : styles.nonTerminalNode
                  } ${isSelected ? styles.selectedNode : ''}`}
                  variants={nodeVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  custom={index}
                  onClick={() => handleNodeClick(node.id)}
                />

                {/* Journal code/number */}
                <motion.text
                  x={node.position.x}
                  y={node.position.y}
                  className={styles.journalNumber}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  variants={nodeVariants}
                  initial="hidden"
                  animate="visible"
                  custom={index}
                  onClick={() => handleNodeClick(node.id)}
                >
                  {journalMap[node.id]?.code || node.id}
                </motion.text>

                {/* Selection indicators */}
                {isSelected && (
                  <motion.text
                    x={node.position.x}
                    y={node.position.y - (compact ? 35 : 45)}
                    className={styles.selectionLabel}
                    textAnchor="middle"
                    initial={{ opacity: 0, y: node.position.y - 10 }}
                    animate={{ opacity: 1, y: node.position.y - (compact ? 35 : 45) }}
                    transition={{ duration: 0.3 }}
                  >
                    {selectedNodes.indexOf(node.id) + 1}
                  </motion.text>
                )}
              </g>
            );
          })}

          {/* Overlay nodes for chain insertion preview */}
          <AnimatePresence>
            {overlayNodes.map((overlayNode, index) => (
              <motion.g
                key={`overlay-${overlayNode.id}-${index}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                {/* Overlay node circle */}
                <motion.circle
                  cx={overlayNode.position.x}
                  cy={overlayNode.position.y}
                  r={compact ? 18 : 23}
                  className={`${styles.overlayNode} ${
                    overlayNode.isTerminal ? styles.overlayTerminalNode : styles.overlayNonTerminalNode
                  } ${styles.overlaySelectedNode}`}
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* Overlay node text */}
                <motion.text
                  x={overlayNode.position.x}
                  y={overlayNode.position.y}
                  className={styles.overlayNodeText}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  animate={{
                    scale: [1, 1.02, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  {overlayNode.code}
                </motion.text>
              </motion.g>
            ))}
          </AnimatePresence>

          {/* Dim the selected connection when overlay is showing */}
          {overlayNodes.length > 0 && (
            <motion.rect
              x="0"
              y="0"
              width={svgSize}
              height={svgSize}
              fill="rgba(255, 255, 255, 0.1)"
              className={styles.overlayDim}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>

        {/* Status message */}
        <div className={styles.statusContainer}>
          <AnimatePresence mode="wait">
            {selectedNodes.length === 2 && (
              <motion.div
                key="two-selected"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`${styles.statusMessage} ${
                  isValidSelection ? styles.validStatus : styles.invalidStatus
                }`}
              >
                {isValidSelection ? (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      <IoCheckmarkCircle className={styles.statusIcon} />
                    </motion.div>
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                    >
                      Valid selection: Chain will be inserted between{' '}
                      <strong>{journalMap[selectedNodes[0]]?.code || selectedNodes[0]}</strong> and{' '}
                      <strong>{journalMap[selectedNodes[1]]?.code || selectedNodes[1]}</strong>
                    </motion.span>
                  </>
                ) : (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      <IoWarning className={styles.statusIcon} />
                    </motion.div>
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                    >
                      Invalid selection: Selected journals are not adjacent. Please select two journals
                      that are directly connected in the loop.
                    </motion.span>
                  </>
                )}
              </motion.div>
            )}

            {selectedNodes.length === 1 && (
              <motion.div
                key="one-selected"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={styles.statusMessage}
              >
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  Selected <strong>{journalMap[selectedNodes[0]]?.code || selectedNodes[0]}</strong>.
                  Now select an adjacent journal.
                </motion.span>
              </motion.div>
            )}

            {selectedNodes.length === 0 && (
              <motion.div
                key="none-selected"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={styles.statusMessage}
              >
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  Select the first journal to start defining the insertion point
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Journal list for reference */}
      <motion.div
        className={styles.journalReference}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <h5>Loop Structure:</h5>
        <div className={styles.referenceList}>
          {nodes.map((node, index) => {
            const isSelected = selectedNodes.includes(node.id);
            const selectionIndex = selectedNodes.indexOf(node.id);

            return (
              <motion.div
                key={node.id}
                className={`${styles.referenceItem} ${isSelected ? styles.selectedReference : ''}`}
                onClick={() => handleNodeClick(node.id)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + (index * 0.05) }}
                layout
              >
                <span className={styles.referenceSequence}>{index + 1}.</span>
                <span className={styles.referenceName} title={node.name}>
                  {journalMap[node.id]?.code || node.id} - {node.name}
                </span>
                <AnimatePresence>
                  {isSelected && (
                    <motion.span
                      className={styles.referenceLabel}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      Selected {selectionIndex + 1}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default VisualLoopSelector;