import { useRef, useMemo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import styles from "./JournalHierarchySlider.module.css";
import { findNodeById, findParentOfNode } from "@/lib/helpers";

function JournalHierarchySlider({
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
  isLoading,
  isError,
  onOpenModal,
}) {
  const l3ScrollerSwiperInstanceRef = useRef(null);
  const level2ScrollerSwiperInstanceRef = useRef(null);

  const l2ClickTimeoutRef = useRef(null);
  const l2LastClickItemIdRef = useRef(null);

  const l3ClickTimeoutRef = useRef(null);
  const l3LastClickItemIdRef = useRef(null);

  const handleL2ItemInteraction = (itemId) => {
    if (l2LastClickItemIdRef.current === itemId) {
      clearTimeout(l2ClickTimeoutRef.current);
      l2LastClickItemIdRef.current = null;
      console.log(
        `%cL2 BUTTON (${itemId}): Manual Double-Click Detected!`,
        "color: purple; font-weight: bold;"
      );
      handleL2ItemDoubleClick(itemId);
    } else {
      l2LastClickItemIdRef.current = itemId;
      clearTimeout(l2ClickTimeoutRef.current);
      l2ClickTimeoutRef.current = setTimeout(() => {
        console.log(
          `%cL2 BUTTON (${itemId}): Manual Single Click Detected (Toggle).`,
          "color: orange;"
        );
        onToggleLevel2Id(itemId);
        l2LastClickItemIdRef.current = null;
      }, 250);
    }
  };

  const currentL1ContextNode = useMemo(() => {
    if (selectedTopLevelId === rootJournalIdConst || !selectedTopLevelId) {
      return {
        id: rootJournalIdConst,
        name: "All Top-Level Accounts",
        code: "Root",
      };
    }
    return findNodeById(hierarchyData, selectedTopLevelId);
  }, [selectedTopLevelId, hierarchyData, rootJournalIdConst]);

  const level2NodesForScroller = useMemo(() => {
    if (selectedTopLevelId === rootJournalIdConst) {
      return (hierarchyData || []).filter(
        (node) => node && typeof node.id === "string" && node.id !== ""
      );
    }
    const parentNode = findNodeById(hierarchyData, selectedTopLevelId);
    return (parentNode?.children || []).filter(
      (node) => node && typeof node.id === "string" && node.id !== ""
    );
  }, [selectedTopLevelId, hierarchyData, rootJournalIdConst]);

  const level3NodesForScroller = useMemo(() => {
    if (!selectedLevel2Ids || selectedLevel2Ids.length === 0) return [];
    const sourceForSelectedL2s =
      selectedTopLevelId === rootJournalIdConst
        ? hierarchyData
        : currentL1ContextNode?.children;
    if (!sourceForSelectedL2s) return [];

    const validSelectedL2ContextNodes = sourceForSelectedL2s.filter(
      (node) =>
        selectedLevel2Ids.includes(node.id) &&
        node &&
        typeof node.id === "string" &&
        node.id !== ""
    );
    return validSelectedL2ContextNodes.flatMap((node) =>
      (node.children || []).filter(
        (child) => child && typeof child.id === "string" && child.id !== ""
      )
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

  const handleL2ItemDoubleClick = (l2ItemId) => {
    const isItemSelected = selectedLevel2Ids.includes(l2ItemId);
    console.log(
      `L2 Item Double Click: ${l2ItemId}, Is Selected: ${isItemSelected}`
    );

    if (isItemSelected) {
      console.log(`  Action: Go Up - ${l2ItemId} becomes new L1 context.`);
      if (onSelectTopLevel) {
        onSelectTopLevel(l2ItemId);
      }
    } else {
      console.log(
        `  Action: Go Down - Context shifts, aiming for ${l2ItemId} as L3.`
      );
      if (selectedTopLevelId === rootJournalIdConst) {
        console.warn(
          "Cannot 'Go Down' from an L2 item when L1 context is Root and item is not selected. Fallback: 'Go Up' to make it L1."
        );
        if (onSelectTopLevel) onSelectTopLevel(l2ItemId);
      } else {
        if (onNavigateContextDown) {
          onNavigateContextDown({
            currentL1ToBecomeL2: selectedTopLevelId,
            longPressedL2ToBecomeL3: l2ItemId,
          });
        }
      }
    }
  };

  const handleL1ContextDoubleClick = () => {
    console.log(`L1 Context Double Click: Current L1 is ${selectedTopLevelId}`);
    if (selectedTopLevelId === rootJournalIdConst) {
      console.warn("L1 Context is Root, 'Go Down' (to parent) action is N/A.");
      return;
    }
    let newL1ParentContextId;
    const parentNode = findParentOfNode(selectedTopLevelId, hierarchyData);
    newL1ParentContextId = parentNode ? parentNode.id : rootJournalIdConst;

    console.log(
      `  Action: Go Down - New L1 context will be ${newL1ParentContextId}, previous L1 ${selectedTopLevelId} should be selected in L2.`
    );
    if (onSelectTopLevel) {
      onSelectTopLevel(newL1ParentContextId, null);
    }
  };

  const handleL3ItemInteraction = (itemId) => {
    if (l3LastClickItemIdRef.current === itemId) {
      clearTimeout(l3ClickTimeoutRef.current);
      l3LastClickItemIdRef.current = null;
      console.log(
        `%cL3 BUTTON (${itemId}): Manual Double-Click Detected!`,
        "color: green; font-weight: bold;"
      );
      handleL3ItemDoubleClick(itemId);
    } else {
      l3LastClickItemIdRef.current = itemId;
      clearTimeout(l3ClickTimeoutRef.current);
      l3ClickTimeoutRef.current = setTimeout(() => {
        console.log(
          `%cL3 BUTTON (${itemId}): Manual Single Click Detected (Toggle).`,
          "color: blue;"
        );
        onToggleLevel3Id(itemId);
        l3LastClickItemIdRef.current = null;
      }, 250);
    }
  };

  const handleL3ItemDoubleClick = (l3ItemId) => {
    const isItemSelected = selectedLevel3Ids.includes(l3ItemId);
    console.log(
      `L3 Item Double Click: ${l3ItemId}, Is Selected: ${isItemSelected}`
    );
    if (onL3DoubleClick) {
      onL3DoubleClick(l3ItemId, isItemSelected);
    }
  };

  const getNodeCodesFromIds = (ids, nodeList) => {
    if (!ids || ids.length === 0 || !nodeList || nodeList.length === 0) {
      return "None";
    }
    return ids
      .map((id) => findNodeById(nodeList, id)?.code || id)
      .filter(Boolean)
      .join(", ");
  };

  return (
    <>
      <div // Changed from nDo to div
        className={`${styles.journalParentHeader} noSelect touchManipulation`}
        onDoubleClick={() => {
          console.log("L1 Context DIV onDoubleClick FIRED!");
          handleL1ContextDoubleClick();
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          cursor:
            selectedTopLevelId !== rootJournalIdConst ? "pointer" : "default",
        }}
      >
        <span className={styles.journalParentInfo}>
          {currentL1ContextNode?.code || "N/A"} -{" "}
          {currentL1ContextNode?.name || "Overview"}
          {selectedTopLevelId !== rootJournalIdConst && " "}
        </span>
      </div>

      <h3 className={styles.level2ScrollerTitle}>
        {selectedTopLevelId === rootJournalIdConst
          ? `Selected Top-Level: ${getNodeCodesFromIds(
              selectedLevel2Ids,
              level2NodesForScroller
            )}`
          : `Selected L2: ${getNodeCodesFromIds(
              selectedLevel2Ids,
              level2NodesForScroller
            )}`}
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
            {level2NodesForScroller.map((l2ContextNode) => {
              if (
                !l2ContextNode ||
                typeof l2ContextNode.id !== "string" ||
                l2ContextNode.id === ""
              ) {
                console.warn(
                  "Skipping L2 scroller button for invalid node:",
                  l2ContextNode
                );
                return null;
              }
              return (
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
                      } `}
                    >
                      {l2ContextNode.code || "N/A"}
                    </button>
                  </div>
                </SwiperSlide>
              );
            })}
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
          ? "Select L2 Account(s) Above"
          : `Selected L3: ${getNodeCodesFromIds(
              selectedLevel3Ids,
              level3NodesForScroller
            )}`}
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
            className={`${styles.level2ScrollerSwiper} ${styles.level3ScrollerSwiperOverride}`}
            observer={true}
            observeParents={true}
          >
            {level3NodesForScroller.map((l3Node) => {
              if (
                !l3Node ||
                typeof l3Node.id !== "string" ||
                l3Node.id === ""
              ) {
                console.warn(
                  "Skipping L3 scroller button for invalid node:",
                  l3Node
                );
                return null;
              }
              return (
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
              );
            })}
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
}

export default JournalHierarchySlider;
