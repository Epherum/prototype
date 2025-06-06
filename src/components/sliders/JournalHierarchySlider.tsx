// src/components/sliders/JournalHierarchySlider.tsx
import React, { useRef, useMemo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import styles from "./JournalHierarchySlider.module.css";
import { findNodeById, findParentOfNode } from "@/lib/helpers";
import type { AccountNodeData } from "@/lib/types";

const DOUBLE_CLICK_DELAY = 200;

interface JournalHierarchySliderProps {
  sliderId: string;
  hierarchyData: AccountNodeData[]; // This will be the sub-tree if restricted
  selectedTopLevelId: string | null; // This will be restrictedJournalId if at restricted "root"
  selectedLevel2Ids: string[];
  selectedLevel3Ids: string[];
  onSelectTopLevel: (id: string, childToSelect?: string | null) => void;
  onToggleLevel2Id: (id: string) => void;
  onToggleLevel3Id: (id: string) => void;
  onL2DoubleClick?: (
    itemId: string,
    isSelected: boolean,
    fullHierarchy: AccountNodeData[] // This is also the sub-tree if restricted
  ) => void;
  onL3DoubleClick?: (
    itemId: string,
    isSelected: boolean,
    fullHierarchy: AccountNodeData[] // This is also the sub-tree if restricted
  ) => void;
  rootJournalIdConst: string; // The ID of the *actual* root of the entire chart of accounts
  restrictedJournalId?: string | null; // <<<< NEW PROP: The ID of the journal this user is restricted to
  onNavigateContextDown?: (args: {
    currentL1ToBecomeL2: string;
    longPressedL2ToBecomeL3?: string;
  }) => void;
  isLoading?: boolean;
  isError?: boolean;
  onOpenModal?: () => void;
  isRootView?: boolean; // This might need re-evaluation: true if selectedTopLevelId is rootJournalIdConst OR restrictedJournalId
  currentFilterStatus?: "affected" | "unaffected" | "all" | null;
  onFilterStatusChange?: (
    status: "affected" | "unaffected" | "all" | null
  ) => void;
  isL1NavMenuOpen?: boolean;
  fullHierarchyData: AccountNodeData[]; // This is effectively same as hierarchyData if restricted
}

const JournalHierarchySlider: React.FC<JournalHierarchySliderProps> = ({
  sliderId,
  hierarchyData, // Will be the restricted sub-tree
  selectedTopLevelId, // Will be the restrictedJournalId if at the "top" of restricted view
  selectedLevel2Ids,
  selectedLevel3Ids,
  onSelectTopLevel,
  onToggleLevel2Id,
  onToggleLevel3Id,
  onL2DoubleClick,
  onL3DoubleClick,
  rootJournalIdConst, // True root
  restrictedJournalId, // User's restricted root
  onNavigateContextDown,
  isLoading,
  isError,
  onOpenModal,
  isRootView, // Might mean (selectedTopLevelId === rootJournalIdConst || selectedTopLevelId === restrictedJournalId)
  currentFilterStatus,
  onFilterStatusChange,
  isL1NavMenuOpen,
  fullHierarchyData, // Will be the restricted sub-tree
}) => {
  const l3ScrollerSwiperInstanceRef = useRef<any>(null);
  const level2ScrollerSwiperInstanceRef = useRef<any>(null);
  const l2ClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const l2ClickCountRef = useRef<number>(0);
  const l3ClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const l3ClickCountRef = useRef<number>(0);

  // ... (handleL2ItemClick, handleL3ItemClick remain the same, they operate on selections)
  const handleL2ItemClick = (l2ItemId: string) => {
    l2ClickCountRef.current += 1;
    if (l2ClickCountRef.current === 1) {
      l2ClickTimeoutRef.current = setTimeout(() => {
        onToggleLevel2Id(l2ItemId);
        l2ClickCountRef.current = 0;
      }, DOUBLE_CLICK_DELAY);
    } else if (l2ClickCountRef.current === 2) {
      if (l2ClickTimeoutRef.current) {
        clearTimeout(l2ClickTimeoutRef.current);
      }
      if (onL2DoubleClick) {
        const isSelected = selectedLevel2Ids.includes(l2ItemId);
        // fullHierarchyData here is the (potentially restricted) data passed from useJournalManager
        onL2DoubleClick(l2ItemId, isSelected, fullHierarchyData);
      }
      l2ClickCountRef.current = 0;
    }
  };

  const handleL3ItemClick = (l3ItemId: string) => {
    l3ClickCountRef.current += 1;
    if (l3ClickCountRef.current === 1) {
      l3ClickTimeoutRef.current = setTimeout(() => {
        onToggleLevel3Id(l3ItemId);
        l3ClickCountRef.current = 0;
      }, DOUBLE_CLICK_DELAY);
    } else if (l3ClickCountRef.current === 2) {
      if (l3ClickTimeoutRef.current) {
        clearTimeout(l3ClickTimeoutRef.current);
      }
      if (onL3DoubleClick) {
        const isSelected = selectedLevel3Ids.includes(l3ItemId);
        onL3DoubleClick(l3ItemId, isSelected, fullHierarchyData);
      }
      l3ClickCountRef.current = 0;
    }
  };

  // currentL1ContextNode: If selectedTopLevelId is the restrictedJournalId,
  // findNodeById(hierarchyData, restrictedJournalId) will correctly get it,
  // as hierarchyData is the sub-tree starting with restrictedJournalId.
  const currentL1ContextNode = useMemo(() => {
    if (!selectedTopLevelId) return null; // Should not happen if initialized properly
    // If selectedTopLevelId is the *actual* root and we are in an unrestricted view
    if (
      selectedTopLevelId === rootJournalIdConst &&
      (!restrictedJournalId || restrictedJournalId === rootJournalIdConst)
    ) {
      return {
        id: rootJournalIdConst,
        name: "Chart of Accounts Root", // Or your preferred name for the true root
        code: "ROOT",
        children: hierarchyData, // For true root, children are the top-level items from hierarchyData
        isTerminal: false, // True root is not terminal
      } as AccountNodeData;
    }
    // Otherwise, find the node in the current hierarchy (which could be restricted)
    return findNodeById(hierarchyData, selectedTopLevelId);
  }, [
    selectedTopLevelId,
    hierarchyData,
    rootJournalIdConst,
    restrictedJournalId,
  ]);

  // level2NodesForScroller:
  // If selectedTopLevelId is restrictedJournalId, currentL1ContextNode.children will list its children. Correct.
  // If selectedTopLevelId is rootJournalIdConst (unrestricted), currentL1ContextNode.children (derived from the special root object above) is hierarchyData. Correct.
  const level2NodesForScroller = useMemo(() => {
    if (!currentL1ContextNode) return [];
    // If selectedTopLevelId is the true root (and no restriction or restriction is root), its children are the L1s.
    if (
      selectedTopLevelId === rootJournalIdConst &&
      (!restrictedJournalId || restrictedJournalId === rootJournalIdConst)
    ) {
      return (hierarchyData || []).filter(
        // hierarchyData itself contains the L1s
        (node): node is AccountNodeData =>
          node && typeof node.id === "string" && node.id !== ""
      );
    }
    // Otherwise, for any other L1 (including a restrictedJournalId as L1), get its children.
    return (currentL1ContextNode.children || []).filter(
      (node): node is AccountNodeData =>
        node && typeof node.id === "string" && node.id !== ""
    );
  }, [
    selectedTopLevelId,
    hierarchyData,
    currentL1ContextNode,
    rootJournalIdConst,
    restrictedJournalId,
  ]);

  // level3NodesForScroller: This logic relies on level2NodesForScroller being correct.
  // It iterates through selectedLevel2Ids, finds them in level2NodesForScroller's source (implicitly currentL1ContextNode.children or hierarchyData for true root),
  // and aggregates their children. This should remain correct.
  const level3NodesForScroller = useMemo(() => {
    if (
      !selectedLevel2Ids ||
      selectedLevel2Ids.length === 0 ||
      !currentL1ContextNode
    )
      return [];

    const sourceForL2s = level2NodesForScroller; // Use the already computed L2 nodes as the source for finding L2 by ID

    const l3nodes: AccountNodeData[] = [];
    selectedLevel2Ids.forEach((l2Id) => {
      const l2Node = findNodeById(sourceForL2s, l2Id);
      if (l2Node && l2Node.children) {
        l3nodes.push(
          ...l2Node.children.filter(
            (child): child is AccountNodeData =>
              child && typeof child.id === "string" && child.id !== ""
          )
        );
      }
    });
    return Array.from(new Set(l3nodes.map((n) => n.id))).map(
      (id) => l3nodes.find((n) => n.id === id)!
    );
  }, [selectedLevel2Ids, level2NodesForScroller, currentL1ContextNode]); // currentL1ContextNode ensures re-calc when L1 changes

  // ... (l2ScrollerKey, l3ScrollerKey remain the same) ...
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

  const handleL1ContextDoubleClick = () => {
    console.log(
      `[JournalSlider] L1 Context Double Click: Current L1 is ${selectedTopLevelId}, Restricted Root is ${restrictedJournalId}`
    );

    // If the current L1 is the restricted journal ID (and it's not the true root), prevent going "up".
    if (
      selectedTopLevelId &&
      restrictedJournalId &&
      selectedTopLevelId === restrictedJournalId &&
      restrictedJournalId !== rootJournalIdConst
    ) {
      console.warn(
        `[JournalSlider] L1 Context is the restricted root (${restrictedJournalId}). 'Go Up' action is disabled.`
      );
      return;
    }

    // If current L1 is the true root, also cannot go "up".
    if (selectedTopLevelId === rootJournalIdConst || !selectedTopLevelId) {
      console.warn(
        "[JournalSlider] L1 Context is already the true Root. 'Go Up' action is N/A."
      );
      return;
    }

    // Attempt to find parent in the current hierarchy (which is the sub-tree if restricted)
    // `hierarchyData` is the data for the current view (the sub-tree if restricted).
    // `findParentOfNode` will search within this `hierarchyData`.
    // If `selectedTopLevelId` is the root of `hierarchyData` (e.g., the restrictedJournalId),
    // then `parentOfCurrentL1` will be null.
    const parentOfCurrentL1 = findParentOfNode(
      selectedTopLevelId,
      hierarchyData
    );

    // If a parent is found within hierarchyData, navigate to it.
    // If no parent is found (parentOfCurrentL1 is null), it means selectedTopLevelId is a root of hierarchyData.
    // In an unrestricted view, this means we go to rootJournalIdConst.
    // In a restricted view, if parentOfCurrentL1 is null, we should already be at restrictedJournalId (handled by the first check).
    const newL1TargetId = parentOfCurrentL1
      ? parentOfCurrentL1.id
      : rootJournalIdConst; // Fallback to true root if no parent in current hierarchy (applies to unrestricted L1s)

    console.log(
      `[JournalSlider] Action: Go Up - New L1 context will be ${newL1TargetId}. Previous L1 (${selectedTopLevelId}) to be selected in L2.`
    );
    if (onSelectTopLevel) {
      onSelectTopLevel(newL1TargetId, selectedTopLevelId);
    }
  };

  const handleL1InfoClick = () => {
    // Single click on L1 header
    console.log(
      "[JournalSlider] L1 Info Clicked. Current L1:",
      selectedTopLevelId
    );
    // Potentially open an options menu for the L1 node, or do nothing.
    // If you want it to behave like double-click to go up (respecting restrictions):
    // handleL1ContextDoubleClick();
  };

  // ... (getNodeCodesFromIds, isLoading, isError rendering remains same) ...
  const getNodeCodesFromIds = (
    ids: string[],
    nodeList: AccountNodeData[] | undefined
  ): string => {
    if (!ids || ids.length === 0 || !nodeList || nodeList.length === 0) {
      return "None";
    }
    return ids
      .map((id) => findNodeById(nodeList, id)?.code || id)
      .filter(Boolean)
      .join(", ");
  };

  if (isLoading)
    return <div className={styles.noData}>Loading Journals...</div>;
  if (isError)
    return <div className={styles.noData}>Error loading journals.</div>;

  // Determine if the true root is being displayed as L1 context
  const isDisplayingTrueRootContext =
    selectedTopLevelId === rootJournalIdConst &&
    (!restrictedJournalId || restrictedJournalId === rootJournalIdConst);

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
                (selectedTopLevelId !== rootJournalIdConst &&
                  selectedTopLevelId !== restrictedJournalId) || // Can go up if not at either root
                (selectedTopLevelId === restrictedJournalId &&
                  restrictedJournalId !== rootJournalIdConst &&
                  findParentOfNode(selectedTopLevelId, hierarchyData)) // Can go up from restricted if it has parent in *its own hierarchy view*
                  ? "pointer"
                  : "default",
            }}
            onClick={handleL1InfoClick}
            onDoubleClick={handleL1ContextDoubleClick}
          >
            {currentL1ContextNode?.code ||
              (isDisplayingTrueRootContext ? "ROOT" : "N/A")}{" "}
            -{" "}
            {currentL1ContextNode?.name ||
              (isDisplayingTrueRootContext ? "Overview" : "Selected Account")}
          </span>
        </div>

        {/* Root filter controls (isRootView might need adjustment based on restrictedJournalId) */}
        {/* isRootView prop should be true if selectedTopLevelId === rootJournalIdConst AND user is NOT restricted,
            OR if selectedTopLevelId === restrictedJournalId.
            The `onFilterStatusChange` usually applies to the *absolute* root of data.
            This part might need more context on how 'isRootView' and filters interact with restrictions.
            For now, assume `isRootView` is passed correctly from page.tsx.
        */}
        {isRootView && onFilterStatusChange && (
          <div className={styles.rootFilterControls}>
            {/* ... filter buttons ... */}
          </div>
        )}
      </div>

      {/* L2 Scroller Title */}
      <h3 className={styles.level2ScrollerTitle}>
        {isDisplayingTrueRootContext
          ? `L1 Accounts (Selected: ${getNodeCodesFromIds(
              selectedLevel2Ids,
              level2NodesForScroller
            )})`
          : `L2 under ${currentL1ContextNode?.code || "Context"}${
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

      {/* L2 Scroller Content */}
      {/* ... (L2 Swiper logic remains the same, uses level2NodesForScroller) ... */}
      {level2NodesForScroller.length > 0 ? (
        <div className={styles.level2ScrollerContainer}>
          <Swiper /* ... */>
            {level2NodesForScroller.map((l2ContextNode) => (
              <SwiperSlide
                key={l2ContextNode.id}
                className={styles.level2ScrollerSlideNoOverflow}
              >
                <div
                  className={`${styles.l2ButtonInteractiveWrapper} noSelect touchManipulation`}
                >
                  <button
                    onClick={() => handleL2ItemClick(l2ContextNode.id)}
                    // onDoubleClick removed here as click handler manages single/double
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
          {isDisplayingTrueRootContext
            ? "No top-level accounts found."
            : `No Level 2 accounts under '${
                currentL1ContextNode?.name || "selected context"
              }'.`}
        </div>
      )}

      {/* L3 Scroller Title & Content */}
      {/* ... (L3 logic remains the same, uses level3NodesForScroller) ... */}
      <h3 className={styles.level2ScrollerTitle}>
        {selectedLevel2Ids.length === 0
          ? "Select L2 Account(s) to see L3"
          : `L3 under ${getNodeCodesFromIds(
              selectedLevel2Ids,
              level2NodesForScroller
            )}${
              // Pass L2 nodes for code lookup
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
          <Swiper /* ... */>
            {level3NodesForScroller.map((l3Node) => (
              <SwiperSlide
                key={l3Node.id}
                className={styles.level2ScrollerSlideNoOverflow}
              >
                <div
                  className={`${styles.l2ButtonInteractiveWrapper} noSelect touchManipulation`}
                >
                  <button
                    onClick={() => handleL3ItemClick(l3Node.id)}
                    // onDoubleClick removed here
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
