"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react"; // Added useMemo
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import styles from "./page.module.css";
import initialData1 from "./data.json";
import initialData2 from "./data2.json";

import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

import {
  IoCartOutline,
  IoPricetagOutline,
  IoBuildOutline,
  IoOptionsOutline,
  IoChevronDownOutline,
  IoChevronForwardOutline,
  IoAddCircleOutline,
  IoTrashBinOutline,
} from "react-icons/io5";

// --- Helper: Find Node in Hierarchy ---
const findNodeById = (nodes, nodeId) => {
  if (!nodes || !nodeId) return null;
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const foundInChildren = findNodeById(node.children, nodeId);
      if (foundInChildren) {
        return foundInChildren;
      }
    }
  }
  return null;
};

// page.js (add this helper function near findNodeById)

// page.js (near findNodeById)
const findParentOfNode = (nodeId, hierarchy, parent = null) => {
  if (!hierarchy || !nodeId) return null;
  for (const node of hierarchy) {
    if (node.id === nodeId) {
      return parent; // Found the node, return its *immediate* parent in this search context
    }
    if (node.children && node.children.length > 0) {
      // Pass current 'node' as the parent for the recursive call
      const foundParentInChild = findParentOfNode(nodeId, node.children, node);
      if (foundParentInChild !== null) {
        const found = findParentOfNode(nodeId, node.children, node); // Pass 'node' as the parent for children search
        if (found) return found; // If found in children, propagate it up
      }
    }
  }
  return null; // Node not found in this branch
};

const getFirstId = (arr) =>
  arr && arr.length > 0 && arr[0] ? arr[0].id : null;

// --- Constants ---
const SLIDER_TYPES = {
  JOURNAL: "journal",
  PARTNER: "partner",
  GOODS: "goods",
  PROJECT: "project",
  DOCUMENT: "document",
};
const INITIAL_ORDER = [
  SLIDER_TYPES.JOURNAL,
  SLIDER_TYPES.PARTNER,
  SLIDER_TYPES.GOODS,
  SLIDER_TYPES.PROJECT,
  SLIDER_TYPES.DOCUMENT,
];
const JOURNAL_ICONS = {
  J01: IoCartOutline,
  J02: IoPricetagOutline,
  J03: IoBuildOutline,
};
const ROOT_JOURNAL_ID = "__ROOT__";

function JournalHierarchySlider({
  sliderId,
  hierarchyData,
  selectedTopLevelId,
  selectedLevel2Ids,
  selectedLevel3Ids, // ADD
  onSelectTopLevel,
  onToggleLevel2Id,
  onToggleLevel3Id, // ADD
  onL3DoubleClick, // ADD
  rootJournalIdConst,
  onNavigateContextDown,
}) {
  // const mainSwiperInstanceRef = useRef(null); // Will be for the new L3 scroller
  const l3ScrollerSwiperInstanceRef = useRef(null); // RENAME for clarity
  const level2ScrollerSwiperInstanceRef = useRef(null);

  const l2ClickTimeoutRef = useRef(null);
  const l2LastClickItemIdRef = useRef(null);

  // ADD: Refs for L3 click/double-click detection
  const l3ClickTimeoutRef = useRef(null);
  const l3LastClickItemIdRef = useRef(null);

  // New handler for L2 items that manages single vs. double click
  const handleL2ItemInteraction = (itemId) => {
    if (l2LastClickItemIdRef.current === itemId) {
      // This is the second click on the same item quickly - treat as double click
      clearTimeout(l2ClickTimeoutRef.current);
      l2LastClickItemIdRef.current = null; // Reset for next interaction
      console.log(
        `%cL2 BUTTON (${itemId}): Manual Double-Click Detected!`,
        "color: purple; font-weight: bold;"
      );
      handleL2ItemDoubleClick(itemId); // Call your existing double-click logic
    } else {
      // This is the first click, or a click on a different item
      l2LastClickItemIdRef.current = itemId;
      clearTimeout(l2ClickTimeoutRef.current); // Clear any previous timer

      l2ClickTimeoutRef.current = setTimeout(() => {
        // Timer expired, it was a single click
        console.log(
          `%cL2 BUTTON (${itemId}): Manual Single Click Detected (Toggle).`,
          "color: orange;"
        );
        onToggleLevel2Id(itemId);
        l2LastClickItemIdRef.current = null; // Reset
      }, 250); // Adjust timeout (e.g., 250-300ms)
    }
  };

  // --- EXISTING: useMemo hooks for data, keys, indices (ensure these are up-to-date from previous steps) ---
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

  // RENAME: level3NodesForMainSwiper -> level3NodesForScroller
  const level3NodesForScroller = useMemo(() => {
    // RENAMED
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

  // MODIFIED: l3ScrollerKey
  // It should change if L1, selected L2s, or the actual list of L3 nodes change.
  // It should NOT change merely because selectedLevel3Ids changes.
  const l3ScrollerKey = useMemo(() => {
    return `${sliderId}-L3scroller-L1-${selectedTopLevelId}-L2sel-${selectedLevel2Ids.join(
      "_"
    )}-dataLen${level3NodesForScroller.length}`;
    // REMOVED: -L3sel-${selectedLevel3Ids.join("_")}
  }, [
    sliderId,
    selectedTopLevelId,
    selectedLevel2Ids,
    level3NodesForScroller.length, // Depends on the actual nodes available
    // REMOVED: selectedLevel3Ids from dependencies
  ]);

  // --- NEW: Double Click Handlers ---
  const handleL2ItemDoubleClick = (l2ItemId) => {
    const isItemSelected = selectedLevel2Ids.includes(l2ItemId);
    console.log(
      `L2 Item Double Click: ${l2ItemId}, Is Selected: ${isItemSelected}`
    );

    if (isItemSelected) {
      // If SELECTED, perform "Go Up": make this l2Item the new L1 context
      console.log(`  Action: Go Up - ${l2ItemId} becomes new L1 context.`);
      if (onSelectTopLevel) {
        onSelectTopLevel(l2ItemId); // Home's handleSelectTopLevelJournal clears L2s
      }
    } else {
      // If NOT SELECTED, perform "Go Down": make parent of current L1 the new L1 context,
      // maintaining context to this l2ItemId (which becomes an L3)
      console.log(
        `  Action: Go Down - Context shifts, aiming for ${l2ItemId} as L3.`
      );
      if (selectedTopLevelId === rootJournalIdConst) {
        console.warn(
          "Cannot 'Go Down' from an L2 item when L1 context is Root and item is not selected. This typically means 'Go Up' to make it L1."
        );
        // Fallback: Treat as "Go Up" if at root and not selected (makes it L1)
        // Or, this state (double-clicking unselected L1 from Root view) might need specific UX.
        // For now, to prevent getting stuck, let's make it go up.
        if (onSelectTopLevel) onSelectTopLevel(l2ItemId);
      } else {
        if (onNavigateContextDown) {
          onNavigateContextDown({
            currentL1ToBecomeL2: selectedTopLevelId,
            longPressedL2ToBecomeL3: l2ItemId, // Re-using 'longPressed' for clarity of target
          });
        }
      }
    }
  };

  const handleL1ContextDoubleClick = () => {
    console.log(`L1 Context Double Click: Current L1 is ${selectedTopLevelId}`);
    if (selectedTopLevelId === rootJournalIdConst) {
      console.warn("L1 Context is Root, 'Go Down' (to parent) action is N/A.");
      return; // Cannot go "down" (to parent) from Root
    }

    // Perform "Go Down": Make the parent of the current L1 context the new L1 context.
    // The item that *was* the L1 context should become selected in the L2 scroller.
    let newL1ParentContextId;
    const parentNode = findParentOfNode(selectedTopLevelId, hierarchyData);
    if (parentNode) {
      newL1ParentContextId = parentNode.id;
    } else {
      newL1ParentContextId = rootJournalIdConst; // Parent is Root
    }

    console.log(
      `  Action: Go Down - New L1 context will be ${newL1ParentContextId}, previous L1 ${selectedTopLevelId} should be selected in L2.`
    );
    if (onSelectTopLevel) {
      // Pass the current selectedTopLevelId as the childToSelectInL2 for the new parent context
      onSelectTopLevel(newL1ParentContextId, null); // NEW: do not pre-select
    }
  };

  // ADD: Handler for L3 items (single vs. double click)
  const handleL3ItemInteraction = (itemId) => {
    if (l3LastClickItemIdRef.current === itemId) {
      clearTimeout(l3ClickTimeoutRef.current);
      l3LastClickItemIdRef.current = null;
      console.log(
        `%cL3 BUTTON (${itemId}): Manual Double-Click Detected!`,
        "color: green; font-weight: bold;"
      );
      handleL3ItemDoubleClick(itemId); // Call new L3 double-click logic
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

  // ADD: Handler for L3 item double-click
  const handleL3ItemDoubleClick = (l3ItemId) => {
    const isItemSelected = selectedLevel3Ids.includes(l3ItemId);
    console.log(
      `L3 Item Double Click: ${l3ItemId}, Is Selected: ${isItemSelected}`
    );
    if (onL3DoubleClick) {
      onL3DoubleClick(l3ItemId, isItemSelected); // Delegate to Home
    }
  };

  // --- RENDER LOGIC ---
  return (
    <>
      {/* MODIFIED: L1 Context Display Area - now uses onDoubleClick */}
      <nDo
        className={styles.journalParentHeader} // Remove .l1NavActive if it was for long-press state
        onDoubleClick={() => {
          // Add a direct console log here
          console.log("L1 Context DIV onDoubleClick FIRED!");
          handleL1ContextDoubleClick();
        }}
        // onContextMenu={(e) => e.preventDefault()} // Keep if you still want to prevent right-click menu
        style={{
          cursor:
            selectedTopLevelId !== rootJournalIdConst ? "pointer" : "default",
        }} // Indicate interactivity
      >
        <span className={styles.journalParentInfo}>
          {currentL1ContextNode?.code || "N/A"} -{" "}
          {currentL1ContextNode?.name || "Overview"}
          {selectedTopLevelId !== rootJournalIdConst && " "}
        </span>
        {/* REMOVED: L1 Navigation Options Overlay */}
      </nDo>

      <h3 className={styles.level2ScrollerTitle}>
        {selectedTopLevelId === rootJournalIdConst
          ? "Top-Level Accounts"
          : `Level 2 Accounts (Children of ${
              currentL1ContextNode?.code || "..."
            })`}
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
                  <div className={styles.l2ButtonInteractiveWrapper}>
                    <button
                      onClick={() => handleL2ItemInteraction(l2ContextNode.id)} // Use the new interaction handler
                      onContextMenu={(e) => e.preventDefault()} // Keep if desired
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

      {/* Backdrop is removed as click-away is handled by document event listener */}

      {/* L3 Scroller Title */}
      <h3
        className={
          styles.level2ScrollerTitle
        } /* Re-use L2 title style or create new */
      >
        {selectedLevel2Ids.length > 0
          ? `Level 3 Accounts (Children of L2: ${selectedLevel2Ids
              .map((id) => {
                const l1Node =
                  selectedTopLevelId === rootJournalIdConst
                    ? { children: hierarchyData }
                    : findNodeById(hierarchyData, selectedTopLevelId);
                const l2Node = findNodeById(l1Node?.children, id);
                return l2Node?.code || id;
              })
              .join(", ")})`
          : "Select L2 Account(s) Above"}
      </h3>

      {/* NEW L3 Scroller (modeled after L2 Scroller) */}
      {level3NodesForScroller.length > 0 ? (
        <div className={styles.level2ScrollerContainer}>
          <Swiper
            key={l3ScrollerKey} // Use new key
            onSwiper={(swiper) => {
              l3ScrollerSwiperInstanceRef.current = swiper; // Use new ref
            }}
            modules={[Navigation]}
            slidesPerView={"auto"}
            spaceBetween={8}
            navigation={false} // Conditional navigation
            className={`${styles.level2ScrollerSwiper} ${styles.level3ScrollerSwiperOverride}`} // Re-use L2 swiper style, add override if needed
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
                  className={styles.level2ScrollerSlideNoOverflow} // Re-use L2 slide style
                >
                  <div className={styles.l2ButtonInteractiveWrapper}>
                    {" "}
                    {/* Re-use L2 wrapper style */}
                    <button
                      onClick={() => handleL3ItemInteraction(l3Node.id)} // Use L3 interaction handler
                      onContextMenu={(e) => e.preventDefault()}
                      className={`${styles.level2Button} ${
                        // Re-use L2 button style
                        selectedLevel3Ids.includes(l3Node.id)
                          ? styles.level2ButtonActive
                          : ""
                      }`}
                      title={`${l3Node.code} - ${l3Node.name || "Unnamed"}`}
                    >
                      {l3Node.code || "N/A"}
                      {/* Optionally display more info like name if space allows, or on hover */}
                      {/* <span className={styles.l3ButtonNameInScroller}>{l3Node.name}</span> */}
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

// --- DynamicSlider Component (Unchanged from original) ---
function DynamicSlider({
  sliderId,
  title,
  data = [],
  onSlideChange,
  activeItemId,
  isAccordionOpen,
  onToggleAccordion,
}) {
  const initialSlideIndex = Math.max(
    0,
    data.findIndex((item) => item?.id === activeItemId)
  );

  const handleSwiperChange = (swiper) => {
    const currentRealIndex = swiper.activeIndex;
    if (data && data.length > currentRealIndex && data[currentRealIndex]) {
      onSlideChange(data[currentRealIndex].id);
    } else {
      console.warn(
        `DynamicSlider (${sliderId}): Swipe Change - Invalid index (${currentRealIndex}) or data. Len: ${data?.length}`
      );
    }
  };

  let currentItemForAccordion = data.find((item) => item?.id === activeItemId);
  if (
    !currentItemForAccordion &&
    data.length > 0 &&
    initialSlideIndex < data.length &&
    data[initialSlideIndex]
  ) {
    console.warn(
      `DynamicSlider Accordion (${sliderId}): Active item ${activeItemId} not found. Using item at index ${initialSlideIndex}.`
    );
    currentItemForAccordion = data[initialSlideIndex];
  }

  const swiperKey = `${sliderId}-len${data.length}-active${activeItemId}`;

  return (
    <>
      <h2 className={styles.sliderTitle}>{title}</h2>
      {data.length > 0 ? (
        <Swiper
          key={swiperKey}
          modules={[Navigation, Pagination]}
          initialSlide={initialSlideIndex}
          loop={false}
          spaceBetween={20}
          slidesPerView={1}
          navigation={data.length > 1}
          pagination={data.length > 1 ? { clickable: true } : false}
          onSlideChangeTransitionEnd={handleSwiperChange}
          observer={true}
          observeParents={true}
          className={`${styles.swiperInstance}`}
        >
          {data.map((item) => {
            if (!item) return null;
            const IconComponent =
              sliderId === SLIDER_TYPES.JOURNAL && JOURNAL_ICONS[item.id]
                ? JOURNAL_ICONS[item.id]
                : null;

            return (
              <SwiperSlide key={item.id} className={styles.slide}>
                <div
                  className={`${styles.slideTextContent} ${
                    IconComponent ? styles.slideTextContentWithIcon : ""
                  }`}
                >
                  {IconComponent && (
                    <IconComponent
                      className={styles.slideIcon}
                      aria-hidden="true"
                    />
                  )}
                  <span className={styles.slideName}>
                    {item.name || item.id || "Unnamed Item"}
                  </span>
                  {sliderId === SLIDER_TYPES.GOODS && item.unit_code && (
                    <span className={styles.slideSubText}>
                      {item.unit_code}
                    </span>
                  )}
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      ) : (
        <div className={styles.noData}>No items match criteria.</div>
      )}
      {currentItemForAccordion && onToggleAccordion && (
        <div className={styles.accordionContainer}>
          <button
            onClick={onToggleAccordion}
            className={styles.detailsButton}
            aria-expanded={isAccordionOpen}
          >
            Details
            <span
              className={`${styles.accordionIcon} ${
                isAccordionOpen ? styles.accordionIconOpen : ""
              }`}
            >
              ▼
            </span>
          </button>
          <AnimatePresence initial={false}>
            {isAccordionOpen && (
              <motion.div
                key={`details-accordion-${currentItemForAccordion.id}`} // Ensure key is unique
                initial="collapsed"
                animate="open"
                exit="collapsed"
                variants={{
                  open: { opacity: 1, height: "auto", marginTop: "8px" },
                  collapsed: { opacity: 0, height: 0, marginTop: "0px" },
                }}
                transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                className={styles.detailsContentWrapper}
              >
                <div className={styles.detailsContent}>
                  {currentItemForAccordion.description && (
                    <p>
                      <strong>Description:</strong>{" "}
                      {currentItemForAccordion.description}
                    </p>
                  )}
                  {currentItemForAccordion.name && (
                    <p>
                      <strong>Name:</strong> {currentItemForAccordion.name}
                    </p>
                  )}
                  {currentItemForAccordion.id && (
                    <p>
                      <strong>ID:</strong> {currentItemForAccordion.id}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

// --- AccountNode Component (Unchanged from original) ---
function AccountNode({
  node,
  level = 0,
  openNodes,
  toggleNode, // Called by chevron
  selectedAccountId,
  onSelectNode, // Called by single click on row
  onDoubleClickNode, // NEW: Called by double click on row
  onTriggerAddChildToNode, // For the "+" button
  onDeleteNode, // For the "trash" button
  conceptualRootId, // NEW: ID of the modal's conceptual root node
}) {
  const isOpen =
    openNodes[node.id] ?? (level === 0 && node.id === conceptualRootId); // Conceptual root is open by default
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedAccountId;
  const isConceptualRootNode = node.id === conceptualRootId;
  // An "actual L1" is a direct child of the conceptual root node.
  // This assumes the conceptualRootId is passed and node.parentId isn't readily available.
  // We can infer by level if conceptualRootId is always level 0's parent.
  // For simplicity, let's assume any node with children rendered at level 0 (if it's not the root itself)
  // or any node at level 1 (if root is level 0) can be double-clicked to set context.
  // More accurately: if conceptualRootId is defined, any child of it is an L1.
  // For this example, let's simplify: if it's not conceptualRoot and has no parent (meaning it's an L1 from original data),
  // or if its direct parent IS the conceptualRootId (passed down via a more complex parent tracking).
  // For now: a node is an "actual L1" if it's a child of the conceptual root.
  // This requires knowing the parent, or simply by level === 1 if conceptualRootId is always at level 0.
  const isActualL1Account = level === 1 && !isConceptualRootNode;

  // Handles single click on the entire row - NOW ONLY SELECTS
  const handleRowSingleClick = (e) => {
    // Check if the click target is the toggle chevron itself
    if (e.target.closest(`.${styles.accountNodeToggle}`)) {
      // If click was on chevron, let handleToggleIconClick manage it.
      // And do not propagate to select the node.
      e.stopPropagation();
      return;
    }
    onSelectNode(node.id);
  };

  // Handles double click on the entire row
  const handleRowDoubleClick = () => {
    if (onDoubleClickNode) {
      // Pass flags to help JournalModal decide action
      onDoubleClickNode(node.id, isConceptualRootNode, isActualL1Account);
    }
  };

  // Handles click specifically on the toggle icon (chevron)
  const handleToggleIconClick = (e) => {
    e.stopPropagation(); // Prevent row click/double-click from firing
    if (hasChildren) {
      toggleNode(node.id); // Only toggle if it has children
    }
  };

  const handleAddChildClick = (e) => {
    e.stopPropagation();
    if (onTriggerAddChildToNode) {
      // If current node is conceptualRoot, adding child means adding L1
      // This logic is now handled by JournalModal's onTriggerAddChild prop construction
      onTriggerAddChildToNode(node.id, node.code);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (isConceptualRootNode) return; // Cannot delete the conceptual Root
    if (onDeleteNode) {
      if (
        window.confirm(
          `Are you sure you want to delete "${node.code} - ${node.name}"? This will also delete all its sub-accounts.`
        )
      ) {
        onDeleteNode(node.id);
      }
    }
  };
  const indentSize = 15; // px per level - Reduced from previous 20 or 25

  return (
    <>
      <div
        className={`${styles.accountNodeRow} ${
          isSelected ? styles.accountNodeSelected : ""
        }`}
        // --- MODIFIED: Inline style for padding ---
        style={{ paddingLeft: `${level * indentSize}px` }}
        onClick={handleRowSingleClick}
        onDoubleClick={handleRowDoubleClick}
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isOpen : undefined}
      >
        <span
          className={styles.accountNodeToggle}
          onClick={handleToggleIconClick} // Chevron click only
          role="button"
          tabIndex={-1} // Not individually tabbable if row is focusable
          aria-hidden="true" // Or provide accessible label if it's a button
        >
          {hasChildren ? (
            isOpen ? (
              <IoChevronDownOutline />
            ) : (
              <IoChevronForwardOutline />
            )
          ) : (
            <span className={styles.accountNodeIconPlaceholder}></span>
          )}
        </span>
        <span className={styles.accountNodeCode}>{node.code}</span>
        <span className={styles.accountNodeName}>{node.name}</span>

        <div className={styles.accountNodeActions}>
          {/* Show Add button if node is selected AND it's the conceptual root OR any other node */}
          {isSelected && onTriggerAddChildToNode && (
            <button
              onClick={handleAddChildClick}
              className={styles.accountNodeActionButton}
              title={`Add sub-account to ${node.name}${
                isConceptualRootNode ? " (New Top-Level)" : ""
              }`}
            >
              <IoAddCircleOutline />
            </button>
          )}
          {/* Show Delete button if selected, not conceptual root, and onDeleteNode exists */}
          {isSelected && !isConceptualRootNode && onDeleteNode && (
            <button
              onClick={handleDeleteClick}
              className={`${styles.accountNodeActionButton} ${styles.accountNodeDeleteButton}`}
              title={`Delete account ${node.name}`}
            >
              <IoTrashBinOutline />
            </button>
          )}
        </div>
      </div>
      {/* Children rendering part remains the same, ensuring props are passed down */}
      {/* Children Rendering - Indentation of this block's content is handled by the recursive call's `level` */}
      <div className={styles.accountNodeChildrenContainer}>
        <AnimatePresence initial={false}>
          {hasChildren && isOpen && (
            <motion.div
              key={`${node.id}-children`}
              initial="collapsed"
              animate="open"
              exit="collapsed"
              variants={{
                open: { opacity: 1, height: "auto" },
                collapsed: { opacity: 0, height: 0 },
              }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              // --- MODIFIED: Padding for children's motion wrapper can also be adjusted if it was adding extra ---
              // This padding was for the connecting line. If line style changes, this might need to change.
              // For now, let's assume the line starts relative to the parent's toggle.
              // The `AccountNode` rows themselves get their padding from `level * indentSize`.
              // This style below was for the connecting line's container; its paddingLeft should align with child node's icons.
              // Example: if icon area + its margin is X, this should be X.
              // For now, we'll rely on the child AccountNode's own padding.
              style={{
                overflow: "hidden",
                position: "relative", // For connecting line if re-enabled
                // paddingLeft: `${level * indentSize + (indentSize / 2)}px`, // Example: if line needs to be indented more
              }}
              className={styles.accountNodeChildrenMotionWrapper}
            >
              {node.children.map((childNode) => (
                <AccountNode
                  key={childNode.id}
                  node={childNode}
                  level={level + 1}
                  openNodes={openNodes}
                  toggleNode={toggleNode}
                  selectedAccountId={selectedAccountId}
                  onSelectNode={onSelectNode}
                  onDoubleClickNode={onDoubleClickNode} // Pass down
                  onTriggerAddChildToNode={onTriggerAddChildToNode}
                  onDeleteNode={onDeleteNode}
                  conceptualRootId={conceptualRootId} // Pass down
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// --- JournalModal Component (Minor prop change for onConfirmSelection) ---
function JournalModal({
  isOpen,
  onClose,
  onConfirmSelection, // Called with ID of L1 node (e.g. "cat-4") on double-click
  onSetShowRoot, // Called on double-click of the conceptual Root node in the tree
  hierarchy = [], // Now receives [{ id: "__MODAL_ROOT__", ..., children: [L1s...] }]
  // onTriggerAdd,    // This functionality will be handled by onTriggerAddChild when Root is selected
  onDeleteAccount,
  onTriggerAddChild, // Will handle adding L1 (if parent is Root) or L2/L3
}) {
  const [openNodes, setOpenNodes] = useState({});
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const ROOT_MODAL_NODE_ID_INTERNAL = hierarchy[0]?.id; // Get the ID of the passed root

  useEffect(() => {
    if (!isOpen) {
      setOpenNodes({});
      setSelectedAccountId(null);
    } else {
      // Expand the conceptual root node by default when modal opens
      if (hierarchy.length > 0 && hierarchy[0]?.isConceptualRoot) {
        setOpenNodes({ [hierarchy[0].id]: true });
        setSelectedAccountId(hierarchy[0].id); // Optionally select Root by default
      }
    }
  }, [isOpen, hierarchy]);

  const toggleNode = useCallback((nodeId) => {
    // Only toggles via chevron
    setOpenNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }, []);

  const handleSelectNode = useCallback((nodeId) => {
    // Single click selects
    setSelectedAccountId(nodeId);
    console.log(
      "JournalModal: Single Click - Selected Account Node ID:",
      nodeId
    );
  }, []);

  // NEW: Handler for double-clicking a node
  const handleDoubleClickNode = useCallback(
    (nodeId, nodeIsConceptualRoot, nodeIsActualL1) => {
      console.log("JournalModal: Double Click on Node ID:", nodeId);
      if (nodeIsConceptualRoot) {
        if (onSetShowRoot) {
          onSetShowRoot(); // Sets main view to Root and closes modal
        }
        onClose(); // Ensure modal closes
      } else if (nodeIsActualL1) {
        // If it's an actual L1 account (child of conceptual root)
        if (onConfirmSelection) {
          onConfirmSelection(nodeId); // Sets this L1 as main view context and closes modal
        }
        onClose(); // Ensure modal closes
      }
      // Double-clicking L2 or L3 could potentially also "drill into" them (set as L1 context)
      // For now, only L1s and the conceptual Root have double-click actions that close modal.
    },
    [onSetShowRoot, onConfirmSelection, onClose]
  );

  if (!isOpen) return null;

  return (
    <motion.div
      className={styles.modalOverlay} // <<< ADDED/ENSURED CLASSNAME
      onClick={onClose} // Click on overlay closes modal
      key="journal-modal-overlay" // For AnimatePresence if this modal is wrapped by it in Home
      initial="closed"
      animate="open"
      exit="closed"
      variants={{
        open: { opacity: 1, transition: { duration: 0.3, ease: "easeInOut" } },
        closed: {
          opacity: 0,
          transition: { duration: 0.2, ease: "easeInOut" },
        },
      }}
    >
      <motion.div
        className={styles.modalContent} // <<< ADDED/ENSURED CLASSNAME
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside content from closing modal
        key="journal-modal-content"
        initial={{ opacity: 0, scale: 0.9, y: "5%" }} // Start slightly scaled down and offset
        animate={{ opacity: 1, scale: 1, y: "0%" }}
        exit={{ opacity: 0, scale: 0.9, y: "5%" }}
        transition={{ duration: 0.25, ease: "circOut" }} // Adjust timing/ease as desired
      >
        <button
          className={styles.modalCloseButton}
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>
        <h2>Manage Journals</h2>
        <div className={styles.accountHierarchyContainer}>
          {hierarchy.length > 0 ? (
            hierarchy.map(
              (
                conceptualRootNode // Should only be one conceptualRootNode
              ) => (
                <AccountNode
                  key={conceptualRootNode.id}
                  node={conceptualRootNode}
                  level={0}
                  openNodes={openNodes}
                  toggleNode={toggleNode} // For chevron click
                  selectedAccountId={selectedAccountId}
                  onSelectNode={handleSelectNode} // For single click selection
                  onDoubleClickNode={handleDoubleClickNode} // NEW PROP for double click
                  // onTriggerAddChildToNode prop on AccountNode will call our onTriggerAddChild
                  onTriggerAddChildToNode={onTriggerAddChild}
                  onDeleteNode={onDeleteAccount}
                  // Pass the ID of the conceptual root for special handling in AccountNode if needed
                  conceptualRootId={ROOT_MODAL_NODE_ID_INTERNAL}
                />
              )
            )
          ) : (
            <p>No accounts to display.</p> // Should not happen if conceptual root is always passed
          )}
        </div>
        {/* REMOVED: modalActions div and its buttons */}
        {/* Actions like "Add" are now contextual via AccountNode */}
      </motion.div>
    </motion.div>
  );
}

// --- AddJournalModal Component (Unchanged from original) ---
function AddJournalModal({ isOpen, onClose, onSubmit, context }) {
  const [newCodeSuffix, setNewCodeSuffix] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  let codePrefixForDisplay = "";
  let codeSeparator = "";
  let codePatternHint = "";
  let finalCodeForNewAccount = "";

  let currentLevel = 1;
  if (context?.parentCode) {
    if (
      !context.parentCode.includes("-") &&
      context.parentCode.length === 1 &&
      /^\d$/.test(context.parentCode)
    ) {
      currentLevel = 2;
      codePrefixForDisplay = context.parentCode;
      codeSeparator = "";
      codePatternHint = `Enter 2 digits (e.g., "01" for code ${context.parentCode}01)`;
    } else {
      currentLevel = 3;
      codePrefixForDisplay = context.parentCode;
      codeSeparator = "-";
      codePatternHint = `Enter 1 or 2 digits (e.g., "01" for code ${context.parentCode}-01)`;
    }
  } else {
    codePatternHint = `Enter a single digit (1-9)`;
  }

  useEffect(() => {
    if (isOpen) {
      setNewCodeSuffix("");
      setNewName("");
      setError("");
      setTimeout(() => {
        document.getElementById("newJournalCodeSuffix")?.focus();
      }, 100);
    }
  }, [isOpen, context]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const trimmedSuffix = newCodeSuffix.trim();
    const trimmedName = newName.trim();

    if (!trimmedSuffix || !trimmedName) {
      setError("Code Suffix and Name fields are required.");
      return;
    }

    if (currentLevel === 1) {
      if (!/^[1-9]$/.test(trimmedSuffix)) {
        setError("Top-level code must be a single digit (1-9).");
        return;
      }
      finalCodeForNewAccount = trimmedSuffix;
    } else if (currentLevel === 2) {
      if (!/^\d{2}$/.test(trimmedSuffix)) {
        setError(
          `Level 2 code suffix (after "${codePrefixForDisplay}") must be exactly two digits. e.g., "01"`
        );
        return;
      }
      finalCodeForNewAccount = codePrefixForDisplay + trimmedSuffix;
    } else {
      if (!/^\d{1,2}$/.test(trimmedSuffix)) {
        setError(
          `Level 3+ code suffix (after "${codePrefixForDisplay}${codeSeparator}") must be one or two digits. e.g., "01"`
        );
        return;
      }
      finalCodeForNewAccount =
        codePrefixForDisplay + codeSeparator + trimmedSuffix;
    }

    const newAccountId = finalCodeForNewAccount;
    onSubmit({
      id: newAccountId,
      code: finalCodeForNewAccount,
      name: trimmedName,
      children: [],
    });
    onClose();
  };

  if (!isOpen) return null;

  let title = "Add New Journal Account";
  if (context) {
    if (context.level === "top" || !context.parentCode) {
      title = "Add New Top-Level Category";
    } else {
      const parentDisplayName = context.parentName
        ? `${context.parentCode} - ${context.parentName}`
        : context.parentCode || context.parentId;
      title = `Add Sub-Account to "${parentDisplayName}"`;
    }
  }

  return (
    <motion.div
      className={styles.modalOverlay}
      key="add-journal-modal-overlay"
      initial="closed"
      animate="open"
      exit="closed"
      variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      style={{ zIndex: 1001 }} // Ensure it's on top
    >
      <motion.div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        key="add-journal-modal-content"
        variants={{
          open: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { delay: 0.05, duration: 0.25 },
          },
          closed: {
            opacity: 0,
            scale: 0.95,
            y: "5%",
            transition: { duration: 0.2 },
          },
        }}
      >
        <button
          className={styles.modalCloseButton}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2>{title}</h2>
        <form onSubmit={handleSubmit} className={styles.addJournalForm}>
          {error && <p className={styles.formError}>{error}</p>}
          <div className={styles.formGroup}>
            <label htmlFor="newJournalCodeSuffix">
              Account Code{" "}
              {currentLevel > 1
                ? `Suffix (after "${codePrefixForDisplay}${codeSeparator}")`
                : ""}{" "}
              :
            </label>
            <input
              type="text"
              id="newJournalCodeSuffix" // Changed ID
              value={newCodeSuffix}
              onChange={(e) => setNewCodeSuffix(e.target.value)}
              placeholder={codePatternHint} // Placeholder shows hint for suffix
              required
              aria-describedby={error ? "formErrorText" : undefined}
            />
            {currentLevel > 1 && ( // Show constructed code preview
              <small className={styles.inputHint}>
                Full Code Preview: {codePrefixForDisplay}
                {codeSeparator}
                {newCodeSuffix || "XX"}
              </small>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="newJournalName">Account Name:</label>
            <input
              type="text"
              id="newJournalName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Advertising Campaign"
              required
              aria-describedby={error ? "formErrorText" : undefined}
            />
          </div>
          <div
            className={styles.modalActions}
            style={{ marginTop: "var(--spacing-unit)" }}
          >
            <button
              type="button"
              className={`${styles.modalButtonSecondary} ${styles.modalActionButton}`}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`${styles.modalButtonPrimary} ${styles.modalActionButton}`}
            >
              <IoAddCircleOutline /> Add Account
            </button>
          </div>
        </form>
        {error && (
          <div id="formErrorText" role="alert" style={{ display: "none" }}>
            {error}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// --- Main Page Component ---
export default function Home() {
  const [sliderOrder, setSliderOrder] = useState(INITIAL_ORDER);
  const [activeDataSource, setActiveDataSource] = useState("data1");
  const [activeDataSet, setActiveDataSet] = useState(initialData1);

  const initialTopLevelId = ROOT_JOURNAL_ID; // Start at the root view

  const [selectedTopLevelJournalId, setSelectedTopLevelJournalId] =
    useState(initialTopLevelId);
  const [selectedLevel2JournalIds, setSelectedLevel2JournalIds] = useState([]);
  const [selectedLevel3JournalIds, setSelectedLevel3JournalIds] = useState([]);

  const placeholderProjectData = [
    { id: "project-placeholder", name: "Sample Project" },
  ];
  const placeholderDocumentData = [
    { id: "document-placeholder", name: "Specification Doc" },
  ];

  const ROOT_JOURNAL_ID_FOR_MODAL = "__MODAL_ROOT_NODE__"; // Unique ID for the modal's root representation

  const getInitialL2L3Selection = useCallback(
    (currentTopLevelId, currentSelectedL2Ids, dataset) => {
      let parentNodeForL2s;
      let l2SourceNodes;

      if (currentTopLevelId === ROOT_JOURNAL_ID) {
        // L2s are the actual L1 accounts from the hierarchy
        l2SourceNodes = dataset?.account_hierarchy || [];
      } else {
        // L2s are children of the selectedTopLevelId
        parentNodeForL2s = findNodeById(
          dataset?.account_hierarchy,
          currentTopLevelId
        );
        l2SourceNodes = parentNodeForL2s?.children || [];
      }

      let firstActiveL3Id = null;
      for (const l2Id of currentSelectedL2Ids) {
        // Find the L2 node from its correct source list
        const l2Node = findNodeById(l2SourceNodes, l2Id);
        if (l2Node && l2Node.children && l2Node.children.length > 0) {
          firstActiveL3Id = l2Node.children[0].id;
          break;
        }
      }
      return { firstActiveL3Id };
    },
    []
  ); // ROOT_JOURNAL_ID is a constant

  const [selectedPartnerId, setSelectedPartnerId] = useState(() =>
    getFirstId(activeDataSet?.partners)
  );
  const [selectedGoodsId, setSelectedGoodsId] = useState(() =>
    getFirstId(activeDataSet?.goods)
  );
  const [selectedProjectId, setSelectedProjectId] = useState(
    "project-placeholder"
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState(
    "document-placeholder"
  );

  const [displayedPartners, setDisplayedPartners] = useState(
    () => activeDataSet?.partners || []
  );
  const [displayedGoods, setDisplayedGoods] = useState(
    () => activeDataSet?.goods || []
  );
  const [displayedProjects, setDisplayedProjects] = useState(
    placeholderProjectData
  );
  const [displayedDocuments, setDisplayedDocuments] = useState(
    placeholderDocumentData
  );

  const [accordionTypeState, setAccordionTypeState] = useState({
    [SLIDER_TYPES.JOURNAL]: false,
    [SLIDER_TYPES.PARTNER]: false,
    [SLIDER_TYPES.GOODS]: false,
    [SLIDER_TYPES.PROJECT]: false,
    [SLIDER_TYPES.DOCUMENT]: false,
  });
  const [visibility, setVisibility] = useState({
    [SLIDER_TYPES.JOURNAL]: true,
    [SLIDER_TYPES.PARTNER]: true,
    [SLIDER_TYPES.GOODS]: true,
    [SLIDER_TYPES.PROJECT]: false,
    [SLIDER_TYPES.DOCUMENT]: false,
  });
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [isAddJournalModalOpen, setIsAddJournalModalOpen] = useState(false);
  const [addJournalContext, setAddJournalContext] = useState(null);
  const visibilitySwiperRef = useRef(null);

  useEffect(() => {
    if (visibilitySwiperRef.current) {
      visibilitySwiperRef.current?.update();
    }
  }, [sliderOrder]);

  console.log(
    "HOME RENDER - L1:",
    selectedTopLevelJournalId,
    "L2s:",
    selectedLevel2JournalIds,
    "L3s:",
    selectedLevel3JournalIds
  );

  useEffect(() => {
    // Placeholder for actual filtering logic based on selected journal items.
    // This will need to consider selectedTopLevelJournalId, selectedLevel2JournalIds, activeMainSwiperL3Id
    // and the sliderOrder to determine which selected IDs from higher sliders filter current slider.
    console.log(
      "Filtering effect triggered. Selected L1:",
      selectedTopLevelJournalId,
      "L2s:",
      selectedLevel2JournalIds,
      "Selected L3s:", // Corrected line
      selectedLevel3JournalIds // Corrected variable
    );

    // For now, just use all data
    let finalFilteredPartners = activeDataSet?.partners || [];
    let finalFilteredGoods = activeDataSet?.goods || [];

    if (
      JSON.stringify(displayedPartners) !==
      JSON.stringify(finalFilteredPartners)
    )
      setDisplayedPartners(finalFilteredPartners);
    if (JSON.stringify(displayedGoods) !== JSON.stringify(finalFilteredGoods))
      setDisplayedGoods(finalFilteredGoods);

    // Selection Reset Checks
    if (
      selectedPartnerId &&
      !finalFilteredPartners.some((p) => p?.id === selectedPartnerId)
    )
      setSelectedPartnerId(getFirstId(finalFilteredPartners));
    if (
      selectedGoodsId &&
      !finalFilteredGoods.some((g) => g?.id === selectedGoodsId)
    )
      setSelectedGoodsId(getFirstId(finalFilteredGoods));
  }, [
    sliderOrder,
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    selectedPartnerId,
    selectedGoodsId,
    selectedProjectId,
    selectedDocumentId,
    activeDataSet,
    // Not including displayedPartners/Goods here to avoid potential loops if set within this effect directly
  ]);

  const handleDataSourceChange = (event) => {
    const newSourceKey = event.target.value;
    if (newSourceKey === activeDataSource) return;
    const newDataSet = newSourceKey === "data1" ? initialData1 : initialData2;

    setActiveDataSource(newSourceKey);
    setActiveDataSet(newDataSet);

    setSelectedTopLevelJournalId(ROOT_JOURNAL_ID); // Reset to root view
    setSelectedLevel2JournalIds([]);

    setSelectedPartnerId(getFirstId(newDataSet?.partners));
    setSelectedGoodsId(getFirstId(newDataSet?.goods));
  };

  const openJournalModal = useCallback(() => setIsJournalModalOpen(true), []);
  const closeJournalModal = useCallback(() => setIsJournalModalOpen(false), []);

  // This function is called when an item is selected in the JournalModal (for hierarchy navigation)
  // OR when "Select Category" is clicked in the "parents-like" view of JournalHierarchySlider.
  // It sets the new "parent" for the L2 scroller.
  const handleSelectTopLevelJournal = useCallback(
    (newTopLevelId, childToSelectInL2 = null) => {
      // Ensure newTopLevelId is valid (not an empty string, exists, or is ROOT)
      if (!newTopLevelId && newTopLevelId !== ROOT_JOURNAL_ID) {
        console.error(
          "handleSelectTopLevelJournal called with invalid newTopLevelId:",
          newTopLevelId
        );
        return;
      }
      if (
        newTopLevelId !== ROOT_JOURNAL_ID &&
        !findNodeById(activeDataSet?.account_hierarchy, newTopLevelId)
      ) {
        console.error(
          "Selected Top-Level ID not found in hierarchy:",
          newTopLevelId
        );
        return;
      }

      console.log(
        `Home: Setting L1 context to: ${newTopLevelId}. Attempting to select L2 child: ${
          childToSelectInL2 || "none"
        }`
      );
      setSelectedTopLevelJournalId(newTopLevelId);

      if (childToSelectInL2) {
        let l2SourceNodesForValidation;
        if (newTopLevelId === ROOT_JOURNAL_ID) {
          l2SourceNodesForValidation = activeDataSet?.account_hierarchy || [];
        } else {
          const topNode = findNodeById(
            activeDataSet?.account_hierarchy,
            newTopLevelId
          );
          l2SourceNodesForValidation = topNode?.children || [];
        }

        if (
          l2SourceNodesForValidation.some(
            (node) => node.id === childToSelectInL2
          )
        ) {
          setSelectedLevel2JournalIds([childToSelectInL2]);
        } else {
          console.warn(
            `Home: childToSelectInL2 "${childToSelectInL2}" not found under new L1 context "${newTopLevelId}". Clearing L2 selection.`
          );
          setSelectedLevel2JournalIds([]);
        }
      } else {
        setSelectedLevel2JournalIds([]);
      }
      setSelectedLevel3JournalIds([]); // ADD: Clear L3 selections when L1 changes
    },
    [activeDataSet, ROOT_JOURNAL_ID]
  ); // Dependencies

  // page.js - Home component

  const handleNavigateContextDown = useCallback(
    // This is for L2 "Go Down"
    ({ currentL1ToBecomeL2, longPressedL2ToBecomeL3: targetL2NowL3 }) => {
      console.log(
        `Home: Navigating Context Down (from L2). Old L1: ${currentL1ToBecomeL2}, Target L2 (to become L3): ${targetL2NowL3}`
      );

      let newL1ContextId;
      const parentOfOldL1 = findParentOfNode(
        currentL1ToBecomeL2,
        activeDataSet.account_hierarchy
      );

      newL1ContextId = parentOfOldL1 ? parentOfOldL1.id : ROOT_JOURNAL_ID;

      console.log(
        `  New L1 context will be ${newL1ContextId}, previous L1 ${currentL1ToBecomeL2} should be selected in L2.`
      );

      setSelectedTopLevelJournalId(newL1ContextId);
      setSelectedLevel2JournalIds([currentL1ToBecomeL2]); // Old L1 becomes selected L2

      // The targetL2NowL3 (which was an L2 under currentL1ToBecomeL2) is now an L3. Select it.
      setSelectedLevel3JournalIds([]); // NEW: do not pre-select the target L3
    },
    [
      activeDataSet,
      ROOT_JOURNAL_ID,
      setSelectedTopLevelJournalId,
      setSelectedLevel2JournalIds,
      setSelectedLevel3JournalIds,
    ] // Added stable setters
  );
  // page.js - Home component
  const handleToggleLevel2JournalId = useCallback(
    (level2IdToToggle) => {
      // Validate level2IdToToggle (as before)
      let l2SourceNodes;
      let currentL1Node; // To find children later

      if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
        l2SourceNodes = activeDataSet?.account_hierarchy || [];
        currentL1Node = {
          id: ROOT_JOURNAL_ID,
          children: activeDataSet.account_hierarchy,
        };
      } else {
        currentL1Node = findNodeById(
          activeDataSet?.account_hierarchy,
          selectedTopLevelJournalId
        );
        l2SourceNodes = currentL1Node?.children || [];
      }
      if (!l2SourceNodes.some((node) => node.id === level2IdToToggle)) {
        console.warn(
          `Attempted to toggle invalid L2 ID "${level2IdToToggle}" for current L1 context "${selectedTopLevelJournalId}"`
        );
        return;
      }

      // Calculate the new set of selected L2 IDs
      const newSelectedL2Ids = selectedLevel2JournalIds.includes(
        level2IdToToggle
      )
        ? selectedLevel2JournalIds.filter((id) => id !== level2IdToToggle)
        : [...selectedLevel2JournalIds, level2IdToToggle];

      setSelectedLevel2JournalIds(newSelectedL2Ids);

      // INSTEAD OF CLEARING L3s, VALIDATE AND FILTER THEM:
      // setSelectedLevel3JournalIds([]); // OLD: Clears L3 selections

      // NEW LOGIC: Filter existing L3 selections
      setSelectedLevel3JournalIds((prevSelectedL3Ids) => {
        if (newSelectedL2Ids.length === 0) {
          return []; // If no L2s are selected, no L3s can be selected
        }
        const validL3s = [];
        for (const l3Id of prevSelectedL3Ids) {
          // Check if this l3Id is a child of ANY of the newSelectedL2Ids
          let l3StillValid = false;
          for (const newL2Id of newSelectedL2Ids) {
            const newL2Node = findNodeById(currentL1Node?.children, newL2Id); // Source for L2s is currentL1Node.children
            if (
              newL2Node &&
              newL2Node.children?.some((l3Child) => l3Child.id === l3Id)
            ) {
              l3StillValid = true;
              break;
            }
          }
          if (l3StillValid) {
            validL3s.push(l3Id);
          }
        }
        console.log(
          "Filtered L3s based on new L2s:",
          validL3s,
          "Prev L3s:",
          prevSelectedL3Ids,
          "New L2s:",
          newSelectedL2Ids
        );
        return validL3s;
      });
    },
    [
      activeDataSet,
      selectedTopLevelJournalId,
      selectedLevel2JournalIds,
      ROOT_JOURNAL_ID,
      setSelectedLevel2JournalIds,
      setSelectedLevel3JournalIds,
    ] // Added setters to dep array
  );
  // ADD: Handler for toggling L3 items
  const handleToggleLevel3JournalId = useCallback(
    (level3IdToToggle) => {
      console.log("handleToggleLevel3JournalId CALLED for:", level3IdToToggle);
      console.log(
        "  BEFORE L3 toggle - Current L1:",
        selectedTopLevelJournalId
      );
      console.log(
        "  BEFORE L3 toggle - Current L2s:",
        selectedLevel2JournalIds
      ); // <<< IMPORTANT
      console.log(
        "  BEFORE L3 toggle - Current L3s:",
        selectedLevel3JournalIds
      );
      // Validation: L3 must be a child of one of the selected L2s
      let l3IsValid = false;
      const l1Node =
        selectedTopLevelJournalId === ROOT_JOURNAL_ID
          ? { id: ROOT_JOURNAL_ID, children: activeDataSet.account_hierarchy }
          : findNodeById(
              activeDataSet.account_hierarchy,
              selectedTopLevelJournalId
            );

      if (l1Node) {
        for (const l2Id of selectedLevel2JournalIds) {
          const l2Node = findNodeById(l1Node.children, l2Id);
          if (
            l2Node &&
            l2Node.children?.some((l3) => l3.id === level3IdToToggle)
          ) {
            l3IsValid = true;
            break;
          }
        }
      }

      if (!l3IsValid) {
        console.warn(
          `Attempted to toggle invalid L3 ID "${level3IdToToggle}" for current L1/L2 context.`
        );
        return;
      }

      setSelectedLevel3JournalIds((prevSelectedL3Ids) =>
        prevSelectedL3Ids.includes(level3IdToToggle)
          ? prevSelectedL3Ids.filter((id) => id !== level3IdToToggle)
          : [...prevSelectedL3Ids, level3IdToToggle]
      );
    },
    [
      activeDataSet,
      selectedTopLevelJournalId,
      selectedLevel2JournalIds,
      ROOT_JOURNAL_ID,
    ]
  );

  const handleNavigateFromL3Up = useCallback(
    ({ l3ItemId }) => {
      console.log(
        `Home: Navigating Up from L3 item ${l3ItemId}. It will become selected L2.`
      );

      if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
        // SCENARIO: L1 is Root.
        // selectedLevel2JournalIds contains actual L1 account IDs (e.g., "cat-4").
        // l3ItemId is an actual L2 account ID (e.g., "acc-401"), child of one of the selectedLevel2JournalIds.
        // EXPECTATION: The L1 parent of l3ItemId (e.g. "cat-4") becomes the new L1.
        //              l3ItemId (e.g. "acc-401") becomes the selected L2.

        let actualL1ParentOfL3 = null; // This will be the actual L1 node (e.g., "cat-4")

        // Find which of the selectedLevel2JournalIds (actual L1s) is the parent of l3ItemId
        for (const actualL1Id of selectedLevel2JournalIds) {
          const actualL1Node = findNodeById(
            activeDataSet.account_hierarchy,
            actualL1Id
          );
          if (
            actualL1Node &&
            actualL1Node.children?.some(
              (actualL2Node) => actualL2Node.id === l3ItemId
            )
          ) {
            actualL1ParentOfL3 = actualL1Node;
            break;
          }
        }

        if (!actualL1ParentOfL3) {
          console.error(
            `Error in L3 Up (L1=Root): Could not find actual L1 parent for L3 item ${l3ItemId} (which is an actual L2).`
          );
          return;
        }

        const newL1Id = actualL1ParentOfL3.id; // e.g., "cat-4"
        const newL2toSelect = l3ItemId; // e.g., "acc-401"

        console.log(
          `  L3 Up (L1=Root): New L1: ${newL1Id} (parent of ${l3ItemId}), L2 to select: ${newL2toSelect}`
        );
        setSelectedTopLevelJournalId(newL1Id);
        setSelectedLevel2JournalIds([newL2toSelect]);
        setSelectedLevel3JournalIds([]);
      } else {
        // STANDARD CASE: L1 is a specific account.
        // (This part was already correct as per Option 1 Project Spec)
        let l2ParentOfClickedL3 = null;
        const currentL1Node = findNodeById(
          activeDataSet.account_hierarchy,
          selectedTopLevelJournalId
        );
        if (!currentL1Node || !currentL1Node.children) {
          console.error(
            `Error in L3 Up (Standard): Current L1 context ${selectedTopLevelJournalId} not found or has no children.`
          );
          return;
        }

        for (const l2Node of currentL1Node.children) {
          if (
            selectedLevel2JournalIds.includes(l2Node.id) &&
            l2Node.children?.some((l3) => l3.id === l3ItemId)
          ) {
            l2ParentOfClickedL3 = l2Node;
            break;
          }
        }

        if (!l2ParentOfClickedL3) {
          console.error(
            `Error in L3 Up (Standard): Could not find L2 parent for L3 item ${l3ItemId} under L1 ${selectedTopLevelJournalId}.`
          );
          return;
        }

        const newL1Id = l2ParentOfClickedL3.id; // The L2 parent becomes the new L1
        const newL2toSelect = l3ItemId; // The clicked L3 becomes the selected L2

        console.log(
          `  L3 Up (Standard): New L1: ${newL1Id}, L2 to select: ${newL2toSelect}`
        );
        setSelectedTopLevelJournalId(newL1Id);
        setSelectedLevel2JournalIds([newL2toSelect]);
        setSelectedLevel3JournalIds([]);
      }
    },
    [
      activeDataSet,
      selectedTopLevelJournalId,
      selectedLevel2JournalIds,
      ROOT_JOURNAL_ID,
      setSelectedTopLevelJournalId,
      setSelectedLevel2JournalIds,
      setSelectedLevel3JournalIds,
    ]
  );
  const handleNavigateFromL3Down = useCallback(
    ({ l3ItemId }) => {
      console.log(`Home: Navigating Down from unselected L3 item ${l3ItemId}.`);

      if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
        console.warn(
          "Cannot 'Go Down' from an L3 item when L1 context is Root and L3 is not selected. This action is typically 'Go Up' to make its L2 parent the L1."
        );
        // Fallback: Make the L2 parent of this (unselected) L3 the new L1 context.
        // This is similar to L2 double-click when L1 is Root and L2 is unselected.
        let actualL2ParentOfL3 = null; // This will be an actual L2 account

        // Iterate through L1s (which are L2s in Root view)
        for (const l1Node of activeDataSet.account_hierarchy) {
          if (selectedLevel2JournalIds.includes(l1Node.id)) {
            // Check selected L1s (acting as L2s)
            // Iterate through L2s (which are L3s in Root view)
            if (l1Node.children) {
              for (const l2Node of l1Node.children) {
                if (
                  l2Node.children?.some((l3Child) => l3Child.id === l3ItemId)
                ) {
                  actualL2ParentOfL3 = l2Node; // This is the L2 node that is parent of l3ItemId
                  break;
                }
              }
            }
          }
          if (actualL2ParentOfL3) break;
        }

        if (actualL2ParentOfL3) {
          console.log(
            `  L3 Down (L1=Root, L3 unselected): Making L2 parent ${actualL2ParentOfL3.id} of L3 ${l3ItemId} the new L1.`
          );
          setSelectedTopLevelJournalId(actualL2ParentOfL3.id);
          setSelectedLevel2JournalIds([l3ItemId]); // The double-clicked L3 becomes the selected L2
          setSelectedLevel3JournalIds([]);
        } else {
          console.error(
            `L3 Down (L1=Root, L3 unselected): Could not find L2 parent for L3 item ${l3ItemId}.`
          );
        }
        return;
      }

      // Standard Case: L1 is not Root.
      // 1. Find the parent of the current L1. This becomes the new L1.
      const parentOfCurrentL1 = findParentOfNode(
        selectedTopLevelJournalId,
        activeDataSet.account_hierarchy
      );
      const newL1ContextId = parentOfCurrentL1
        ? parentOfCurrentL1.id
        : ROOT_JOURNAL_ID;

      // 2. The current L1 (selectedTopLevelJournalId) becomes the selected L2 in the new L1 context.
      const oldL1ToBecomeSelectedL2 = selectedTopLevelJournalId;

      // 3. The double-clicked l3ItemId needs to be targeted as a selected L3.
      //    Its direct parent (an L2 in the *original* L1 context) will now be an L3 item
      //    (as it's a child of oldL1ToBecomeSelectedL2). We need to select that original L2 parent.

      let originalL2ParentOfDClickedL3 = null;
      const currentL1Node = findNodeById(
        activeDataSet.account_hierarchy,
        selectedTopLevelJournalId
      );
      if (currentL1Node && currentL1Node.children) {
        for (const originalL2Node of currentL1Node.children) {
          // We need to check if this originalL2Node is one of the *currently selected L2s*
          // because the l3ItemId comes from a selected L2's children.
          if (
            selectedLevel2JournalIds.includes(originalL2Node.id) &&
            originalL2Node.children?.some((l3) => l3.id === l3ItemId)
          ) {
            originalL2ParentOfDClickedL3 = originalL2Node;
            break;
          }
        }
      }

      if (!originalL2ParentOfDClickedL3) {
        console.error(
          `L3 Down (Standard): Could not find the original L2 parent of L3 item ${l3ItemId}.`
        );
        // Fallback or error handling
        setSelectedTopLevelJournalId(newL1ContextId);
        setSelectedLevel2JournalIds([oldL1ToBecomeSelectedL2]);
        setSelectedLevel3JournalIds([]); // Clear L3s if target can't be found
        return;
      }
      setSelectedTopLevelJournalId(newL1ContextId);
      setSelectedLevel2JournalIds([oldL1ToBecomeSelectedL2]);
      setSelectedLevel3JournalIds([]); // NEW: do not pre-select
    },
    [
      activeDataSet,
      selectedTopLevelJournalId,
      selectedLevel2JournalIds,
      ROOT_JOURNAL_ID,
      setSelectedTopLevelJournalId,
      setSelectedLevel2JournalIds,
      setSelectedLevel3JournalIds,
    ]
  );

  const handleL3DoubleClick = useCallback(
    (l3ItemId, isSelected) => {
      console.log(
        `Home: L3 Item ${l3ItemId} double-clicked. IsSelected: ${isSelected}`
      );
      if (isSelected) {
        handleNavigateFromL3Up({ l3ItemId });
      } else {
        handleNavigateFromL3Down({ l3ItemId });
      }
    },
    [handleNavigateFromL3Up, handleNavigateFromL3Down]
  ); // Correct dependencies

  const handleSwipe = useCallback((sourceSliderId, selectedItemId) => {
    if (sourceSliderId === SLIDER_TYPES.PARTNER)
      setSelectedPartnerId(selectedItemId);
    else if (sourceSliderId === SLIDER_TYPES.GOODS)
      setSelectedGoodsId(selectedItemId);
    // ...
  }, []);

  const openAddJournalModalWithContext = useCallback((context) => {
    setAddJournalContext(context);
    setIsAddJournalModalOpen(true);
    setIsJournalModalOpen(false);
  }, []);
  const closeAddJournalModal = useCallback(() => {
    setIsAddJournalModalOpen(false);
    setAddJournalContext(null);
  }, []);

  const handleAddJournalSubmit = useCallback(
    (newAccountData) => {
      const contextParentId = addJournalContext?.parentId; // This is the parent to add under
      const isAddingToRoot = !contextParentId; // If AddJournalModal context has no parentId, it's a new L1

      setActiveDataSet((currentDataset) => {
        const originalHierarchy = currentDataset.account_hierarchy || [];
        const proposedNewId = newAccountData.id;
        if (
          addJournalContext?.level === "top" ||
          !addJournalContext?.parentId
        ) {
          if (originalHierarchy.some((node) => node.id === proposedNewId)) {
            alert(
              `Error: Top-level Account Code/ID "${proposedNewId}" already exists.`
            );
            // setIsAddJournalModalOpen(true); // Re-open modal, handled by user if error occurs
            return currentDataset;
          }
        } else {
          const parentNode = findNodeById(
            originalHierarchy,
            addJournalContext.parentId
          );
          if (
            parentNode?.children?.some((child) => child.id === proposedNewId)
          ) {
            alert(
              `Error: Account Code/ID "${proposedNewId}" already exists under parent "${addJournalContext.parentCode}".`
            );
            return currentDataset;
          }
          if (!parentNode) {
            alert(
              `Error: Parent node "${addJournalContext.parentId}" not found.`
            );
            return currentDataset;
          }
        }
        const newHierarchy = JSON.parse(JSON.stringify(originalHierarchy));

        if (isAddingToRoot) {
          // Adding a new L1 (e.g. "cat-9")
          if (originalHierarchy.some((node) => node.id === newAccountData.id)) {
            alert(
              `Error: Top-level Account Code/ID "${newAccountData.id}" already exists.`
            );
            return currentDataset;
          }
          newHierarchy.push(newAccountData);
        } else {
          // Adding a child to contextParentId
          const parentNode = findNodeById(newHierarchy, contextParentId);
          if (!parentNode) {
            alert(
              `Error: Parent node "${contextParentId}" not found for adding child.`
            );
            return currentDataset;
          }
          if (
            parentNode.children?.some((child) => child.id === newAccountData.id)
          ) {
            alert(
              `Error: Account Code/ID "${newAccountData.id}" already exists under parent "${parentNode.code}".`
            );
            return currentDataset;
          }
          parentNode.children = parentNode.children || [];
          parentNode.children.push(newAccountData);
        }
        return { ...currentDataset, account_hierarchy: newHierarchy };
      });

      // Post-add selection updates
      if (isAddingToRoot) {
        // If view was ROOT, new L1 will appear. Optionally select it.
        if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
          // handleToggleLevel2JournalId(newAccountData.id); // Select the new L1 in the L2 scroller
        } else {
          // If viewing children of cat-4, and new cat-9 added, user needs to go to ROOT to see it.
        }
      } else {
        // Child added
        // If the child was added to the current selectedTopLevelJournalId (if not ROOT)
        // or if it was added to one of the selectedLevel2JournalIds (if current top is ROOT)
        // then UI should update.
        if (contextParentId === selectedTopLevelJournalId) {
          // Added L2 under current L1 view
          // handleToggleLevel2JournalId(newAccountData.id); // Select the new L2
        } else if (selectedLevel2JournalIds.includes(contextParentId)) {
          // Added L3 under a selected L2
          // setActiveMainSwiperL3Id(newAccountData.id); // Select the new L3
          // The useEffect for activeMainSwiperL3Id should handle this if it's the first.
        }
      }
      closeAddJournalModal();
    },
    [
      addJournalContext,
      closeAddJournalModal,
      activeDataSet,
      selectedTopLevelJournalId,
      selectedLevel2JournalIds,
      ROOT_JOURNAL_ID,
    ]
  );

  const handleDeleteJournalAccount = useCallback(
    (accountIdToDelete) => {
      setActiveDataSet((currentDataset) => {
        const hierarchyCopy = JSON.parse(
          JSON.stringify(currentDataset.account_hierarchy || [])
        );
        let nodeWasRemoved = false;
        const removeNodeRecursively = (nodes, idToRemove) => {
          for (let i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].id === idToRemove) {
              nodes.splice(i, 1);
              nodeWasRemoved = true; // Set flag when node is found and removed
              return true; // Indicate removal happened in this branch
            }
            if (nodes[i].children && nodes[i].children.length > 0) {
              if (removeNodeRecursively(nodes[i].children, idToRemove)) {
                // If children array becomes empty, can remove it, but not strictly necessary
                if (nodes[i].children.length === 0) delete nodes[i].children;
                return true; // Indicate removal happened in a sub-branch
              }
            }
          }
          return false; // Node not found in this path
        };

        removeNodeRecursively(hierarchyCopy, accountIdToDelete); // Call the recursive function

        if (!nodeWasRemoved) {
          console.warn(
            "Node to delete was not found in hierarchy:",
            accountIdToDelete
          );
          return currentDataset; // Return original dataset if no node was removed
        }

        // State updates will be handled by setters outside, based on the new hierarchy.
        return { ...currentDataset, account_hierarchy: hierarchyCopy };
      });

      // After dataset update, recalculate selections.
      // This part will use the new activeDataSet in the next render or if called via setTimeout.
      // For now, call them directly, acknowledging potential stale reads if not careful.
      let newTopLevelId = selectedTopLevelJournalId;
      let newL2Ids = [...selectedLevel2JournalIds];
      let newL3Ids = [...selectedLevel3JournalIds]; // ADDED

      const currentHierarchy = activeDataSet.account_hierarchy; // This is stale!
      // It's better to get the hierarchy from the setActiveDataSet callback if possible,
      // or re-find nodes based on the assumption that deletion was successful.

      const idStillExists = (id, hierarchyToSearch) =>
        !!findNodeById(hierarchyToSearch, id);
      const updatedHierarchy = JSON.parse(
        JSON.stringify(activeDataSet.account_hierarchy || [])
      ); // Create a working copy
      // (Assume 'removeNodeRecursively' has modified 'updatedHierarchy' if it were available here)
      // This part is tricky because `activeDataSet` hasn't updated yet in this scope.
      // The logic should ideally be inside the `setActiveDataSet` callback or run after it.

      // If selected L1 was deleted
      if (
        accountIdToDelete === newTopLevelId ||
        !idStillExists(newTopLevelId, updatedHierarchy)
      ) {
        newTopLevelId = getFirstId(updatedHierarchy) || ROOT_JOURNAL_ID; // Fallback
        newL2Ids = [];
        newL3Ids = [];
      }

      // Filter out deleted L2 IDs
      const currentTopNodeAfterDelete = findNodeById(
        updatedHierarchy,
        newTopLevelId
      );
      newL2Ids = newL2Ids.filter(
        (id) =>
          id !== accountIdToDelete &&
          idStillExists(id, updatedHierarchy) &&
          currentTopNodeAfterDelete?.children?.some((c) => c.id === id)
      );

      // Filter out deleted L3 IDs
      let validL3SourceNodes = [];
      if (currentTopNodeAfterDelete) {
        newL2Ids.forEach((l2Id) => {
          const l2Node = findNodeById(currentTopNodeAfterDelete.children, l2Id);
          if (l2Node && l2Node.children) {
            validL3SourceNodes.push(...l2Node.children);
          }
        });
      }
      newL3Ids = newL3Ids.filter(
        (id) =>
          id !== accountIdToDelete &&
          idStillExists(id, updatedHierarchy) &&
          validL3SourceNodes.some((c) => c.id === id)
      );

      setSelectedTopLevelJournalId(newTopLevelId);
      setSelectedLevel2JournalIds(newL2Ids);
      setSelectedLevel3JournalIds(newL3Ids); // SET UPDATED L3 IDs
    },
    [
      selectedTopLevelJournalId,
      selectedLevel2JournalIds,
      selectedLevel3JournalIds, // ADDED
      activeDataSet, // activeDataSet is a dep
      ROOT_JOURNAL_ID,
    ]
  );

  const toggleAccordion = useCallback((sliderType) => {
    if (
      !sliderType ||
      !SLIDER_TYPES[
        Object.keys(SLIDER_TYPES).find(
          (key) => SLIDER_TYPES[key] === sliderType
        )
      ]
    )
      return;
    setAccordionTypeState((prev) => ({
      ...prev,
      [sliderType]: !prev[sliderType],
    }));
  }, []);

  const toggleVisibility = useCallback((sliderId) => {
    if (!sliderId || !SLIDER_CONFIG[sliderId]) return;
    setVisibility((prev) => ({ ...prev, [sliderId]: !prev[sliderId] }));
    setTimeout(() => {
      visibilitySwiperRef.current?.update();
    }, 50);
  }, []); // SLIDER_CONFIG is constant so not needed in deps

  const moveSlider = useCallback(
    (sliderId, direction) => {
      setSliderOrder((currentOrder) => {
        const currentIndex = currentOrder.indexOf(sliderId);
        if (currentIndex === -1 || !visibility[sliderId]) return currentOrder;
        let targetIndex = -1;
        if (direction === "up") {
          for (let i = currentIndex - 1; i >= 0; i--) {
            if (visibility[currentOrder[i]]) {
              targetIndex = i;
              break;
            }
          }
        } else {
          for (let i = currentIndex + 1; i < currentOrder.length; i++) {
            if (visibility[currentOrder[i]]) {
              targetIndex = i;
              break;
            }
          }
        }
        if (targetIndex === -1) return currentOrder;
        const newOrder = [...currentOrder];
        [newOrder[currentIndex], newOrder[targetIndex]] = [
          newOrder[targetIndex],
          newOrder[currentIndex],
        ];
        console.log(`moveSlider: Order change to ${newOrder.join(" -> ")}`);
        return newOrder;
      });
    },
    [visibility]
  ); // visibility is a dependency

  const SLIDER_CONFIG = {
    [SLIDER_TYPES.JOURNAL]: {
      Component: JournalHierarchySlider,
      title: "Journal",
    },
    [SLIDER_TYPES.PARTNER]: { Component: DynamicSlider, title: "Partner" },
    [SLIDER_TYPES.GOODS]: { Component: DynamicSlider, title: "Goods" },
    [SLIDER_TYPES.PROJECT]: { Component: DynamicSlider, title: "Project" },
    [SLIDER_TYPES.DOCUMENT]: { Component: DynamicSlider, title: "Document" },
  };

  const getSliderProps = (sliderId) => {
    switch (sliderId) {
      case SLIDER_TYPES.JOURNAL:
        const hierarchy = activeDataSet?.account_hierarchy || [];
        // The 'mode' prop for JournalHierarchySlider is now effectively always 'children'
        // The distinction is handled by what `selectedTopLevelJournalId` is (real ID or ROOT_JOURNAL_ID)
        return {
          // mode: "children", // No longer needed if JHS doesn't branch on it
          hierarchyData: hierarchy,
          selectedTopLevelId: selectedTopLevelJournalId, // Can be "cat-4" or "__ROOT__"
          selectedLevel2Ids: selectedLevel2JournalIds,
          selectedLevel3Ids: selectedLevel3JournalIds, // ADD

          onSelectTopLevel: handleSelectTopLevelJournal, // Used by "Select Category" button if JHS implements it
          onToggleLevel2Id: handleToggleLevel2JournalId,
          onToggleLevel3Id: handleToggleLevel3JournalId, // ADD
          onL3DoubleClick: handleL3DoubleClick, // ADD
          onOpenModal: openJournalModal,

          isAccordionOpen: accordionTypeState[SLIDER_TYPES.JOURNAL],
          onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.JOURNAL),
          // Pass ROOT_JOURNAL_ID for JHS to know how to interpret selectedTopLevelId
          onNavigateContextDown: handleNavigateContextDown, // NEW PROP
          rootJournalIdConst: ROOT_JOURNAL_ID,
        };

      case SLIDER_TYPES.PARTNER:
        return {
          data: displayedPartners,
          activeItemId: selectedPartnerId,
          onSlideChange: (id) => handleSwipe(sliderId, id),
          isAccordionOpen: accordionTypeState[sliderId],
          onToggleAccordion: () => toggleAccordion(sliderId),
        };
      case SLIDER_TYPES.GOODS:
        return {
          data: displayedGoods,
          activeItemId: selectedGoodsId,
          onSlideChange: (id) => handleSwipe(sliderId, id),
          isAccordionOpen: accordionTypeState[sliderId],
          onToggleAccordion: () => toggleAccordion(sliderId),
        };
      case SLIDER_TYPES.PROJECT:
        return {
          data: displayedProjects,
          activeItemId: selectedProjectId,
          onSlideChange: (id) => handleSwipe(sliderId, id),
          isAccordionOpen: accordionTypeState[sliderId],
          onToggleAccordion: () => toggleAccordion(sliderId),
        };
      case SLIDER_TYPES.DOCUMENT:
        return {
          data: displayedDocuments,
          activeItemId: selectedDocumentId,
          onSlideChange: (id) => handleSwipe(sliderId, id),
          isAccordionOpen: accordionTypeState[sliderId],
          onToggleAccordion: () => toggleAccordion(sliderId),
        };
      default:
        return {
          data: [],
          activeItemId: null,
          isAccordionOpen: false,
          onToggleAccordion: undefined,
          onSlideChange: undefined,
        };
    }
  };

  return (
    <div className={styles.pageContainer}>
      <h1 className={styles.title}>Project Interface</h1>
      <div className={styles.stickyHeaderContainer}>
        <div className={styles.dataSourceSelector}>
          <label>
            <input
              type="radio"
              name="dataSource"
              value="data1"
              checked={activeDataSource === "data1"}
              onChange={handleDataSourceChange}
            />{" "}
            All Data
          </label>
          <label>
            <input
              type="radio"
              name="dataSource"
              value="data2"
              checked={activeDataSource === "data2"}
              onChange={handleDataSourceChange}
            />{" "}
            Filtered Data (Triplets)
          </label>
        </div>
        <LayoutGroup id="visibility-toggles-layout">
          <div className={styles.visibilitySwiperContainer}>
            <Swiper
              modules={[Navigation]}
              spaceBetween={10}
              slidesPerView={"auto"}
              centeredSlides={false}
              loop={true}
              className={styles.visibilitySwiper}
              onSwiper={(swiper) => {
                visibilitySwiperRef.current = swiper;
              }}
              observer={true}
              observeParents={true}
            >
              {sliderOrder.map((sliderId, index) => {
                const config = SLIDER_CONFIG[sliderId];
                const title = config?.title || sliderId;
                const isCurrentlyVisible = visibility[sliderId];
                let visibleIndex = -1;
                if (isCurrentlyVisible) {
                  const visibleOrder = sliderOrder.filter(
                    (id) => visibility[id]
                  );
                  visibleIndex = visibleOrder.indexOf(sliderId);
                }
                return (
                  <SwiperSlide
                    key={sliderId}
                    className={styles.visibilitySwiperSlide}
                  >
                    <motion.div
                      layout
                      layoutId={`visibility-${sliderId}`}
                      className={styles.visibilitySlideContent}
                      initial={false}
                      animate={{
                        opacity: isCurrentlyVisible ? 1 : 0.4,
                        scale: isCurrentlyVisible ? 1 : 0.95,
                      }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                    >
                      <button
                        onClick={() => toggleVisibility(sliderId)}
                        className={`${styles.visibilityButton} ${
                          isCurrentlyVisible
                            ? styles.visibilityActive
                            : styles.visibilityInactive
                        }`}
                        aria-pressed={isCurrentlyVisible}
                      >
                        {isCurrentlyVisible ? `${visibleIndex + 1}: ` : ""}{" "}
                        {title}
                      </button>
                      {index < sliderOrder.length - 1 && (
                        <motion.span
                          className={styles.visibilityArrow}
                          aria-hidden="true"
                          initial={false}
                          animate={{ opacity: isCurrentlyVisible ? 1 : 0.4 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                        >
                          →
                        </motion.span>
                      )}
                    </motion.div>
                  </SwiperSlide>
                );
              })}
            </Swiper>
          </div>
        </LayoutGroup>
      </div>

      <LayoutGroup id="main-sliders-layout-group">
        <div className={styles.slidersArea}>
          <AnimatePresence initial={false}>
            {sliderOrder.map((sliderId, index) => {
              // This map is for the main content sliders
              // ... (existing safety checks for sliderId and config) ...
              if (typeof sliderId !== "string" || sliderId === "") return null;
              if (!visibility[sliderId]) return null; // This is correct: don't render if not visible
              const config = SLIDER_CONFIG[sliderId];
              if (!config) return null;

              const { Component, title: sliderTitle } = config;
              const sliderProps = getSliderProps(sliderId);

              // Calculate canMoveUp/Down based on VISIBLE sliders in their current order
              const visibleOrderedIds = sliderOrder.filter(
                (id) => visibility[id]
              );
              const currentVisibleIndex = visibleOrderedIds.indexOf(sliderId);

              const canMoveUp = currentVisibleIndex > 0;
              const canMoveDown =
                currentVisibleIndex < visibleOrderedIds.length - 1;

              return (
                <motion.div
                  key={sliderId}
                  layoutId={sliderId} // For Framer Motion reordering animation
                  layout // Enable layout animation
                  style={{ order: index }} // CSS order for initial layout (JS reordering via sliderOrder also works)
                  initial={{ opacity: 0, height: 0, y: 20 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }}
                  transition={{
                    opacity: { duration: 0.3 },
                    height: { duration: 0.3 },
                    y: { duration: 0.3 },
                    layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
                  }}
                  className={styles.sliderWrapper}
                >
                  <div className={styles.controls}>
                    <button
                      onClick={
                        sliderProps.onOpenModal
                          ? sliderProps.onOpenModal
                          : () => console.log(`Options for ${sliderId}`)
                      }
                      className={`${styles.controlButton} ${styles.editButton}`}
                      aria-label={`Options for ${sliderTitle}`}
                      title={`Options for ${sliderTitle}`}
                    >
                      <IoOptionsOutline />
                    </button>
                    <div className={styles.moveButtonGroup}>
                      {canMoveUp && ( // Check canMoveUp
                        <button
                          onClick={() => moveSlider(sliderId, "up")}
                          className={styles.controlButton}
                          aria-label={`Move ${sliderTitle} up`}
                        >
                          ▲ Up
                        </button>
                      )}
                      {canMoveDown && ( // Check canMoveDown
                        <button
                          onClick={() => moveSlider(sliderId, "down")}
                          className={styles.controlButton}
                          aria-label={`Move ${sliderTitle} down`}
                        >
                          ▼ Down
                        </button>
                      )}
                    </div>
                  </div>
                  <Component
                    sliderId={sliderId}
                    title={sliderTitle}
                    {...sliderProps}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>

      <AnimatePresence>
        {isJournalModalOpen && (
          <JournalModal
            isOpen={isJournalModalOpen}
            onClose={closeJournalModal}
            onConfirmSelection={handleSelectTopLevelJournal} // For setting L1 context
            onSetShowRoot={() => handleSelectTopLevelJournal(ROOT_JOURNAL_ID)} // For double-click on modal's Root
            // MODIFIED: Construct the hierarchy with a conceptual Root node
            hierarchy={[
              {
                id: ROOT_JOURNAL_ID_FOR_MODAL,
                name: ``,
                code: "ROOT",
                children: activeDataSet?.account_hierarchy || [],
                // Add a flag to identify it as the special root, if needed by AccountNode
                isConceptualRoot: true,
              },
            ]}
            onTriggerAdd={openAddJournalModalWithContext} // For Add Top-Level (when Root is selected in modal)
            onDeleteAccount={handleDeleteJournalAccount} // Delete will be disabled for conceptual Root
            onTriggerAddChild={(parentId, parentCode) => {
              // For Add Child
              const parentNodeDetails = findNodeById(
                activeDataSet?.account_hierarchy,
                parentId
              );
              // If parentId is ROOT_JOURNAL_ID_FOR_MODAL, it means add a new L1 account
              if (parentId === ROOT_JOURNAL_ID_FOR_MODAL) {
                openAddJournalModalWithContext({
                  level: "top", // Context for AddJournalModal
                  parentId: null,
                  parentCode: null,
                });
              } else {
                // Adding child to a real account
                openAddJournalModalWithContext({
                  level: "child",
                  parentId: parentId,
                  parentCode: parentCode,
                  parentName: parentNodeDetails?.name || "",
                });
              }
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddJournalModalOpen && (
          <AddJournalModal
            isOpen={isAddJournalModalOpen}
            onClose={closeAddJournalModal}
            onSubmit={handleAddJournalSubmit}
            context={addJournalContext}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
