// src/features/journals/components/JournalHierarchySlider.tsx
import React, { useRef, useMemo } from "react";
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
} from "@/lib/types"; // Import new type

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
  activeFilters: ActivePartnerFilters;
  onToggleFilter: (status: PartnerGoodFilterStatus) => void;
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
  activeFilters,
  onToggleFilter,
}) => {
  const l2ClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const l2ClickCountRef = useRef<number>(0);
  const l3ClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const l3ClickCountRef = useRef<number>(0);

  const currentL1ContextNode = useMemo(() => {
    if (!selectedTopLevelId) return null;
    if (
      selectedTopLevelId === rootJournalIdConst &&
      (!restrictedJournalId || restrictedJournalId === rootJournalIdConst)
    ) {
      return {
        id: rootJournalIdConst,
        name: "Chart of Accounts",
        code: "Root",
        children: hierarchyData,
        isTerminal: false,
      } as AccountNodeData;
    }
    return findNodeById(fullHierarchyData, selectedTopLevelId);
  }, [
    selectedTopLevelId,
    hierarchyData,
    fullHierarchyData,
    rootJournalIdConst,
    restrictedJournalId,
  ]);

  const level2NodesForScroller = useMemo(() => {
    if (!currentL1ContextNode) return [];
    return (currentL1ContextNode.children || []).filter(
      (node): node is AccountNodeData =>
        node && typeof node.id === "string" && node.id !== ""
    );
  }, [currentL1ContextNode]);

  const level3NodesForScroller = useMemo(() => {
    if (selectedLevel2Ids.length === 0 || level2NodesForScroller.length === 0)
      return [];
    const l3nodes = selectedLevel2Ids.flatMap((l2Id) => {
      const l2Node = findNodeById(level2NodesForScroller, l2Id);
      return (
        l2Node?.children?.filter(
          (child): child is AccountNodeData =>
            child && typeof child.id === "string" && child.id !== ""
        ) || []
      );
    });
    return Array.from(new Set(l3nodes.map((n) => n.id))).map(
      (id) => l3nodes.find((n) => n.id === id)!
    );
  }, [selectedLevel2Ids, level2NodesForScroller]);

  const navigateDown = (newTopLevelId: string) => {
    const targetNode = findNodeById(fullHierarchyData, newTopLevelId);
    if (!targetNode) {
      console.error(
        `[JHS] navigateDown: Target node ${newTopLevelId} not found.`
      );
      return;
    }
    onSelectTopLevel(newTopLevelId, null);
  };

  const handleL2ItemClick = (l2ItemId: string) => {
    l2ClickCountRef.current += 1;
    if (l2ClickTimeoutRef.current) clearTimeout(l2ClickTimeoutRef.current);

    if (l2ClickCountRef.current === 1) {
      l2ClickTimeoutRef.current = setTimeout(() => {
        onToggleLevel2Id(l2ItemId);
        l2ClickCountRef.current = 0;
      }, DOUBLE_CLICK_DELAY);
    } else if (l2ClickCountRef.current === 2) {
      navigateDown(l2ItemId);
      l2ClickCountRef.current = 0;
    }
  };

  const handleL3ItemClick = (l3ItemId: string) => {
    l3ClickCountRef.current += 1;
    if (l3ClickTimeoutRef.current) clearTimeout(l3ClickTimeoutRef.current);

    if (l3ClickCountRef.current === 1) {
      l3ClickTimeoutRef.current = setTimeout(() => {
        onToggleLevel3Id(l3ItemId);
        l3ClickCountRef.current = 0;
      }, DOUBLE_CLICK_DELAY);
    } else if (l3ClickCountRef.current === 2) {
      const parentNode = findParentOfNode(l3ItemId, fullHierarchyData);
      if (parentNode) {
        navigateDown(parentNode.id);
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
      {/* FIX: Removed 'isRootView' condition to make filters always visible */}
      {onToggleFilter && (
        <div className={styles.headerFilterRow}>
          <div className={styles.rootFilterControls}>
            <button
              className={
                activeFilters.includes("affected") ? styles.activeFilter : ""
              }
              onClick={() => onToggleFilter("affected")}
            >
              Affected
            </button>
            <button
              className={
                activeFilters.includes("unaffected") ? styles.activeFilter : ""
              }
              onClick={() => onToggleFilter("unaffected")}
            >
              Unaffected
            </button>
            <button
              className={
                activeFilters.includes("inProcess") ? styles.activeFilter : ""
              }
              onClick={() => onToggleFilter("inProcess")}
              title="Items created by you, not yet linked to your home journal"
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
                    }. Double-click to drill down.`}
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
                    }. Double-click to drill up.`}
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
