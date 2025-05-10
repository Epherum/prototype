"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react"; // Added useMemo
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import Image from "next/image";
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
  IoWalletOutline,
  IoNavigateOutline,
  IoClipboardOutline,
  IoOptionsOutline,
  IoPencilOutline,
  IoChevronDownOutline,
  IoChevronForwardOutline,
  IoAddCircleOutline,
  IoCheckmarkCircleOutline,
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

const findParentOfNode = (nodeId, hierarchy, parent = null) => {
  if (!hierarchy || !nodeId) return null;
  for (const node of hierarchy) {
    if (node.id === nodeId) {
      return parent; // Found the node, return its accumulated parent
    }
    if (node.children && node.children.length > 0) {
      const foundParent = findParentOfNode(nodeId, node.children, node); // Pass current node as parent
      if (foundParent) {
        return foundParent; // If found in children, this will propagate up
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

// page.js - JournalHierarchySlider component

// page.js - JournalHierarchySlider component

function JournalHierarchySlider({
  sliderId,
  title,
  hierarchyData,
  selectedTopLevelId,
  selectedLevel2Ids, // This is ALWAYS used for L3 display now
  activeMainSwiperL3Id,
  onSelectTopLevel, // Only called by "Go Up" or Modal selection
  onToggleLevel2Id, // THIS IS THE PRIMARY ACTION FOR L2 BUTTON CLICKS
  onSelectMainSwiperL3Id,
  onOpenModal,
  isAccordionOpen,
  onToggleAccordion,
  rootJournalIdConst,
  onNavigateContextDown,
}) {
  const mainSwiperInstanceRef = useRef(null);
  const level2ScrollerSwiperInstanceRef = useRef(null);

  // --- NEW State for L1 Context Navigation ---
  const [l1NavOptionsVisible, setL1NavOptionsVisible] = useState(false);
  const l1LongPressTimerRef = useRef(null);

  // --- NEW/MODIFIED: State for Long-Press Navigation ---
  const [navContextItemId, setNavContextItemId] = useState(null); // ID of L2 item showing nav options
  const [showNavOptions, setShowNavOptions] = useState(false);
  const longPressTimerRef = useRef(null);
  const itemBeingPressedRef = useRef(null); // To avoid issues with stale closures in timer

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

  const level3NodesForMainSwiper = useMemo(() => {
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

  const l2ScrollerKey = useMemo(
    () =>
      `${sliderId}-L2scroller-L1-${selectedTopLevelId}-L2sel-${selectedLevel2Ids.join(
        "_"
      )}-len${level2NodesForScroller.length}`,
    [
      sliderId,
      selectedTopLevelId,
      selectedLevel2Ids,
      level2NodesForScroller.length,
    ]
  );

  // Key (correctly excludes activeMainSwiperL3Id)
  const mainL3SwiperKey = useMemo(() => {
    return `${sliderId}-L3swiper-L1-${selectedTopLevelId}-L2sel-${selectedLevel2Ids.join(
      "_"
    )}-len${level3NodesForMainSwiper.length}`;
  }, [
    sliderId,
    selectedTopLevelId,
    selectedLevel2Ids,
    level3NodesForMainSwiper.length,
  ]);

  // Initial slide index (correctly includes activeMainSwiperL3Id)
  const initialL3SwiperIndex = useMemo(() => {
    return Math.max(
      0,
      level3NodesForMainSwiper.findIndex(
        (node) => node?.id === activeMainSwiperL3Id
      )
    );
  }, [activeMainSwiperL3Id, level3NodesForMainSwiper]);

  // useEffect to synchronize Swiper when activeMainSwiperL3Id changes programmatically
  useEffect(() => {
    const swiper = mainSwiperInstanceRef.current;
    if (swiper && level3NodesForMainSwiper.length > 0) {
      const targetIndex = level3NodesForMainSwiper.findIndex(
        (node) => node?.id === activeMainSwiperL3Id
      );
      if (targetIndex !== -1 && swiper.activeIndex !== targetIndex) {
        // Ensure Swiper's internal slide count matches our data before trying to slide
        // This can be important if data updates and Swiper's DOM update are not perfectly in sync
        if (
          swiper.slides &&
          swiper.slides.length === level3NodesForMainSwiper.length
        ) {
          console.log(
            `L3 Swiper Sync (useEffect): Target index ${targetIndex}, current ${swiper.activeIndex}. Sliding.`
          );
          swiper.slideTo(targetIndex, 0); // Slide with 0 speed
        } else if (swiper.slidesGrid) {
          // If slide counts don't match, Swiper might need an update.
          // This scenario is more likely if the key DIDN'T change but the content did (e.g. item content changed but not length/IDs)
          console.log(
            "L3 Swiper Sync (useEffect): Slide count mismatch, updating Swiper then attempting slide."
          );
          swiper.update();
          // After update, Swiper might have adjusted its activeIndex or slide structure.
          // It's often safer to let the next render cycle with updated initialSlide handle it if data structure changed.
          // Or, attempt to slide again, carefully.
          const updatedTargetIndex = level3NodesForMainSwiper.findIndex(
            (node) => node?.id === activeMainSwiperL3Id
          );
          if (
            updatedTargetIndex !== -1 &&
            swiper.activeIndex !== updatedTargetIndex
          ) {
            swiper.slideTo(updatedTargetIndex, 0);
          }
        }
      }
    }
    // This effect specifically reacts to a desired change in the active slide ID from props,
    // or if the list of slides changes which might invalidate the current active slide.
  }, [activeMainSwiperL3Id, level3NodesForMainSwiper]); // Not including initialL3SwiperIndex as it's derived from these.

  const currentL3ItemForAccordion = useMemo(() => {
    if (!activeMainSwiperL3Id) return null;
    return findNodeById(level3NodesForMainSwiper, activeMainSwiperL3Id);
  }, [activeMainSwiperL3Id, level3NodesForMainSwiper]);

  // --- Handler for when user swipes the L3 Swiper ---
  const handleMainL3SwiperChange = (swiper) => {
    // This is Swiper's onSlideChangeTransitionEnd
    const currentRealIndex = swiper.activeIndex;
    if (level3NodesForMainSwiper?.[currentRealIndex]) {
      const newL3Id = level3NodesForMainSwiper[currentRealIndex].id;
      // Only update Home's state if the swiped-to ID is different from the current active ID
      if (onSelectMainSwiperL3Id && newL3Id !== activeMainSwiperL3Id) {
        console.log(
          `L3 Swiper User Swipe: New L3 ID selected by swipe: ${newL3Id}`
        );
        onSelectMainSwiperL3Id(newL3Id); // This updates activeMainSwiperL3Id in Home
      }
    } else if (
      level3NodesForMainSwiper.length === 0 &&
      activeMainSwiperL3Id !== null
    ) {
      // If swiper becomes empty, tell Home (should be rare if data clears first)
      if (onSelectMainSwiperL3Id) onSelectMainSwiperL3Id(null);
    }
  };

  // --- NEW/MODIFIED: Long Press Handlers & Navigation Actions ---
  const handleL2PressStart = (itemId) => {
    clearTimeout(longPressTimerRef.current);
    itemBeingPressedRef.current = itemId; // Store the item being pressed
    longPressTimerRef.current = setTimeout(() => {
      if (itemBeingPressedRef.current === itemId) {
        // Check if still pressing the same item
        console.log("Long press detected on L2 item:", itemId);
        setNavContextItemId(itemId);
        setShowNavOptions(true);
      }
    }, 700); // 700ms for long press
  };

  const handleL2PressEnd = (clickedItemId, eventType) => {
    // eventType: 'click' or 'release'
    clearTimeout(longPressTimerRef.current);
    itemBeingPressedRef.current = null; // Clear the item being pressed

    // If options are shown and it's a 'release' (mouseup/touchend not on an option button),
    // we let the click-away listener handle closing.
    // If it was a 'click' on the button itself while options were shown, that click is handled by option buttons.
    if (
      showNavOptions &&
      navContextItemId === clickedItemId &&
      eventType === "release"
    ) {
      return;
    }

    // If it was a normal click (not a long press that showed options, and not a release while options are shown)
    if (eventType === "click" && !showNavOptions) {
      if (selectedTopLevelId === rootJournalIdConst) {
        if (onSelectTopLevel) onSelectTopLevel(clickedItemId);
      } else {
        onToggleLevel2Id(clickedItemId);
      }
    }
  };

  // MODIFIED: Added useCallback for useEffect dependency array
  const closeNavOptions = useCallback(() => {
    setShowNavOptions(false);
    setNavContextItemId(null);
  }, []);

  // NEW: Click Away Listener for Nav Options
  useEffect(() => {
    if (!showNavOptions) return;

    const handleClickOutside = (event) => {
      // Check if the click target or any of its parents has the 'data-l2-button-active-nav' attribute
      if (event.target.closest("[data-l2-button-active-nav]") === null) {
        closeNavOptions();
      }
    };
    // Use mousedown to catch click before it might trigger other button's onClick
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside); // For touch devices
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showNavOptions, closeNavOptions]); // navContextItemId is not needed here

  const handleGoUp = (itemId) => {
    console.log(
      `Go Up from L2 item: ${itemId}. It becomes the new L1 context.`
    );
    if (onSelectTopLevel) {
      onSelectTopLevel(itemId);
    }
    closeNavOptions();
  };

  const handleGoDown = (itemId) => {
    if (selectedTopLevelId === rootJournalIdConst) {
      console.warn(
        "Cannot 'Go Down' from an L1 item when viewing Root context."
      );
      closeNavOptions();
      return;
    }

    console.log(
      `Attempting Go Down: Current L1="${selectedTopLevelId}", Item Pressed="${itemId}".`
    );
    if (onNavigateContextDown) {
      // Prop from Home
      onNavigateContextDown({
        currentL1ToBecomeL2: selectedTopLevelId, // The L1 context we are moving away from
        longPressedL2ToBecomeL3: itemId, // The L2 item that was long-pressed
      });
    } else {
      console.error(
        "onNavigateContextDown handler is not provided to JournalHierarchySlider"
      );
    }
    closeNavOptions();
  };

  // --- NEW: Long Press Handlers for L1 Context Display ---
  const handleL1ContextPressStart = () => {
    // Don't allow "Go Down" if already at Root
    if (selectedTopLevelId === rootJournalIdConst) return;

    clearTimeout(l1LongPressTimerRef.current);
    l1LongPressTimerRef.current = setTimeout(() => {
      setL1NavOptionsVisible(true);
    }, 700);
  };

  const handleL1ContextPressEnd = () => {
    clearTimeout(l1LongPressTimerRef.current);
    // If options are visible, a short tap on the L1 context area itself might dismiss them,
    // or we rely on clicking the "Go Down" button or a backdrop.
    // For now, let the backdrop/action buttons handle dismissal.
  };

  const closeL1NavOptions = useCallback(() => {
    setL1NavOptionsVisible(false);
  }, []);

  // NEW: Click Away Listener for L1 Nav Options (similar to L2's)
  useEffect(() => {
    if (!l1NavOptionsVisible) return;
    const handleClickOutside = (event) => {
      if (event.target.closest("[data-l1-nav-active]") === null) {
        closeL1NavOptions();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [l1NavOptionsVisible, closeL1NavOptions]);

  // --- NEW: Navigation Action for L1 Context "Go Down" ---
  const handleL1ContextGoDown = () => {
    if (selectedTopLevelId === rootJournalIdConst) {
      console.warn("Cannot 'Go Down' further; already at Root context.");
      closeL1NavOptions();
      return;
    }

    // Find the parent of the current selectedTopLevelId
    let newL1ParentContextId;
    const parentNode = findParentOfNode(selectedTopLevelId, hierarchyData);

    if (parentNode) {
      newL1ParentContextId = parentNode.id;
    } else {
      // If selectedTopLevelId was an L1 account, its parent context is Root
      newL1ParentContextId = rootJournalIdConst;
    }

    console.log(
      `L1 Context Go Down: From ${selectedTopLevelId} to ${newL1ParentContextId}`
    );
    if (onSelectTopLevel) {
      // onSelectTopLevel will set the new L1 context.
      // It should also clear selectedLevel2JournalIds and activeMainSwiperL3Id.
      // We also want to select the node we just "came down from" (selectedTopLevelId)
      // in the L2 scroller of the new parent context.
      // This requires onSelectTopLevel to be smarter or have an additional parameter.

      // For now, simpler: onSelectTopLevel just changes the L1 context.
      // User will see the new L2 scroller and can select from there.
      // To make it smoother, `Home`'s `handleSelectTopLevelJournal` could be enhanced.
      onSelectTopLevel(newL1ParentContextId, selectedTopLevelId); // Pass childToSelectInL2
    }
    closeL1NavOptions();
  };

  // --- RENDER LOGIC ---
  return (
    <>
      <div
        className={`${styles.journalParentHeader} ${
          l1NavOptionsVisible ? styles.l1NavActive : ""
        }`}
        onMouseDown={handleL1ContextPressStart}
        onMouseUp={handleL1ContextPressEnd}
        onTouchStart={handleL1ContextPressStart}
        onTouchEnd={handleL1ContextPressEnd}
        // Add data attribute for click-away listener
        {...(l1NavOptionsVisible && { "data-l1-nav-active": "true" })}
        style={{ position: "relative" }} // For positioning options
      >
        <span className={styles.journalParentInfo}>
          Current Context: {currentL1ContextNode?.code || "N/A"} -{" "}
          {currentL1ContextNode?.name || "Overview"}
          {selectedTopLevelId !== rootJournalIdConst && " (Hold to Go Down)"}
        </span>

        {/* NEW: L1 Navigation Options */}
        {l1NavOptionsVisible && selectedTopLevelId !== rootJournalIdConst && (
          <motion.div
            className={styles.l1NavOptionsOverlay} // New CSS class
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <button
              className={`${styles.navOptionButtonInside} ${styles.navOptionGoDownInside}`} // Reuse L2's button style
              onClick={(e) => {
                e.stopPropagation(); // Prevent L1 context pressEnd from firing if not desired
                handleL1ContextGoDown();
              }}
            >
              <span className={styles.navIcon}>▼</span> Go Down (to Parent
              Context)
            </button>
            {/* Optional dismiss button for L1 options */}
            <button
              className={styles.navOptionDismissInsideL1} // Potentially different style/position
              onClick={(e) => {
                e.stopPropagation();
                closeL1NavOptions();
              }}
            >
              ×
            </button>
          </motion.div>
        )}
      </div>

      <h3 className={styles.level2ScrollerTitle}>
        {selectedTopLevelId === rootJournalIdConst
          ? "Top-Level Accounts (Click to View Children, Hold for Options)"
          : `Level 2 Accounts (Children of ${
              currentL1ContextNode?.code || "..."
            }, Hold for Options)`}
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
            navigation={level2NodesForScroller.length > 4}
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
              const isNavContextActive =
                navContextItemId === l2ContextNode.id && showNavOptions;

              return (
                // MODIFIED: SwiperSlide class might need adjustment based on your CSS for overflow
                <SwiperSlide
                  key={l2ContextNode.id}
                  className={styles.level2ScrollerSlideNoOverflow}
                >
                  {/* MODIFIED: This wrapper will handle the layout animation (scaling) */}
                  <motion.div
                    className={`${styles.l2ButtonInteractiveWrapper}`}
                    // Animate the scale and potentially other properties
                    animate={isNavContextActive ? "expanded" : "normal"}
                    variants={{
                      normal: {
                        scale: 1,
                        // minWidth: 'auto', // Or specific width of normal button
                        // height: 'auto', // Or specific height
                        // zIndex: 5, // Ensure it's above others normally
                        transition: { duration: 0.2, ease: "easeOut" },
                      },
                      expanded: {
                        scale: 1.05, // Or a fixed larger size if preferred via width/height
                        // minWidth: '180px', // Match CSS if using fixed expanded size
                        // height: '90px',   // Match CSS
                        zIndex: 10, // Bring to front when expanded
                        transition: { duration: 0.3, ease: "circOut" },
                      },
                    }}
                    // Add data-attribute for click-away listener
                    {...(isNavContextActive && {
                      "data-l2-button-active-nav": "true",
                    })}
                  >
                    {/* AnimatePresence to handle fade in/out of button content vs options */}
                    <AnimatePresence initial={false} mode="wait">
                      {!isNavContextActive && (
                        <motion.button
                          key="normal-button-content" // Stable key for this state
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          onMouseDown={() =>
                            handleL2PressStart(l2ContextNode.id)
                          }
                          onMouseUp={() =>
                            handleL2PressEnd(l2ContextNode.id, "release")
                          }
                          onTouchStart={() =>
                            handleL2PressStart(l2ContextNode.id)
                          }
                          onTouchEnd={() =>
                            handleL2PressEnd(l2ContextNode.id, "release")
                          }
                          onClick={(e) => {
                            if (isNavContextActive) {
                              e.preventDefault();
                              return;
                            }
                            // --- CORRECTED onClick LOGIC ---
                            // A normal click on an L2 scroller item ALWAYS toggles its selection
                            // for displaying its children in the L3 swiper.
                            // The type of item (L1 account or L2 account) in the scroller
                            // is determined by selectedTopLevelId, but the click action is consistent.
                            console.log(
                              `Normal Click: Toggling item ${l2ContextNode.id} for L3 display. Current L1 context: ${selectedTopLevelId}`
                            );
                            onToggleLevel2Id(l2ContextNode.id);
                          }}
                          className={`${styles.level2Button} ${
                            // Highlighting is now ALWAYS based on selectedLevel2Ids
                            selectedLevel2Ids.includes(l2ContextNode.id)
                              ? styles.level2ButtonActive
                              : ""
                          }`}
                          title={`${l2ContextNode.code} - ${
                            l2ContextNode.name || "Unnamed"
                          }`}
                        >
                          {l2ContextNode.code || "N/A"}
                        </motion.button>
                      )}

                      {isNavContextActive && (
                        <motion.div
                          key="expanded-options-content" // Stable key for this state
                          className={styles.l2ButtonExpandedWithOptions}
                          initial={{ opacity: 0, scale: 0.9 }} // Start slightly smaller and faded
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2, delay: 0.05 }} // Slight delay for content after wrapper scales
                        >
                          <div className={styles.expandedButtonHeader}>
                            <span>
                              {l2ContextNode.code} -{" "}
                              {l2ContextNode.name || "Unnamed"}
                            </span>
                            <button
                              className={styles.navOptionDismissInside}
                              onClick={closeNavOptions}
                            >
                              ×
                            </button>
                          </div>
                          <div className={styles.navOptionsInside}>
                            <button
                              className={`${styles.navOptionButtonInside} ${styles.navOptionGoUpInside}`}
                              onClick={() => handleGoUp(l2ContextNode.id)}
                            >
                              <span className={styles.navIcon}>▲</span> Go Up
                            </button>
                            {selectedTopLevelId !== rootJournalIdConst && (
                              <button
                                className={`${styles.navOptionButtonInside} ${styles.navOptionGoDownInside}`}
                                onClick={() => handleGoDown(l2ContextNode.id)}
                              >
                                <span className={styles.navIcon}>▼</span> Go
                                Down
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
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

      <h2
        className={styles.sliderTitle}
        style={{ marginTop: "var(--spacing-unit)" }}
      >
        {selectedTopLevelId === rootJournalIdConst
          ? selectedLevel2Ids.length > 0
            ? `Children of: ${selectedLevel2Ids
                .map(
                  (id) => findNodeById(level2NodesForScroller, id)?.code || id
                )
                .join(", ")}`
            : "Select Top-Level Account(s) Above"
          : selectedLevel2Ids.length > 0
          ? `Level 3 Accounts (from L2: ${selectedLevel2Ids
              .map((id) => findNodeById(level2NodesForScroller, id)?.code || id)
              .join(", ")})`
          : "Select L2 Account(s) Above"}
      </h2>

      {level3NodesForMainSwiper.length > 0 ? (
        <Swiper
          key={mainL3SwiperKey}
          onSwiper={(swiper) => {
            mainSwiperInstanceRef.current = swiper;
          }}
          modules={[Navigation, Pagination]}
          initialSlide={initialL3SwiperIndex}
          loop={false}
          spaceBetween={20}
          slidesPerView={1}
          navigation={level3NodesForMainSwiper.length > 1}
          pagination={
            level3NodesForMainSwiper.length > 1 ? { clickable: true } : false
          }
          onSlideChangeTransitionEnd={handleMainL3SwiperChange}
          observer={true}
          observeParents={true}
          className={`${styles.swiperInstance} ${styles.journalL3SwiperInstance}`}
        >
          {level3NodesForMainSwiper.map((l3Node) => {
            if (!l3Node || typeof l3Node.id !== "string" || l3Node.id === "") {
              console.warn("Skipping L3 slide for invalid node:", l3Node);
              return null;
            }
            const sourceForL2Parents =
              selectedTopLevelId === rootJournalIdConst
                ? hierarchyData
                : currentL1ContextNode?.children;
            const l2ParentOfThisL3 = sourceForL2Parents?.find(
              (l2) =>
                selectedLevel2Ids.includes(l2.id) &&
                l2.children?.some((l3) => l3.id === l3Node.id)
            );
            return (
              <SwiperSlide key={l3Node.id} className={styles.slide}>
                <div className={styles.slideTextContent}>
                  <span className={styles.slideName}>
                    {l3Node.name || l3Node.id || "Unnamed L3 Account"}
                  </span>
                  <span className={styles.slideSubText}>
                    {l3Node.code || "N/A"}
                  </span>
                  {l2ParentOfThisL3 && (
                    <span className={styles.slideSubTextDetail}>
                      (Child of L2: {l2ParentOfThisL3.code})
                    </span>
                  )}
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      ) : (
        <div className={styles.noData}>
          {selectedLevel2Ids.length > 0
            ? "No Level 3 accounts for currently selected Level 2s."
            : selectedTopLevelId === rootJournalIdConst
            ? "Select Top-Level account(s) above to see children."
            : "Select Level 2 account(s) above to see children."}
        </div>
      )}

      {currentL3ItemForAccordion && onToggleAccordion && (
        <div className={styles.accordionContainer}>
          <button
            onClick={onToggleAccordion}
            className={styles.detailsButton}
            aria-expanded={isAccordionOpen}
          >
            Details ({currentL3ItemForAccordion.name || "N/A"})
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
                key={`details-accordion-${currentL3ItemForAccordion.id}`}
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
                  <p>
                    <strong>Name:</strong>{" "}
                    {currentL3ItemForAccordion.name || "N/A"}
                  </p>
                  <p>
                    <strong>Code:</strong>{" "}
                    {currentL3ItemForAccordion.code || "N/A"}
                  </p>
                  <p>
                    <strong>ID:</strong> {currentL3ItemForAccordion.id}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
  console.log(
    `DynamicSlider Render (${sliderId}): ActiveItemID Prop: ${activeItemId}, Initial Index Calc: ${initialSlideIndex}, Data length: ${data.length}`
  );

  const handleSwiperChange = (swiper) => {
    const currentRealIndex = swiper.activeIndex;
    if (data && data.length > currentRealIndex && data[currentRealIndex]) {
      console.log(
        `DynamicSlider (${sliderId}): Swipe Change. Index: ${currentRealIndex}, New ID: ${data[currentRealIndex].id}`
      );
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

  return (
    <>
      <div
        className={`${styles.accountNodeRow} ${
          isSelected ? styles.accountNodeSelected : ""
        }`}
        style={{ paddingLeft: `${level * 20}px` }} // Reduced indent slightly
        onClick={handleRowSingleClick} // Changed
        onDoubleClick={handleRowDoubleClick} // NEW
        role="treeitem" // More appropriate ARIA role
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isOpen : undefined}
        // onKeyDown might need update if Enter/Space no longer toggle but select/double-click
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
              style={{
                overflow: "hidden",
                paddingLeft: `${level * 25 + 20}px`, // Adjusted to align with line if used
                position: "relative",
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
        <h2>Select or Manage Journal Account</h2> {/* Updated Title */}
        {/* REMOVED: modalTopActions div and its button */}
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
  const [activeMainSwiperL3Id, setActiveMainSwiperL3Id] = useState(null);

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

  // Home.js

  useEffect(() => {
    const topNode =
      selectedTopLevelJournalId === ROOT_JOURNAL_ID
        ? { children: activeDataSet?.account_hierarchy || [] } // Treat L1s as children of Root for this logic
        : findNodeById(
            activeDataSet?.account_hierarchy,
            selectedTopLevelJournalId
          );

    let currentL3IsValid = false;
    if (activeMainSwiperL3Id && topNode) {
      // Check if activeMainSwiperL3Id is a child of any of the currently selectedLevel2JournalIds
      for (const l2Id of selectedLevel2JournalIds) {
        const l2Node = findNodeById(topNode.children, l2Id);
        if (
          l2Node &&
          l2Node.children?.some((l3) => l3.id === activeMainSwiperL3Id)
        ) {
          currentL3IsValid = true;
          break;
        }
      }
    }

    // If current active L3 is no longer valid (e.g., its L2 parent was deselected)
    // OR if no L3 is active and there are L2s selected, then pick a default L3.
    if (!currentL3IsValid) {
      const { firstActiveL3Id: newDefaultL3Id } = getInitialL2L3Selection(
        selectedTopLevelJournalId,
        selectedLevel2JournalIds,
        activeDataSet
      );
      // Only set if different to avoid loop, and only if a new default actually exists or needs to be nulled
      if (activeMainSwiperL3Id !== newDefaultL3Id) {
        console.log(
          `Home useEffect (L3 default setter): Current L3 invalid or unset. New default L3: ${newDefaultL3Id}. Old active L3: ${activeMainSwiperL3Id}`
        );
        setActiveMainSwiperL3Id(newDefaultL3Id);
      }
    }
    // This effect runs when L1 or L2 selections change, or if dataset changes.
    // It also includes activeMainSwiperL3Id to re-validate it if it changes externally (less common).
  }, [
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    activeDataSet,
    activeMainSwiperL3Id, // Re-validate if it changes
    getInitialL2L3Selection, // getInitialL2L3Selection is stable due to useCallback
    ROOT_JOURNAL_ID,
  ]);

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

  useEffect(() => {
    // Placeholder for actual filtering logic based on selected journal items.
    // This will need to consider selectedTopLevelJournalId, selectedLevel2JournalIds, activeMainSwiperL3Id
    // and the sliderOrder to determine which selected IDs from higher sliders filter current slider.
    console.log(
      "Filtering effect triggered. Selected L1:",
      selectedTopLevelJournalId,
      "L2s:",
      selectedLevel2JournalIds,
      "Active L3:",
      activeMainSwiperL3Id
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
    activeMainSwiperL3Id,
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

    const newInitialTopLevelId = "cat-4";
    setSelectedTopLevelJournalId(ROOT_JOURNAL_ID); // Reset to root view
    setSelectedLevel2JournalIds([]);
    // activeMainSwiperL3Id will be updated by its useEffect

    setSelectedPartnerId(getFirstId(newDataSet?.partners));
    setSelectedGoodsId(getFirstId(newDataSet?.goods));
    // ... reset other states ...
  };

  const openJournalModal = useCallback(() => setIsJournalModalOpen(true), []);
  const closeJournalModal = useCallback(() => setIsJournalModalOpen(false), []);

  // This function is called when an item is selected in the JournalModal (for hierarchy navigation)
  // OR when "Select Category" is clicked in the "parents-like" view of JournalHierarchySlider.
  // It sets the new "parent" for the L2 scroller.
  const handleSelectTopLevelJournal = useCallback(
    (newTopLevelId, childToSelectInL2 = null) => {
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

      setSelectedTopLevelJournalId(newTopLevelId);

      if (childToSelectInL2) {
        // Ensure childToSelectInL2 is a valid child of newTopLevelId (or newTopLevelId is ROOT and childToSelectInL2 is an L1)
        let l2SourceNodes;
        if (newTopLevelId === ROOT_JOURNAL_ID) {
          l2SourceNodes = activeDataSet?.account_hierarchy || [];
        } else {
          const topNode = findNodeById(
            activeDataSet?.account_hierarchy,
            newTopLevelId
          );
          l2SourceNodes = topNode?.children || [];
        }
        if (l2SourceNodes.some((node) => node.id === childToSelectInL2)) {
          setSelectedLevel2JournalIds([childToSelectInL2]);
        } else {
          setSelectedLevel2JournalIds([]); // Clear if childToSelectInL2 is not valid for new context
        }
      } else {
        setSelectedLevel2JournalIds([]); // Always reset L2 selections if no specific child is to be selected
      }
      // activeMainSwiperL3Id will be updated by its useEffect based on new L1/L2
      console.log(
        `New Top Level context set to: ${newTopLevelId}. Child to select in L2: ${childToSelectInL2}`
      );
    },
    [activeDataSet, ROOT_JOURNAL_ID]
  ); // Dependencies

  const handleToggleLevel2JournalId = useCallback(
    (level2IdToToggle) => {
      // Validate level2IdToToggle based on current selectedTopLevelJournalId
      let l2SourceNodes;
      if (selectedTopLevelJournalId === ROOT_JOURNAL_ID) {
        l2SourceNodes = activeDataSet?.account_hierarchy || [];
      } else {
        const topNode = findNodeById(
          activeDataSet?.account_hierarchy,
          selectedTopLevelJournalId
        );
        l2SourceNodes = topNode?.children || [];
      }
      if (!l2SourceNodes.some((node) => node.id === level2IdToToggle)) {
        console.warn(
          `Attempted to toggle invalid L2 ID "${level2IdToToggle}" for current L1 context "${selectedTopLevelJournalId}"`
        );
        return;
      }

      setSelectedLevel2JournalIds((prevSelectedL2Ids) => {
        const newSelectedL2Ids = prevSelectedL2Ids.includes(level2IdToToggle)
          ? prevSelectedL2Ids.filter((id) => id !== level2IdToToggle)
          : [...prevSelectedL2Ids, level2IdToToggle];
        // activeMainSwiperL3Id will be updated by its useEffect
        return newSelectedL2Ids;
      });
    },
    [activeDataSet, selectedTopLevelJournalId]
  ); // ROOT_JOURNAL_ID is constant

  const handleSelectMainSwiperL3Id = useCallback((l3Id) => {
    setActiveMainSwiperL3Id(l3Id);
  }, []);

  const handleSwipe = useCallback((sourceSliderId, selectedItemId) => {
    if (sourceSliderId === SLIDER_TYPES.PARTNER)
      setSelectedPartnerId(selectedItemId);
    else if (sourceSliderId === SLIDER_TYPES.GOODS)
      setSelectedGoodsId(selectedItemId);
    // ...
  }, []);

  const handleNavigateContextDown = useCallback(
    ({ currentL1ToBecomeL2, longPressedL2ToBecomeL3 }) => {
      console.log(
        `Navigating Context Down: currentL1ToBecomeL2=${currentL1ToBecomeL2}, longPressedL2ToBecomeL3=${longPressedL2ToBecomeL3}`
      );

      // 1. Find the parent of currentL1ToBecomeL2. This is the new L1 context.
      let newL1ContextId;
      const parentOfCurrentL1 = findParentOfNode(
        currentL1ToBecomeL2,
        activeDataSet.account_hierarchy
      );

      if (parentOfCurrentL1) {
        newL1ContextId = parentOfCurrentL1.id;
      } else {
        // If currentL1ToBecomeL2 was a top-level account, its parent context is Root
        newL1ContextId = ROOT_JOURNAL_ID;
      }

      // 2. Set the new L1 context
      setSelectedTopLevelJournalId(newL1ContextId);

      // 3. The currentL1ToBecomeL2 should now be selected in the L2 scroller
      //    (This assumes currentL1ToBecomeL2 is a valid child of newL1ContextId, which it should be)
      setSelectedLevel2JournalIds([currentL1ToBecomeL2]);

      // 4. The longPressedL2ToBecomeL3 should be the active item in the L3 swiper
      //    (This assumes longPressedL2ToBecomeL3 is a valid child of currentL1ToBecomeL2)
      setActiveMainSwiperL3Id(longPressedL2ToBecomeL3);
    },
    [activeDataSet, ROOT_JOURNAL_ID]
  ); // findParentOfNode, setSelected..., setActive... are stable

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
      // let newActiveL3Id = activeMainSwiperL3Id; // This will be derived

      const currentHierarchy = activeDataSet.account_hierarchy; // This is stale if called immediately!
      // Better to work with the hierarchyCopy conceptually.
      // For safety, pass hierarchyCopy to findNodeById if needed here.

      const idStillExists = (id, hierarchy) => !!findNodeById(hierarchy, id);

      // If selected L1 was deleted or no longer exists
      if (
        accountIdToDelete === newTopLevelId ||
        !idStillExists(newTopLevelId, currentHierarchy)
      ) {
        // use currentHierarchy (stale) or derive from context
        newTopLevelId = getFirstId(currentHierarchy) || null; // This should be hierarchyCopy
        newL2Ids = [];
        newMode = newTopLevelId ? "children" : "parents";
      }

      // Filter out deleted L2 IDs or L2 IDs whose L1 parent might have changed/deleted
      const currentTopNodeAfterDelete = findNodeById(
        currentHierarchy,
        newTopLevelId
      ); // stale hierarchy
      newL2Ids = newL2Ids.filter(
        (id) =>
          id !== accountIdToDelete &&
          idStillExists(id, currentHierarchy) && // stale hierarchy
          currentTopNodeAfterDelete?.children?.some((c) => c.id === id)
      );

      // The useEffect for activeMainSwiperL3Id will handle its update.
      // So, we just need to set L1 and L2s.
      setSelectedTopLevelJournalId(newTopLevelId);
      setSelectedLevel2JournalIds(newL2Ids);
    },
    [
      selectedTopLevelJournalId,
      selectedLevel2JournalIds,
      activeMainSwiperL3Id,
      activeDataSet,
    ]
  ); // activeDataSet is a dep

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
          activeMainSwiperL3Id: activeMainSwiperL3Id,

          onSelectTopLevel: handleSelectTopLevelJournal, // Used by "Select Category" button if JHS implements it
          onToggleLevel2Id: handleToggleLevel2JournalId,
          onSelectMainSwiperL3Id: handleSelectMainSwiperL3Id,
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
                name: "All Accounts (Root)",
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
