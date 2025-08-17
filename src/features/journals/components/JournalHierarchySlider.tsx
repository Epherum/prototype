import React, { useMemo } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

import styles from "./JournalHierarchySlider.module.css";
import { findParentOfNode } from "@/lib/helpers";
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

const pastelColors = [
  "#BFFCC6",
  "#FFFFBA",
  "#B5EAD7",
  "#E6E6FA",
  "#FFB3BA",
  "#BAE1FF",
  "#FFDAC1",
  "#D5AAFF",
  "#C2F0FC",
  "#FFD6FC",
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
  selectedLevel2Ids: string[];
  selectedLevel3Ids: string[];
  visibleChildrenMap: Record<string, boolean>;
  effectiveJournalIds: string[];
  onL1ItemInteract: (id: string) => void;
  onL2ItemInteract: (id: string) => void;
  isLoading?: boolean;
  isError?: boolean; // ✅ 2. Add isError and error props
  error?: Error | null;
  activeFilters: ActivePartnerFilters;
  onToggleFilter: (status: PartnerGoodFilterStatus) => void;
  isLocked?: boolean;
}

const JournalHierarchySlider: React.FC<JournalHierarchySliderProps> = ({
  hierarchyData,
  fullHierarchyData,
  selectedLevel2Ids,
  selectedLevel3Ids,
  visibleChildrenMap,
  effectiveJournalIds,
  onL1ItemInteract,
  onL2ItemInteract,
  isLoading,
  isError, // ✅ 3. Destructure new props
  isLocked,
  activeFilters,
  onToggleFilter,
}) => {
  const level2NodesForScroller = useMemo(
    () => hierarchyData.filter((node): node is AccountNodeData => !!node?.id),
    [hierarchyData]
  );

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    level2NodesForScroller.forEach((node, index) => {
      map.set(node.id, pastelColors[index % pastelColors.length]);
    });
    return map;
  }, [level2NodesForScroller]);

  const level3Nodes = useMemo(() => {
    return level2NodesForScroller.flatMap(
      (l1Node) =>
        (visibleChildrenMap[l1Node.id] &&
          l1Node.children?.filter(
            (child): child is AccountNodeData => !!child?.id
          )) ||
        []
    );
  }, [level2NodesForScroller, visibleChildrenMap]);

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
            {/* --- Filter controls remain unchanged --- */}
            <div className={styles.headerFilterRow}>
              <motion.div className={styles.rootFilterControls}>
                {["affected", "unaffected", "inProcess"].map((filter) => (
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
                        styles.filterDotInProcess
                      }`}
                    />
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </motion.button>
                ))}
              </motion.div>
            </div>

            {/* --- L1 / Row 1 now same as L2 --- */}
            <h3 className={styles.level2ScrollerTitle}>1st Row</h3>
            <motion.div
              className={styles.level2ScrollerContainer}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <div className={`${styles.wrappingItemContainer} ${styles.level2WrappingContainer}`}>
                {level2NodesForScroller.map((l1Node) => (
                  <motion.button
                    key={l1Node.id}
                    variants={itemVariants}
                    onClick={() => onL1ItemInteract(l1Node.id)}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`${styles.level2Button} ${
                      selectedLevel2Ids.includes(l1Node.id)
                        ? styles.level2ButtonActive
                        : ""
                    } ${
                      selectedLevel2Ids.includes(l1Node.id) &&
                      colorMap.get(l1Node.id)
                        ? styles.colored
                        : ""
                    } ${
                      !l1Node.children || l1Node.children.length === 0
                        ? styles.terminalNode
                        : ""
                    }`}
                    style={
                      {
                        "--item-color": colorMap.get(l1Node.id),
                      } as React.CSSProperties
                    }
                    title={`${l1Node.code} - ${capitalizeFirstLetter(l1Node.name)}. Click to cycle, Dbl-click to drill.`}
                    disabled={isLocked}
                    whileHover={{
                      scale: 1.08,
                      zIndex: 1,
                      transition: { duration: 0.2, ease: "easeOut" },
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {l1Node.code || "N/A"}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* --- L2 / Row 2 header and filter info --- */}
            <h3 className={styles.level2ScrollerTitle}>2nd Row</h3>
            <div className={styles.filterInfoRow}>
              {activeFilters.length > 0 && renderFilterInfo()}
            </div>

            {/* --- THE REFACTORED L2 / ROW 2 DISPLAY --- */}
            <AnimatePresence mode="popLayout">
              {level3Nodes.length > 0 ? (
                <motion.div
                  key="l3-grid-present"
                  className={`${styles.wrappingItemContainer} ${styles.level3WrappingContainer}`}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  {/* The change is in this map function */}
                  {level3Nodes.map((l2Node) => {
                    const parent = findParentOfNode(
                      l2Node.id,
                      fullHierarchyData
                    );
                    const color = parent ? colorMap.get(parent.id) : undefined;
                    return (
                      // ✅ FIX: The key and variants are moved directly to the button.
                      // The redundant <motion.div> wrapper is REMOVED.
                      <motion.button
                        key={l2Node.id}
                        variants={itemVariants}
                        onClick={() => onL2ItemInteract(l2Node.id)}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`${styles.level2Button} ${
                          selectedLevel3Ids.includes(l2Node.id)
                            ? styles.level2ButtonActive
                            : ""
                        } ${color ? styles.colored : ""} ${
                          !l2Node.children || l2Node.children.length === 0
                            ? styles.terminalNode
                            : ""
                        }`}
                        style={{ "--item-color": color } as React.CSSProperties}
                        title={`${l2Node.code} - ${capitalizeFirstLetter(l2Node.name)}`}
                        disabled={isLocked}
                        whileHover={{
                          scale: 1.08,
                          zIndex: 1,
                          transition: { duration: 0.2, ease: "easeOut" },
                        }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {l2Node.code || "N/A"}
                      </motion.button>
                    );
                  })}
                </motion.div>
              ) : (
                <motion.div
                  key="l3-placeholder"
                  className={styles.noDataSmall}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    transition: { delay: 0.2, duration: 0.3 },
                  }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
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
