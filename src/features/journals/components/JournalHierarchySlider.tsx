import React, { useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

import styles from "./JournalHierarchySlider.module.css";
import { findParentOfNode } from "@/lib/helpers";
import { useMultiLevelSelection } from "../hooks/useMultiLevelSelection";
import ApprovalCenter from "./ApprovalCenter";
import type {
  AccountNodeData,
  ActivePartnerFilters,
  PartnerGoodFilterStatus,
} from "@/lib/types/ui";

// Helper function to capitalize only the first letter
const capitalizeFirstLetter = (text: string): string => {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// Helper function to get ordinal numbers (1st, 2nd, 3rd, etc.)
const getOrdinalNumber = (num: number): string => {
  const suffixes = ["th", "st", "nd", "rd"];
  const value = num % 100;
  const suffix = suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
  return num + suffix;
};

const pastelColors = [
  "#66D466",  // Green
  "#FFD966",  // Yellow  
  "#66D4B8",  // Mint/Teal
  "#FF9966",  // Orange
  "#FF6B9D",  // Pink/Rose
  "#6BA3FF",  // Blue
  "#FFB366",  // Peach
  "#B366FF",  // Purple
  "#66D4FF",  // Sky Blue
  "#FF66CC",  // Magenta
];

// ✅ 1. Copy the animation variants from DynamicSlider for consistency
const sliderContentVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
  exit: { opacity: 0, y: -15, transition: { duration: 0.25, ease: "easeIn" } },
};

const containerVariants: Variants = {
  hidden: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: {
    y: 20,
    opacity: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

interface JournalHierarchySliderProps {
  sliderId: string;
  hierarchyData: AccountNodeData[];
  fullHierarchyData: AccountNodeData[];
  selectedLevel2Ids: string[]; // Legacy prop - will be derived from multi-level selection
  selectedLevel3Ids: string[]; // Legacy prop - will be derived from multi-level selection
  visibleChildrenMap: Record<string, boolean>; // Legacy prop - will be managed internally
  effectiveJournalIds: string[];
  onL1ItemInteract: (id: string) => void; // Legacy - will be replaced with level-agnostic handler
  onL2ItemInteract: (id: string) => void; // Legacy - will be replaced with level-agnostic handler
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  activeFilters: ActivePartnerFilters;
  onToggleFilter: (status: PartnerGoodFilterStatus) => void;
  isLocked?: boolean;
  // New props for multi-level support
  topLevelId: string;
  // Double-click navigation handler
  onNavigateToLevel?: (nodeId: string) => void;
}

const JournalHierarchySlider: React.FC<JournalHierarchySliderProps> = ({
  hierarchyData,
  fullHierarchyData,
  selectedLevel2Ids, // Legacy - used for backward compatibility
  selectedLevel3Ids, // Legacy - used for backward compatibility
  visibleChildrenMap, // Legacy - ignored in favor of multi-level logic
  effectiveJournalIds,
  onL1ItemInteract, // Legacy - will map to handleLevelSelection(0, id)
  onL2ItemInteract, // Legacy - will map to handleLevelSelection(1, id)
  isLoading,
  isError,
  isLocked,
  activeFilters,
  onToggleFilter,
  topLevelId,
  onNavigateToLevel,
}) => {
  // Use the new multi-level selection hook
  const {
    levelsData,
    combinedVisibilityMap,
    handleLevelSelection,
    hasChildrenAtLevel,
    getNodeColor,
  } = useMultiLevelSelection(hierarchyData, topLevelId);

  // Create color map for top-level nodes (Level 0)
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    levelsData[0]?.nodes.forEach((node, index) => {
      map.set(node.id, pastelColors[index % pastelColors.length]);
    });
    return map;
  }, [levelsData]);

  // Double-click navigation handling
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingClickRef = useRef<{ levelIndex: number; id: string } | null>(null);

  const handleDoubleClick = useCallback((nodeId: string) => {
    if (!onNavigateToLevel) return;
    
    // Cancel any pending single click
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      pendingClickRef.current = null;
    }
    
    // Navigate to the double-clicked node as new root
    onNavigateToLevel(nodeId);
  }, [onNavigateToLevel]);

  const handleSingleClick = useCallback((levelIndex: number, id: string) => {
    // Cancel any existing timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    
    // Store pending click
    pendingClickRef.current = { levelIndex, id };
    
    // Set timeout for single click - delay to detect double-click
    clickTimeoutRef.current = setTimeout(() => {
      const pending = pendingClickRef.current;
      if (pending) {
        handleLevelSelection(pending.levelIndex, pending.id);
      }
      clickTimeoutRef.current = null;
      pendingClickRef.current = null;
    }, 250); // 250ms delay to detect double-click
  }, [handleLevelSelection]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  // Generic level interaction handler that replaces all legacy logic
  const handleLevelInteract = (levelIndex: number, id: string) => {
    // Use the delayed single click logic to prevent selection on double-click
    handleSingleClick(levelIndex, id);
  };

  const renderFilterInfo = () => {
    const text =
      effectiveJournalIds.length === 0
        ? "none"
        : activeFilters
            .map((filter) => `${filter}[${effectiveJournalIds.join(", ")}]`)
            .join(" ");
    const isNone = effectiveJournalIds.length === 0;
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={text}
          className={isNone ? styles.filterInfoNone : undefined}
          initial={{ opacity: 0, y: -10 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.3, ease: "easeOut" },
          }}
          exit={{
            opacity: 0,
            y: 10,
            transition: { duration: 0.15, ease: "easeIn" },
          }}
        >
          {text}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className={styles.hierarchyContentWrapper}>
      <AnimatePresence mode="wait" initial={false}>
        {isLoading ? (
          <motion.div
            key="loading"
            className={styles.stateOverlay}
            variants={sliderContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            Loading Journals...
          </motion.div>
        ) : isError ? (
          <motion.div
            key="error"
            className={`${styles.stateOverlay} ${styles.errorState}`}
            variants={sliderContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            Error loading Journals.
          </motion.div>
        ) : hierarchyData.length === 0 ? (
          <motion.div
            key="no-data"
            className={styles.stateOverlay}
            variants={sliderContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            No journals match the current criteria.
          </motion.div>
        ) : (
          // ✅ 6. Wrap the actual data view in a motion.div with the key "data"
          <motion.div
            key="data"
            variants={sliderContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* --- Filter controls with help button --- */}
            <div className={styles.headerFilterRow}>
              <motion.div className={styles.rootFilterControls}>
                {["affected", "unaffected", "pending"].map((filter) => (
                  <motion.button
                    key={filter}
                    className={
                      activeFilters.includes(filter as PartnerGoodFilterStatus)
                        ? styles.activeFilter
                        : ""
                    }
                    onClick={() =>
                      onToggleFilter(filter as PartnerGoodFilterStatus)
                    }
                    disabled={isLocked}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <span 
                      className={`${styles.filterDot} ${
                        filter === 'affected' ? styles.filterDotAffected :
                        filter === 'unaffected' ? styles.filterDotUnaffected :
                        styles.filterDotPending
                      }`}
                    />
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </motion.button>
                ))}
              </motion.div>
              
            </div>
            
            {/* --- DYNAMIC MULTI-LEVEL DISPLAY (always visible) --- */}
            {levelsData.map((levelData, levelIndex) => {
              // Always show first level, show subsequent levels if they should be visible
              if (!levelData.shouldShowLevel && levelIndex > 0) return null;
              
              const levelTitle = `${getOrdinalNumber(levelIndex + 1)} Row`;
              const isFirstLevel = levelIndex === 0;
              
              return (
                <div key={`level-${levelIndex}`}>
                  <h3 className={styles.level2ScrollerTitle}>{levelTitle}</h3>
                  
                  <AnimatePresence mode="popLayout">
                    {levelData.nodes.length > 0 ? (
                      <motion.div
                        key={`level-${levelIndex}-present`}
                        className={`${styles.wrappingItemContainer} ${
                          isFirstLevel ? styles.level2WrappingContainer : styles.level3WrappingContainer
                        }`}
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                      >
                        {levelData.nodes.map((node) => {
                          const isSelected = levelData.selectedIds.includes(node.id);
                          const colorIndex = isFirstLevel ? 
                            levelsData[0].nodes.findIndex(n => n.id === node.id) :
                            getNodeColor(node.id, levelIndex);
                          const color = colorIndex !== null && colorIndex >= 0 ? 
                            pastelColors[colorIndex % pastelColors.length] : undefined;
                          
                          return (
                            <motion.button
                              key={node.id}
                              variants={itemVariants}
                              onClick={() => handleLevelInteract(levelIndex, node.id)}
                              onDoubleClick={() => handleDoubleClick(node.id)}
                              onContextMenu={(e) => e.preventDefault()}
                              className={`${styles.level2Button} ${
                                isSelected ? styles.level2ButtonActive : ""
                              } ${color && isSelected ? styles.colored : ""} ${
                                !node.children || node.children.length === 0
                                  ? styles.terminalNode
                                  : ""
                              }`}
                              style={{ 
                                "--item-color": color,
                                "--border-color": color || "transparent",
                              } as React.CSSProperties}
                              title={`${node.code} - ${capitalizeFirstLetter(node.name)}`}
                              disabled={isLocked}
                              whileHover={{
                                scale: 1.08,
                                zIndex: 1,
                                transition: { duration: 0.2, ease: "easeOut" },
                              }}
                              whileTap={{ scale: 0.95 }}
                            >
                              {node.code || "N/A"}
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    ) : levelData.shouldShowLevel && levelIndex > 0 ? (
                      <motion.div
                        key={`level-${levelIndex}-empty`}
                        className={styles.noDataSmall}
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: 1,
                          transition: { delay: 0.2, duration: 0.3 },
                        }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                      >
                        No child journals available
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* --- APPROVAL CENTER (shown below journals when pending filter is active) --- */}
            <AnimatePresence>
              {activeFilters.includes('pending') && (
                <ApprovalCenter
                  isOpen={true}
                  selectedJournals={effectiveJournalIds}
                  onClose={() => onToggleFilter('pending')}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default JournalHierarchySlider;
