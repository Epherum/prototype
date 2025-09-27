//src/features/loops/components/LoopVisualization.tsx
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { LoopWithConnections } from "@/lib/schemas/loop.schema";
import styles from "./LoopVisualization.module.css";

interface JournalNode {
  id: string;
  name: string;
  isTerminal: boolean;
  position: { x: number; y: number };
}

interface LoopVisualizationProps {
  loop: LoopWithConnections;
  journalMap: Record<string, any>;
  compact?: boolean;
  className?: string;
  onJournalClick?: (journalId: string) => void;
  selectedJournalIds?: string[];
  onJournalSelect?: (journalId: string) => void;
  onSwapJournals?: (journalId1: string, journalId2: string) => void;
  allowSwapping?: boolean;
}

const LoopVisualization: React.FC<LoopVisualizationProps> = ({
  loop,
  journalMap,
  compact = true,
  className,
  onJournalClick,
  selectedJournalIds = [],
  onJournalSelect,
  onSwapJournals,
  allowSwapping = false,
}) => {
  // Calculate node positions in a circle
  const { nodes, connections } = useMemo(() => {
    console.log('🎨 LoopVisualization: Processing loop:', loop.name);
    console.log('🎨 LoopVisualization: Raw connections:', loop.journalConnections?.map(c => `${c.fromJournalId}→${c.toJournalId}`));

    const sortedConnections = [...loop.journalConnections].sort((a, b) => a.sequence - b.sequence);
    console.log('🎨 LoopVisualization: Sorted connections:', sortedConnections.map(c => `${c.fromJournalId}→${c.toJournalId}`));

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
      const angle = (index * 2 * Math.PI) / journalCount - Math.PI / 2; // Start from top
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      const journal = journalMap[conn.fromJournalId];
      return {
        id: conn.fromJournalId,
        name: journal?.name || `Journal ${conn.fromJournalId}`,
        isTerminal: journal?.isTerminal || false,
        position: { x, y },
      };
    });

    console.log('🎨 LoopVisualization: Created nodes:', nodes.map(n => `${n.id}(${n.name})`));

    // Create connection lines using actual connection data
    const connectionLines = sortedConnections.map((conn, index) => {
      const fromNode = nodes.find(node => node.id === conn.fromJournalId);
      const toNode = nodes.find(node => node.id === conn.toJournalId);

      if (!fromNode || !toNode) {
        console.error('🚨 LoopVisualization: Missing node for connection', conn);
        return null;
      }

      return {
        id: `${conn.fromJournalId}-${conn.toJournalId}`,
        from: fromNode,
        to: toNode,
        sequence: conn.sequence,
      };
    }).filter(Boolean); // Remove any null connections

    console.log('🎨 LoopVisualization: Created connections:', connectionLines.map(c => `${c.from.id}→${c.to.id}`));

    return { nodes, connections: connectionLines };
  }, [loop.journalConnections, journalMap, compact]);

  const svgSize = compact ? 200 : 300;

  // Calculate swap button position and visibility
  const { swapButtonVisible, swapButtonPosition } = useMemo(() => {
    if (!allowSwapping || selectedJournalIds.length !== 2) {
      return { swapButtonVisible: false, swapButtonPosition: { x: 0, y: 0 } };
    }

    // Calculate center position
    const centerX = svgSize / 2;
    const centerY = svgSize / 2;

    return {
      swapButtonVisible: true,
      swapButtonPosition: { x: centerX, y: centerY }
    };
  }, [allowSwapping, selectedJournalIds.length, svgSize]);

  const handleNodeClick = (journalId: string, event?: React.MouseEvent) => {
    if (allowSwapping && onJournalSelect) {
      // Handle selection for swapping
      onJournalSelect(journalId);
    } else if (onJournalClick) {
      // Handle single click
      onJournalClick(journalId);
    }
  };

  const handleSwapClick = () => {
    if (selectedJournalIds.length === 2 && onSwapJournals) {
      onSwapJournals(selectedJournalIds[0], selectedJournalIds[1]);
    }
  };

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
      <div className={`${styles.visualization} ${compact ? styles.compact : ''} ${className || ''}`}>
        <div className={styles.emptyState}>
          <p>No loop data to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.visualization} ${compact ? styles.compact : ''} ${className || ''}`}>
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className={styles.svg}
      >
        {/* Connection lines with arrows */}
        <defs>
          <marker
            id="arrowhead"
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
          // Calculate arrow position
          const dx = connection.to.position.x - connection.from.position.x;
          const dy = connection.to.position.y - connection.from.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const unitX = dx / distance;
          const unitY = dy / distance;

          // Adjust start and end points to not overlap nodes
          const nodeRadius = compact ? 20 : 25;
          const startX = connection.from.position.x + unitX * nodeRadius;
          const startY = connection.from.position.y + unitY * nodeRadius;
          const endX = connection.to.position.x - unitX * nodeRadius;
          const endY = connection.to.position.y - unitY * nodeRadius;

          return (
            <motion.path
              key={connection.id}
              d={`M ${startX} ${startY} L ${endX} ${endY}`}
              className={styles.connectionLine}
              markerEnd="url(#arrowhead)"
              variants={connectionVariants}
              initial="hidden"
              animate="visible"
              custom={index}
            />
          );
        })}

        {/* Journal nodes */}
        {nodes.map((node, index) => {
          const isSelected = node.id && selectedJournalIds.includes(node.id);

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
                style={{
                  cursor: (onJournalClick || (allowSwapping && onJournalSelect)) ? 'pointer' : 'default',
                }}
              />

              {/* Journal number/code */}
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
                style={{ cursor: (onJournalClick || (allowSwapping && onJournalSelect)) ? 'pointer' : 'default' }}
              >
                {journalMap[node.id]?.code || node.id}
              </motion.text>

              {/* Journal name (only in non-compact mode) */}
              {!compact && (
                <motion.text
                  x={node.position.x}
                  y={node.position.y + 40}
                  className={styles.journalLabel}
                  textAnchor="middle"
                  variants={nodeVariants}
                  initial="hidden"
                  animate="visible"
                  custom={index}
                >
                  {node.name.length > 12 ? `${node.name.substring(0, 12)}...` : node.name}
                </motion.text>
              )}
            </g>
          );
        })}

        {/* Swap Button */}
        {swapButtonVisible && (
          <motion.g
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Swap button background */}
            <motion.circle
              cx={swapButtonPosition.x}
              cy={swapButtonPosition.y}
              r={compact ? 15 : 20}
              className={styles.swapButton}
              onClick={handleSwapClick}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            />
            {/* Swap icon */}
            <motion.path
              d={`M ${swapButtonPosition.x - 8} ${swapButtonPosition.y - 4} L ${swapButtonPosition.x + 8} ${swapButtonPosition.y - 4} M ${swapButtonPosition.x - 8} ${swapButtonPosition.y + 4} L ${swapButtonPosition.x + 8} ${swapButtonPosition.y + 4} M ${swapButtonPosition.x + 4} ${swapButtonPosition.y - 8} L ${swapButtonPosition.x + 8} ${swapButtonPosition.y - 4} L ${swapButtonPosition.x + 4} ${swapButtonPosition.y} M ${swapButtonPosition.x - 4} ${swapButtonPosition.y} L ${swapButtonPosition.x - 8} ${swapButtonPosition.y + 4} L ${swapButtonPosition.x - 4} ${swapButtonPosition.y + 8}`}
              className={styles.swapIcon}
              strokeWidth="2"
              fill="none"
            />
          </motion.g>
        )}

      </svg>

      {/* Legend for non-compact mode */}
      {!compact && (
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendNode} ${styles.terminalNode}`}></div>
            <span>Terminal Journal</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendNode} ${styles.nonTerminalNode}`}></div>
            <span>Non-Terminal Journal</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendArrow}>→</div>
            <span>Transaction Flow</span>
          </div>
        </div>
      )}

      {/* Journal list for compact mode */}
      {compact && (
        <div className={styles.journalList}>
          <h4 className={styles.listTitle}>Journals in Loop:</h4>
          {nodes.map((node, index) => {
            const isSelected = node.id && selectedJournalIds.includes(node.id);

            return (
              <div
                key={node.id}
                className={`${styles.journalListItem} ${isSelected ? styles.selectedListItem : ''}`}
              >
                <span className={styles.journalSequence}>{index + 1}.</span>
                <span
                  className={styles.journalName}
                  onClick={() => handleNodeClick(node.id)}
                  style={{ cursor: (onJournalClick || (allowSwapping && onJournalSelect)) ? 'pointer' : 'default' }}
                  title={node.name}
                >
                  {node.name}
                </span>
                {node.isTerminal && (
                  <span className={styles.terminalBadge}>T</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LoopVisualization;