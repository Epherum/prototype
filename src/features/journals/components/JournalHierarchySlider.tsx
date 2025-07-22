//src/features/journals/components/JournalHierarchySlider.tsx
import React, { useMemo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { motion, AnimatePresence, Variants } from "framer-motion";

import "swiper/css";
import "swiper/css/navigation";
import styles from "./JournalHierarchySlider.module.css";
import { findParentOfNode } from "@/lib/helpers";
import type {
  AccountNodeData,
  ActivePartnerFilters,
  PartnerGoodFilterStatus,
} from "@/lib/types";

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

// A premium, gentle easing curve for all primary animations.
const gentleEase = { duration: 0.4, ease: [0.22, 1, 0.36, 1] };

// Variants for a container that staggers its children's animations.
const containerVariants: Variants = {
  hidden: {
    opacity: 0,
    transition: {
      when: "afterChildren",
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.05,
    },
  },
};

// Variants for individual items within a staggered container.
const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0, transition: gentleEase },
  visible: { y: 0, opacity: 1, transition: gentleEase },
  // A slightly faster exit animation for individual items if needed.
  exit: { opacity: 0, y: -20, transition: { duration: 0.2, ease: "easeIn" } },
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
  activeFilters,
  onToggleFilter,
  isLocked,
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

  // This calculation now correctly determines if ANY L3 nodes are visible.
  const level3NodesForScroller = useMemo(() => {
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
            .map((filter) => `${filter}[${effectiveJournalIds.join(",")}]`)
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

  if (isLoading)
    return <div className={styles.noData}>Loading Journals...</div>;

  return (
    <>
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
              onClick={() => onToggleFilter(filter as PartnerGoodFilterStatus)}
              disabled={isLocked}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </motion.button>
          ))}
        </motion.div>
      </div>

      <h3 className={styles.level2ScrollerTitle}>1st Row</h3>
      <motion.div
        className={styles.level2ScrollerContainer}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Swiper
          modules={[Navigation]}
          navigation={level2NodesForScroller.length > 5}
          slidesPerView="auto"
          spaceBetween={8}
          className={styles.levelScrollerSwiper}
          slidesPerGroupAuto
        >
          {level2NodesForScroller.map((l1Node) => (
            <SwiperSlide
              key={l1Node.id}
              className={styles.level2ScrollerSlideNoOverflow}
            >
              <motion.div variants={itemVariants}>
                <motion.button
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
                  title={`${l1Node.code} - ${l1Node.name}. Click to cycle, Dbl-click to drill.`}
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
              </motion.div>
            </SwiperSlide>
          ))}
        </Swiper>
      </motion.div>

      <h3 className={styles.level2ScrollerTitle}>2nd Row</h3>
      <div className={styles.filterInfoRow}>
        {activeFilters.length > 0 && renderFilterInfo()}
      </div>

      <AnimatePresence mode="popLayout">
        {level3NodesForScroller.length > 0 ? (
          <motion.div
            key="l3-scroller-present" // Stable key for the "data is present" state
            className={styles.level2ScrollerContainer}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden" // On exit, it animates to the "hidden" variant, staggering children out.
          >
            <Swiper
              modules={[Navigation]}
              navigation={level3NodesForScroller.length > 5}
              slidesPerView="auto"
              spaceBetween={8}
              className={styles.levelScrollerSwiper}
            >
              {level3NodesForScroller.map((l2Node) => {
                const parent = findParentOfNode(l2Node.id, fullHierarchyData);
                const color = parent ? colorMap.get(parent.id) : undefined;
                return (
                  <SwiperSlide
                    key={l2Node.id}
                    className={styles.level2ScrollerSlideNoOverflow}
                  >
                    <motion.div variants={itemVariants}>
                      <motion.button
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
                        title={`${l2Node.code} - ${l2Node.name}`}
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
                    </motion.div>
                  </SwiperSlide>
                );
              })}
            </Swiper>
          </motion.div>
        ) : (
          // This placeholder has its own simple animation and a stable key.
          <motion.div
            key="l3-placeholder"
            className={styles.noDataSmall}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.2, duration: 0.3 } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default JournalHierarchySlider;
