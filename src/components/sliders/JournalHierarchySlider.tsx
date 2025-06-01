// src/components/sliders/JournalHierarchySlider.tsx
import React, { useRef, useMemo } from "react"; // Removed useState, useEffect unless you re-add L1 menu
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import styles from "./JournalHierarchySlider.module.css";
import { findNodeById, findParentOfNode } from "@/lib/helpers"; // Assuming AccountNodeData is also in helpers or types
import type { AccountNodeData } from "@/lib/types"; // Import AccountNodeData

// Make sure the props match what page.tsx provides
interface JournalHierarchySliderProps {
  sliderId: string; // Added, as it's used in keys
  hierarchyData: AccountNodeData[];
  selectedTopLevelId: string | null;
  selectedLevel2Ids: string[];
  selectedLevel3Ids: string[];
  onSelectTopLevel: (id: string, childToSelect?: string | null) => void;
  onToggleLevel2Id: (id: string) => void;
  onToggleLevel3Id: (id: string) => void;
  onL3DoubleClick?: (id: string, isSelected: boolean) => void;
  rootJournalIdConst: string;
  onNavigateContextDown?: (args: {
    currentL1ToBecomeL2: string;
    longPressedL2ToBecomeL3?: string;
  }) => void;
  isLoading?: boolean; // Added back
  isError?: boolean; // Added back
  onOpenModal?: () => void; // Added back
  isRootView?: boolean;
  currentFilterStatus?: "affected" | "unaffected" | "all" | null;
  onFilterStatusChange?: (
    status: "affected" | "unaffected" | "all" | null
  ) => void;
  isL1NavMenuOpen?: boolean; // Kept as per your snippet, though not used in this simplified version
}

const JournalHierarchySlider: React.FC<JournalHierarchySliderProps> = ({
  sliderId,
  hierarchyData,
  selectedTopLevelId,
  selectedLevel2Ids,
  selectedLevel3Ids,
  onSelectTopLevel,
  onToggleLevel2Id,
  onToggleLevel3Id,
  onL3DoubleClick,
  rootJournalIdConst,
  onNavigateContextDown,
  isLoading, // Added back
  isError, // Added back
  onOpenModal, // Added back
  isRootView,
  currentFilterStatus,
  onFilterStatusChange,
  isL1NavMenuOpen, // Prop received
}) => {
  const l3ScrollerSwiperInstanceRef = useRef<any>(null);
  const level2ScrollerSwiperInstanceRef = useRef<any>(null);

  const l2ClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const l2LastClickItemIdRef = useRef<string | null>(null);

  const l3ClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const l3LastClickItemIdRef = useRef<string | null>(null);

  const handleL2ItemInteraction = (itemId: string) => {
    if (l2LastClickItemIdRef.current === itemId && l2ClickTimeoutRef.current) {
      clearTimeout(l2ClickTimeoutRef.current);
      l2LastClickItemIdRef.current = null;
      l2ClickTimeoutRef.current = null;
      console.log(
        `%cL2 BUTTON (${itemId}): Manual Double-Click Detected!`,
        "color: purple; font-weight: bold;"
      );
      handleL2ItemDoubleClick(itemId);
    } else {
      l2LastClickItemIdRef.current = itemId;
      if (l2ClickTimeoutRef.current) clearTimeout(l2ClickTimeoutRef.current);
      l2ClickTimeoutRef.current = setTimeout(() => {
        console.log(
          `%cL2 BUTTON (${itemId}): Manual Single Click Detected (Toggle).`,
          "color: orange;"
        );
        onToggleLevel2Id(itemId);
        l2LastClickItemIdRef.current = null;
        l2ClickTimeoutRef.current = null;
      }, 250);
    }
  };

  const currentL1ContextNode = useMemo(() => {
    if (selectedTopLevelId === rootJournalIdConst || !selectedTopLevelId) {
      // Return a consistent structure even for root
      return {
        id: rootJournalIdConst,
        name: "", // Or "Overview" as you had
        code: "Root", // Or "N/A"
        children: hierarchyData, // For root, children are the top-level items
      } as AccountNodeData; // Cast to ensure type consistency
    }
    return findNodeById(hierarchyData, selectedTopLevelId);
  }, [selectedTopLevelId, hierarchyData, rootJournalIdConst]);

  const level2NodesForScroller = useMemo(() => {
    if (selectedTopLevelId === rootJournalIdConst) {
      return (hierarchyData || []).filter(
        (
          node
        ): node is AccountNodeData => // Type guard
          node &&
          typeof node.id === "string" &&
          node.id !== "" &&
          (node.parentId === null ||
            node.parentId === undefined ||
            node.parentId === rootJournalIdConst) // Ensure they are actual top-level
      );
    }
    // If not root, currentL1ContextNode should be defined (or handled if findNodeById can return undefined)
    return (currentL1ContextNode?.children || []).filter(
      (
        node
      ): node is AccountNodeData => // Type guard
        node && typeof node.id === "string" && node.id !== ""
    );
  }, [
    selectedTopLevelId,
    hierarchyData,
    currentL1ContextNode,
    rootJournalIdConst,
  ]);

  const level3NodesForScroller = useMemo(() => {
    if (!selectedLevel2Ids || selectedLevel2Ids.length === 0) return [];

    // Determine the source of L2 nodes correctly
    const sourceForL2s =
      selectedTopLevelId === rootJournalIdConst
        ? hierarchyData // If L1 is root, selectedL2Ids are direct children of root
        : currentL1ContextNode?.children; // Otherwise, selectedL2Ids are children of currentL1ContextNode

    if (!sourceForL2s) return [];

    const l3nodes: AccountNodeData[] = [];
    selectedLevel2Ids.forEach((l2Id) => {
      const l2Node = findNodeById(sourceForL2s, l2Id); // Search in the correct source
      if (l2Node && l2Node.children) {
        l3nodes.push(
          ...l2Node.children.filter(
            (child): child is AccountNodeData =>
              child && typeof child.id === "string" && child.id !== ""
          )
        );
      }
    });
    // Remove duplicates if any (though in a strict hierarchy, children of different L2s shouldn't be the same L3)
    return Array.from(new Set(l3nodes.map((n) => n.id))).map(
      (id) => l3nodes.find((n) => n.id === id)!
    );
  }, [
    selectedTopLevelId,
    selectedLevel2Ids,
    hierarchyData,
    currentL1ContextNode,
    rootJournalIdConst,
  ]);

  const l2ScrollerKey = useMemo(() => {
    return `${sliderId}-L2scroller-L1-${selectedTopLevelId}-dataLen${level2NodesForScroller.length}`;
  }, [sliderId, selectedTopLevelId, level2NodesForScroller.length]);

  const l3ScrollerKey = useMemo(() => {
    return `${sliderId}-L3scroller-L1-${selectedTopLevelId}-L2sel-${selectedLevel2Ids.join(
      "_"
    )}-dataLen${level3NodesForScroller.length}`;
  }, [
    sliderId,
    selectedTopLevelId,
    selectedLevel2Ids,
    level3NodesForScroller.length,
  ]);

  const handleL2ItemDoubleClick = (l2ItemId: string) => {
    const isItemSelected = selectedLevel2Ids.includes(l2ItemId);
    console.log(
      `L2 Item Double Click: ${l2ItemId}, Is Selected: ${isItemSelected}`
    );

    if (isItemSelected) {
      console.log(`  Action: Go Up - ${l2ItemId} becomes new L1 context.`);
      if (onSelectTopLevel) {
        onSelectTopLevel(l2ItemId); // L2 becomes the new L1
      }
    } else {
      // If not selected, a double click could mean "select this L2 and navigate into it"
      // This implies L2 becomes new L1, and L2 selections are cleared.
      console.log(
        `  Action: Select and Go Up - ${l2ItemId} becomes new L1 context.`
      );
      if (onSelectTopLevel) {
        onSelectTopLevel(l2ItemId); // L2 becomes new L1
      }
      // The onNavigateContextDown for L2 was more for long-press in original design
      // Double click on L2 usually promotes it to L1 context if it has children
    }
  };

  const handleL1ContextDoubleClick = () => {
    console.log(`L1 Context Double Click: Current L1 is ${selectedTopLevelId}`);
    if (selectedTopLevelId === rootJournalIdConst || !selectedTopLevelId) {
      console.warn("L1 Context is Root, 'Go Up' (to parent) action is N/A.");
      return;
    }
    // Find parent of the currentL1ContextNode to navigate "up"
    const parentOfCurrentL1 = findParentOfNode(
      selectedTopLevelId,
      hierarchyData
    );
    const newL1TargetId = parentOfCurrentL1
      ? parentOfCurrentL1.id
      : rootJournalIdConst;

    console.log(
      `  Action: Go Up - New L1 context will be ${newL1TargetId}. The previous L1 (${selectedTopLevelId}) might become a selected L2 if applicable.`
    );
    if (onSelectTopLevel) {
      // When going up, the second argument to onSelectTopLevel can be the ID
      // of the child (which was the previous L1) that should be auto-selected in the L2 scroller.
      onSelectTopLevel(newL1TargetId, selectedTopLevelId);
    }
  };

  // **** THIS IS THE MISSING FUNCTION DEFINITION ****
  const handleL1InfoClick = () => {
    // This function is called on a single click of the L1 info span.
    // You can define what a single click does here.
    // For example, it could toggle an L1 options menu if you had one,
    // or perhaps do nothing if double-click is the only L1 interaction.
    console.log("L1 Info Clicked. Current L1:", selectedTopLevelId);
    // If you want L1 single click to behave like L1 double click (go up):
    // if (selectedTopLevelId !== rootJournalIdConst) {
    //   handleL1ContextDoubleClick();
    // }
    // Or toggle an L1 options menu:
    // setIsL1NavMenuOpen(prev => !prev); // This would require isL1NavMenuOpen state
  };

  const handleL3ItemInteraction = (itemId: string) => {
    if (l3LastClickItemIdRef.current === itemId && l3ClickTimeoutRef.current) {
      clearTimeout(l3ClickTimeoutRef.current);
      l3LastClickItemIdRef.current = null;
      l3ClickTimeoutRef.current = null;
      console.log(
        `%cL3 BUTTON (${itemId}): Manual Double-Click Detected!`,
        "color: green; font-weight: bold;"
      );
      handleL3ItemDoubleClick(itemId);
    } else {
      l3LastClickItemIdRef.current = itemId;
      if (l3ClickTimeoutRef.current) clearTimeout(l3ClickTimeoutRef.current);
      l3ClickTimeoutRef.current = setTimeout(() => {
        console.log(
          `%cL3 BUTTON (${itemId}): Manual Single Click Detected (Toggle).`,
          "color: blue;"
        );
        onToggleLevel3Id(itemId);
        l3LastClickItemIdRef.current = null;
        l3ClickTimeoutRef.current = null;
      }, 250);
    }
  };

  const handleL3ItemDoubleClick = (l3ItemId: string) => {
    const isItemSelected = selectedLevel3Ids.includes(l3ItemId);
    console.log(
      `L3 Item Double Click: ${l3ItemId}, Is Selected: ${isItemSelected}`
    );
    if (onL3DoubleClick) {
      onL3DoubleClick(l3ItemId, isItemSelected); // Propagate to parent for custom actions
    } else {
      // Default L3 double click: maybe toggle selection again or do nothing further
      console.log(
        "Default L3 double click: No specific action, selection was toggled by single click logic if not cleared."
      );
    }
  };

  const getNodeCodesFromIds = (
    ids: string[],
    nodeList: AccountNodeData[] | undefined
  ): string => {
    if (!ids || ids.length === 0 || !nodeList || nodeList.length === 0) {
      return "None";
    }
    return ids
      .map((id) => findNodeById(nodeList, id)?.code || id) // Use findNodeById from helpers
      .filter(Boolean) // Remove any undefined/null if findNodeById returns that for no match
      .join(", ");
  };

  // Loading and Error states (add if you had specific styles for them)
  if (isLoading)
    return <div className={styles.noData}>Loading Journals...</div>;
  if (isError)
    return <div className={styles.noData}>Error loading journals.</div>;

  return (
    <>
      <div
        className={`${styles.journalParentHeader} noSelect touchManipulation ${
          isL1NavMenuOpen ? styles.l1NavActive : ""
        }`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className={styles.journalParentInfoAndL1Options}>
          <span
            className={styles.journalParentInfo}
            style={{
              cursor:
                selectedTopLevelId !== rootJournalIdConst
                  ? "pointer"
                  : "default",
            }}
            onClick={handleL1InfoClick} // Using the now defined function
            onDoubleClick={handleL1ContextDoubleClick}
          >
            {currentL1ContextNode?.code ||
              (selectedTopLevelId === rootJournalIdConst ? "ROOT" : "N/A")}{" "}
            -{" "}
            {currentL1ContextNode?.name ||
              (selectedTopLevelId === rootJournalIdConst ? "" : "Overview")}
          </span>
        </div>

        {isRootView && onFilterStatusChange && (
          <div className={styles.rootFilterControls}>
            <button
              onClick={() => onFilterStatusChange("affected")}
              className={`${styles.filterButton} ${
                currentFilterStatus === "affected" ||
                currentFilterStatus === null
                  ? styles.filterButtonActive
                  : ""
              }`}
            >
              Affected
            </button>
            <button
              onClick={() => onFilterStatusChange("unaffected")}
              className={`${styles.filterButton} ${
                currentFilterStatus === "unaffected"
                  ? styles.filterButtonActive
                  : ""
              }`}
            >
              Unaffected
            </button>
            <button
              onClick={() => onFilterStatusChange("all")}
              className={`${styles.filterButton} ${
                currentFilterStatus === "all" ? styles.filterButtonActive : ""
              }`}
            >
              All
            </button>
            {currentFilterStatus && (
              <button
                className={styles.filterButton}
                onClick={() => onFilterStatusChange(null)}
                title="Clear filter"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>

      <h3 className={styles.level2ScrollerTitle}>
        {selectedTopLevelId === rootJournalIdConst
          ? `L1 Accounts (Selected: ${getNodeCodesFromIds(
              selectedLevel2Ids,
              level2NodesForScroller
            )})`
          : `L2 under ${currentL1ContextNode?.code || ""}${
              selectedLevel2Ids.length > 0
                ? " (Selected: " +
                  getNodeCodesFromIds(
                    selectedLevel2Ids,
                    level2NodesForScroller
                  ) +
                  ")"
                : ""
            }`}
      </h3>

      {level2NodesForScroller.length > 0 ? (
        <div className={styles.level2ScrollerContainer}>
          <Swiper
            key={l2ScrollerKey}
            onSwiper={(swiper) => {
              level2ScrollerSwiperInstanceRef.current = swiper;
            }}
            modules={[Navigation]}
            slidesPerView={"auto"}
            spaceBetween={8}
            navigation={false}
            className={styles.level2ScrollerSwiper}
            observer={true}
            observeParents={true}
          >
            {level2NodesForScroller.map((l2ContextNode) => (
              <SwiperSlide
                key={l2ContextNode.id}
                className={styles.level2ScrollerSlideNoOverflow}
              >
                <div
                  className={`${styles.l2ButtonInteractiveWrapper} noSelect touchManipulation`}
                >
                  <button
                    onClick={() => handleL2ItemInteraction(l2ContextNode.id)}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`${styles.level2Button} ${
                      selectedLevel2Ids.includes(l2ContextNode.id)
                        ? styles.level2ButtonActive
                        : ""
                    }`}
                    title={`${l2ContextNode.code} - ${
                      l2ContextNode.name || "Unnamed"
                    }`}
                  >
                    {l2ContextNode.code || "N/A"}
                  </button>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      ) : (
        <div className={styles.noDataSmall}>
          {selectedTopLevelId === rootJournalIdConst
            ? "No top-level accounts found."
            : `No Level 2 accounts under '${
                currentL1ContextNode?.name || "selected context"
              }'.`}
        </div>
      )}

      <h3 className={styles.level2ScrollerTitle}>
        {selectedLevel2Ids.length === 0
          ? "Select L2 Account(s) to see L3"
          : `L3 under ${getNodeCodesFromIds(
              selectedLevel2Ids,
              level2NodesForScroller
            )}${
              selectedLevel3Ids.length > 0
                ? " (Selected: " +
                  getNodeCodesFromIds(
                    selectedLevel3Ids,
                    level3NodesForScroller
                  ) +
                  ")"
                : ""
            }`}
      </h3>

      {level3NodesForScroller.length > 0 ? (
        <div className={styles.level2ScrollerContainer}>
          <Swiper
            key={l3ScrollerKey}
            onSwiper={(swiper) => {
              l3ScrollerSwiperInstanceRef.current = swiper;
            }}
            modules={[Navigation]}
            slidesPerView={"auto"}
            spaceBetween={8}
            navigation={false}
            className={`${styles.level2ScrollerSwiper} ${
              styles.level3ScrollerSwiperOverride || ""
            }`}
            observer={true}
            observeParents={true}
          >
            {level3NodesForScroller.map((l3Node) => (
              <SwiperSlide
                key={l3Node.id}
                className={styles.level2ScrollerSlideNoOverflow}
              >
                <div
                  className={`${styles.l2ButtonInteractiveWrapper} noSelect touchManipulation`}
                >
                  <button
                    onClick={() => handleL3ItemInteraction(l3Node.id)}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`${styles.level2Button} ${
                      selectedLevel3Ids.includes(l3Node.id)
                        ? styles.level2ButtonActive
                        : ""
                    }`}
                    title={`${l3Node.code} - ${l3Node.name || "Unnamed"}`}
                  >
                    {l3Node.code || "N/A"}
                  </button>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      ) : (
        <div className={styles.noDataSmall}>
          {selectedLevel2Ids.length > 0
            ? "No Level 3 accounts for currently selected Level 2s."
            : "Select Level 2 account(s) above to see children."}
        </div>
      )}
    </>
  );
};

export default JournalHierarchySlider;
