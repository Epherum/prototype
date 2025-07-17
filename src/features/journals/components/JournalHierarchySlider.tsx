// src/features/journals/components/JournalHierarchySlider.tsx
import React, { useMemo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import styles from "./JournalHierarchySlider.module.css";
import { findNodeById, findParentOfNode } from "@/lib/helpers";
import type {
  AccountNodeData,
  ActivePartnerFilters,
  PartnerGoodFilterStatus,
} from "@/lib/types";

// A designer-curated palette with better distinction and harmony.
const pastelColors = [
  "#FFB3BA", // Soft Coral Pink (Warm)
  "#BAE1FF", // Baby Blue (Cool)
  "#BFFCC6", // Mint Green (Cool)
  "#FFFFBA", // Pastel Yellow (Warm/Neutral)
  "#FFDAC1", // Peachy Pink (Warm)
  "#D5AAFF", // Lavender Violet (Cool)
  "#C2F0FC", // Icy Sky Blue (Cool)
  "#FFD6FC", // Cotton Candy Pink (Warm/Cool)
  "#B5EAD7", // Light Teal (Cool)
  "#E6E6FA", // Lavender Mist (Neutral)
];

interface JournalHierarchySliderProps {
  sliderId: string;
  hierarchyData: AccountNodeData[];
  fullHierarchyData: AccountNodeData[];
  selectedLevel2Ids: string[];
  selectedLevel3Ids: string[];
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

  // ✅ FIX: The color map now depends on the STABLE display list (`level2NodesForScroller`),
  // not the dynamic selection list (`selectedLevel2Ids`). This ensures colors never change.
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    level2NodesForScroller.forEach((node, index) => {
      map.set(node.id, pastelColors[index % pastelColors.length]);
    });
    return map;
  }, [level2NodesForScroller]);

  const level3NodesForScroller = useMemo(() => {
    // For efficient lookup, create a Set of the selected IDs.
    const selectedL2IdSet = new Set(selectedLevel2Ids);

    // Iterate over the STABLE `level2NodesForScroller` array, not the unstable selection array.
    // This ensures the groups of children appear in the same order as their parents in the 1st row.
    return level2NodesForScroller.flatMap((l1Node) => {
      // If the parent node in the stable list is currently selected...
      if (selectedL2IdSet.has(l1Node.id)) {
        // ...then return its children to be included in the final list.
        return (
          l1Node.children?.filter(
            (child): child is AccountNodeData => !!child?.id
          ) || []
        );
      }
      // Otherwise, return an empty array, which flatMap will ignore.
      return [];
    });
  }, [level2NodesForScroller, selectedLevel2Ids]);

  if (isLoading)
    return <div className={styles.noData}>Loading Journals...</div>;

  return (
    <>
      <div className={styles.headerFilterRow}>
        <div className={styles.rootFilterControls}>
          <button
            className={
              activeFilters.includes("affected") ? styles.activeFilter : ""
            }
            onClick={() => onToggleFilter("affected")}
            disabled={isLocked}
          >
            Affected
          </button>
          <button
            className={
              activeFilters.includes("unaffected") ? styles.activeFilter : ""
            }
            onClick={() => onToggleFilter("unaffected")}
            disabled={isLocked}
          >
            Unaffected
          </button>
          <button
            className={
              activeFilters.includes("inProcess") ? styles.activeFilter : ""
            }
            onClick={() => onToggleFilter("inProcess")}
            disabled={isLocked}
          >
            In Process
          </button>
        </div>
      </div>

      <h3 className={styles.level2ScrollerTitle}>1st Row</h3>
      <div className={styles.level2ScrollerContainer}>
        <Swiper
          modules={[Navigation]}
          navigation={level2NodesForScroller.length > 5}
          slidesPerView="auto"
          spaceBetween={8}
          className={styles.levelScrollerSwiper}
          slidesPerGroupAuto
        >
          {level2NodesForScroller.map((l1Node) => {
            const isActive = selectedLevel2Ids.includes(l1Node.id);
            // The color is now stable, retrieved from the pre-built map.
            const color = colorMap.get(l1Node.id);
            return (
              <SwiperSlide
                key={l1Node.id}
                className={styles.level2ScrollerSlideNoOverflow}
              >
                <button
                  onClick={() => onL1ItemInteract(l1Node.id)}
                  onContextMenu={(e) => e.preventDefault()}
                  // The color is only APPLIED when active, but it's always the SAME color for this item.
                  className={`${styles.level2Button} ${
                    isActive ? styles.level2ButtonActive : ""
                  } ${isActive && color ? styles.colored : ""}`}
                  style={{ "--item-color": color } as React.CSSProperties}
                  title={`${l1Node.code} - ${l1Node.name}. Click to cycle, Dbl-click to drill.`}
                  disabled={isLocked}
                >
                  {l1Node.code || "N/A"}
                </button>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>

      <h3 className={styles.level2ScrollerTitle}>2nd Row</h3>
      <div className={styles.level2ScrollerContainer}>
        {level3NodesForScroller.length > 0 ? (
          <Swiper
            modules={[Navigation]}
            navigation={level3NodesForScroller.length > 5}
            slidesPerView="auto"
            spaceBetween={8}
            className={styles.levelScrollerSwiper}
          >
            {level3NodesForScroller.map((l2Node) => {
              const isActive = selectedLevel3Ids.includes(l2Node.id);
              const parent = findParentOfNode(l2Node.id, fullHierarchyData);
              // The parent's color is retrieved from the same stable map.
              const color = parent ? colorMap.get(parent.id) : undefined;
              return (
                <SwiperSlide
                  key={l2Node.id}
                  className={styles.level2ScrollerSlideNoOverflow}
                >
                  <button
                    onClick={() => onL2ItemInteract(l2Node.id)}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`${styles.level2Button} ${
                      isActive ? styles.level2ButtonActive : ""
                    } ${color ? styles.colored : ""}`} // Child buttons always show the parent color tint
                    style={{ "--item-color": color } as React.CSSProperties}
                    title={`${l2Node.code} - ${l2Node.name}`}
                    disabled={isLocked}
                  >
                    {l2Node.code || "N/A"}
                  </button>
                </SwiperSlide>
              );
            })}
          </Swiper>
        ) : (
          <div className={styles.noDataSmall}>
            Select from 1st Row to see children.
          </div>
        )}
      </div>
    </>
  );
};

export default JournalHierarchySlider;
