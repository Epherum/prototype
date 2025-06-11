// src/components/sliders/JournalHierarchySlider.tsx
import React, { useRef, useMemo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import styles from "./JournalHierarchySlider.module.css";
import { findNodeById, findParentOfNode } from "@/lib/helpers";
import type { AccountNodeData, PartnerFilterStatus } from "@/lib/types"; // Import new type

const DOUBLE_CLICK_DELAY = 200;

interface JournalHierarchySliderProps {
  sliderId: string;
  hierarchyData: AccountNodeData[];
  fullHierarchyData: AccountNodeData[];
  selectedTopLevelId: string | null;
  selectedLevel2Ids: string[];
  selectedLevel3Ids: string[];
  onSelectTopLevel: (
    newTopLevelId: string,
    childToSelectInL2?: string | null
  ) => void;
  onToggleLevel2Id: (id: string) => void;
  onToggleLevel3Id: (id: string) => void;
  rootJournalIdConst: string;
  restrictedJournalId?: string | null;
  isLoading?: boolean;
  isError?: boolean;
  isRootView?: boolean;
  // --- UPDATED PROPS ---
  currentFilterStatus?: PartnerFilterStatus; // Use the shared type
  onFilterStatusChange?: (status: PartnerFilterStatus) => void; // Use the shared type
}

const JournalHierarchySlider: React.FC<JournalHierarchySliderProps> = ({
  sliderId,
  hierarchyData,
  fullHierarchyData,
  selectedTopLevelId,
  selectedLevel2Ids,
  selectedLevel3Ids,
  onSelectTopLevel,
  onToggleLevel2Id,
  onToggleLevel3Id,
  rootJournalIdConst,
  restrictedJournalId,
  isLoading,
  isError,
  isRootView,
  currentFilterStatus,
  onFilterStatusChange,
}) => {
  const l2ClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const l2ClickCountRef = useRef<number>(0);
  const l3ClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const l3ClickCountRef = useRef<number>(0);

  console.log("[JHS] Props Received:", {
    selectedTopLevelId,
    selectedLevel2Ids,
    restrictedJournalId,
    rootJournalIdConst,
  });
  console.log("[JHS] hierarchyData length:", hierarchyData?.length);
  console.log("[JHS] fullHierarchyData length:", fullHierarchyData?.length);

  const currentL1ContextNode = useMemo(() => {
    if (!selectedTopLevelId) {
      console.log("[JHS] currentL1ContextNode: selectedTopLevelId is null");
      return null;
    }
    if (
      selectedTopLevelId === rootJournalIdConst &&
      (!restrictedJournalId || restrictedJournalId === rootJournalIdConst)
    ) {
      const rootNode = {
        id: rootJournalIdConst,
        name: "",
        code: "Root",
        children: hierarchyData,
        isTerminal: false,
      } as AccountNodeData;
      console.log(
        "[JHS] currentL1ContextNode: Constructed True Root",
        rootNode
      );
      return rootNode;
    }
    const node = findNodeById(fullHierarchyData, selectedTopLevelId);
    console.log(
      `[JHS] currentL1ContextNode: Found node for ${selectedTopLevelId} in fullHierarchyData:`,
      node
    );
    return node;
  }, [
    selectedTopLevelId,
    hierarchyData,
    fullHierarchyData,
    rootJournalIdConst,
    restrictedJournalId,
  ]);

  const level2NodesForScroller = useMemo(() => {
    if (!currentL1ContextNode) {
      console.log("[JHS] level2NodesForScroller: currentL1ContextNode is null");
      return [];
    }
    const children = (currentL1ContextNode.children || []).filter(
      (node): node is AccountNodeData =>
        node && typeof node.id === "string" && node.id !== ""
    );
    console.log(
      "[JHS] level2NodesForScroller for L1",
      currentL1ContextNode.id,
      ":",
      children.length,
      "nodes"
    );
    return children;
  }, [currentL1ContextNode]);

  const level3NodesForScroller = useMemo(() => {
    if (
      !selectedLevel2Ids ||
      selectedLevel2Ids.length === 0 ||
      !level2NodesForScroller ||
      level2NodesForScroller.length === 0
    ) {
      return [];
    }
    const l3nodes: AccountNodeData[] = [];
    selectedLevel2Ids.forEach((l2Id) => {
      const l2Node = findNodeById(level2NodesForScroller, l2Id);
      if (l2Node && l2Node.children) {
        l3nodes.push(
          ...l2Node.children.filter(
            (child): child is AccountNodeData =>
              child && typeof child.id === "string" && child.id !== ""
          )
        );
      }
    });
    const uniqueL3Nodes = Array.from(new Set(l3nodes.map((n) => n.id))).map(
      (id) => l3nodes.find((n) => n.id === id)!
    );
    console.log(
      "[JHS] level3NodesForScroller for L2s",
      selectedLevel2Ids,
      ":",
      uniqueL3Nodes.length,
      "nodes"
    );
    return uniqueL3Nodes;
  }, [selectedLevel2Ids, level2NodesForScroller]);

  const navigateUp = (childToSelectInNewL2?: string | null) => {
    console.log(
      `[JHS] navigateUp called. Current L1: ${selectedTopLevelId}, ChildToSelect: ${childToSelectInNewL2}`
    );
    if (!selectedTopLevelId) {
      console.error(
        "[JHS] navigateUp: selectedTopLevelId is null, cannot navigate."
      );
      return;
    }

    if (
      selectedTopLevelId === restrictedJournalId &&
      restrictedJournalId !== rootJournalIdConst
    ) {
      console.warn(
        `[JHS] navigateUp: Cannot navigate above restricted root: ${restrictedJournalId}`
      );
      return;
    }
    if (selectedTopLevelId === rootJournalIdConst) {
      console.warn(
        "[JHS] navigateUp: Already at the true root. Cannot navigate up."
      );
      return;
    }

    const parentOfCurrentL1 = findParentOfNode(
      selectedTopLevelId,
      fullHierarchyData
    );
    console.log(
      `[JHS] navigateUp: Parent of ${selectedTopLevelId} in fullHierarchyData:`,
      parentOfCurrentL1
    );

    let newL1TargetId: string;
    let actualChildToSelect = childToSelectInNewL2 || selectedTopLevelId; // Default to selecting current L1 in new L2 view

    if (parentOfCurrentL1) {
      newL1TargetId = parentOfCurrentL1.id;
    } else {
      // No parent found in fullHierarchyData means selectedTopLevelId is a root in this scope. Go to conceptual root.
      newL1TargetId = rootJournalIdConst;
    }

    console.log(
      `[JHS] navigateUp: Calling onSelectTopLevel('${newL1TargetId}', '${actualChildToSelect}')`
    );
    onSelectTopLevel(newL1TargetId, actualChildToSelect);
  };

  const navigateDown = (newTopLevelId: string) => {
    console.log(`[JHS] navigateDown called. New L1 target: ${newTopLevelId}`);
    const targetNode = findNodeById(fullHierarchyData, newTopLevelId);
    if (
      !targetNode ||
      !targetNode.children ||
      targetNode.children.length === 0
    ) {
      console.warn(
        `[JHS] navigateDown: Target node ${newTopLevelId} has no children or not found. Cannot navigate down.`
      );
      // Optionally, toggle selection or do nothing
      // onToggleLevel2Id(newTopLevelId); // Or onToggleLevel3Id if it was an L3
      return;
    }
    console.log(
      `[JHS] navigateDown: Calling onSelectTopLevel('${newTopLevelId}', null)`
    );
    onSelectTopLevel(newTopLevelId, null);
  };

  const handleL2ItemClick = (l2ItemId: string) => {
    l2ClickCountRef.current += 1;
    if (l2ClickTimeoutRef.current) clearTimeout(l2ClickTimeoutRef.current);

    if (l2ClickCountRef.current === 1) {
      l2ClickTimeoutRef.current = setTimeout(() => {
        console.log(`[JHS] L2 Single Click: ${l2ItemId}`);
        onToggleLevel2Id(l2ItemId);
        l2ClickCountRef.current = 0;
      }, DOUBLE_CLICK_DELAY);
    } else if (l2ClickCountRef.current === 2) {
      console.log(`[JHS] L2 Double Click: ${l2ItemId}`);
      const isSelected = selectedLevel2Ids.includes(l2ItemId);
      const l2Node = findNodeById(level2NodesForScroller, l2ItemId);

      if (!l2Node) {
        console.error("[JHS] L2 node not found for double click:", l2ItemId);
        l2ClickCountRef.current = 0;
        return;
      }

      if (isSelected) {
        // If L2 item IS selected
        console.log(
          `[JHS] L2 Double Click (Selected): ${l2ItemId}. Attempting to navigate down.`
        );
        navigateDown(l2ItemId); // Attempt to go "Down"
      } else {
        // If L2 item IS NOT selected
        console.log(
          `[JHS] L2 Double Click (Not Selected): ${l2ItemId}. Attempting to navigate up.`
        );
        navigateUp(selectedTopLevelId); // Go "Up" relative to current L1
      }
      l2ClickCountRef.current = 0;
    }
  };

  const handleL3ItemClick = (l3ItemId: string) => {
    l3ClickCountRef.current += 1;
    if (l3ClickTimeoutRef.current) clearTimeout(l3ClickTimeoutRef.current);

    if (l3ClickCountRef.current === 1) {
      l3ClickTimeoutRef.current = setTimeout(() => {
        console.log(`[JHS] L3 Single Click: ${l3ItemId}`);
        onToggleLevel3Id(l3ItemId);
        l3ClickCountRef.current = 0;
      }, DOUBLE_CLICK_DELAY);
    } else if (l3ClickCountRef.current === 2) {
      console.log(`[JHS] L3 Double Click: ${l3ItemId}`);
      const isSelected = selectedLevel3Ids.includes(l3ItemId);
      const l3Node = findNodeById(level3NodesForScroller, l3ItemId);

      if (!l3Node) {
        console.error("[JHS] L3 node not found for double click:", l3ItemId);
        l3ClickCountRef.current = 0;
        return;
      }

      if (isSelected) {
        // If L3 item IS selected
        console.log(
          `[JHS] L3 Double Click (Selected): ${l3ItemId}. Attempting to navigate down.`
        );
        navigateDown(l3ItemId); // Attempt to go "Down"
      } else {
        // If L3 item IS NOT selected
        console.log(
          `[JHS] L3 Double Click (Not Selected): ${l3ItemId}. Attempting to navigate up.`
        );
        navigateUp(selectedTopLevelId); // Go "Up" relative to current L1 (L3's grandparent)
      }
      l3ClickCountRef.current = 0;
    }
  };

  const getNodeCodesFromIds = (
    ids: string[],
    nodeList: AccountNodeData[] | undefined
  ): string => {
    if (!ids || ids.length === 0 || !nodeList || nodeList.length === 0)
      return "None";
    return ids
      .map((id) => findNodeById(nodeList, id)?.code || id)
      .filter(Boolean)
      .join(", ");
  };

  if (isLoading)
    return <div className={styles.noData}>Loading Journals...</div>;
  if (isError)
    return <div className={styles.noData}>Error loading journals.</div>;

  const isEffectivelyAtTrueRoot =
    selectedTopLevelId === rootJournalIdConst &&
    (!restrictedJournalId || restrictedJournalId === rootJournalIdConst);

  return (
    <>
      {/* --- ROW 2: Filter Buttons --- */}
      {isRootView && onFilterStatusChange && (
        <div className={styles.headerFilterRow}>
          <div className={styles.rootFilterControls}>
            <button
              className={
                currentFilterStatus === "affected" ? styles.activeFilter : ""
              }
              onClick={() => onFilterStatusChange("affected")}
            >
              Affected
            </button>
            <button
              className={
                currentFilterStatus === "unaffected" ? styles.activeFilter : ""
              }
              onClick={() => onFilterStatusChange("unaffected")}
            >
              Unaffected
            </button>
            <button
              className={
                currentFilterStatus === "inProcess" ? styles.activeFilter : ""
              }
              onClick={() => onFilterStatusChange("inProcess")}
              title="Partners created by you, pending approval, and not yet linked"
            >
              In Process
            </button>
          </div>
        </div>
      )}

      <h3 className={styles.level2ScrollerTitle}>
        {isEffectivelyAtTrueRoot
          ? `L1 Accounts (Selected: ${getNodeCodesFromIds(
              selectedLevel2Ids,
              level2NodesForScroller
            )})`
          : `L2 under ${currentL1ContextNode?.code || "Context"}${
              selectedLevel2Ids.length > 0
                ? ` (Selected: ${getNodeCodesFromIds(
                    selectedLevel2Ids,
                    level2NodesForScroller
                  )})`
                : ""
            }`}
      </h3>
      {level2NodesForScroller.length > 0 ? (
        <div className={styles.level2ScrollerContainer}>
          <Swiper
            modules={[Navigation]}
            navigation={level2NodesForScroller.length > 5}
            slidesPerView="auto"
            spaceBetween={8}
            className={styles.levelScrollerSwiper}
            slidesPerGroupAuto={true}
            key={`l2-swiper-${selectedTopLevelId}-${level2NodesForScroller.length}`}
          >
            {level2NodesForScroller.map((l2Node) => (
              <SwiperSlide
                key={l2Node.id}
                className={styles.level2ScrollerSlideNoOverflow}
                style={{ width: "auto" }}
              >
                <div
                  className={`${styles.l2ButtonInteractiveWrapper} noSelect touchManipulation`}
                >
                  <button
                    onClick={() => handleL2ItemClick(l2Node.id)}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`${styles.level2Button} ${
                      selectedLevel2Ids.includes(l2Node.id)
                        ? styles.level2ButtonActive
                        : ""
                    }`}
                    title={`${l2Node.code} - ${
                      l2Node.name || "Unnamed"
                    }. Double-click behavior depends on selection.`}
                  >
                    {l2Node.code || "N/A"}
                  </button>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      ) : (
        <div className={styles.noDataSmall}>
          {isEffectivelyAtTrueRoot
            ? "No top-level accounts."
            : `No L2 accounts under '${
                currentL1ContextNode?.name || "context"
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
                ? ` (Selected: ${getNodeCodesFromIds(
                    selectedLevel3Ids,
                    level3NodesForScroller
                  )})`
                : ""
            }`}
      </h3>
      {level3NodesForScroller.length > 0 ? (
        <div className={styles.level2ScrollerContainer}>
          <Swiper
            modules={[Navigation]}
            navigation={level3NodesForScroller.length > 5}
            slidesPerView="auto"
            spaceBetween={8}
            className={styles.levelScrollerSwiper}
            slidesPerGroupAuto={true}
            key={`l3-swiper-${selectedLevel2Ids.join("_")}-${
              level3NodesForScroller.length
            }`}
          >
            {level3NodesForScroller.map((l3Node) => (
              <SwiperSlide
                key={l3Node.id}
                className={styles.level2ScrollerSlideNoOverflow}
                style={{ width: "auto" }}
              >
                <div
                  className={`${styles.l2ButtonInteractiveWrapper} noSelect touchManipulation`}
                >
                  <button
                    onClick={() => handleL3ItemClick(l3Node.id)}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`${styles.level2Button} ${
                      selectedLevel3Ids.includes(l3Node.id)
                        ? styles.level2ButtonActive
                        : ""
                    }`}
                    title={`${l3Node.code} - ${
                      l3Node.name || "Unnamed"
                    }. Double-click behavior depends on selection.`}
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
            ? "No L3 accounts for selected L2s."
            : "Select L2 account(s) to see children."}
        </div>
      )}
    </>
  );
};

export default JournalHierarchySlider;
