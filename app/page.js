"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

const findParentOfNode = (nodeId, hierarchy, parent = null) => {
  if (!hierarchy || !nodeId) return null;
  for (const node of hierarchy) {
    if (node.id === nodeId) {
      return parent;
    }
    if (node.children && node.children.length > 0) {
      const foundParentInChild = findParentOfNode(nodeId, node.children, node);
      if (foundParentInChild !== null) {
        // Check if an object was returned, not just any non-null value
        // This specific check (`if (foundParentInChild !== null && findNodeById([foundParentInChild], foundParentInChild.id))`) is a bit redundant.
        // If findParentOfNode returns non-null, it means the parent was found or null was propagated.
        // A direct return of `foundParentInChild` is usually what's needed if it's not null.
        // Let's simplify this part of the original helper as it seemed a bit convoluted.
        // The core idea is: if a parent is found in a deeper call, return that.
        if (foundParentInChild) return foundParentInChild; // Propagate up if a valid parent object is found
      }
    }
  }
  return null;
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
  selectedLevel3Ids,
  onSelectTopLevel,
  onToggleLevel2Id,
  onToggleLevel3Id,
  onL3DoubleClick,
  rootJournalIdConst,
  onNavigateContextDown,
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
        className={styles.journalParentHeader}
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
                  <div className={styles.l2ButtonInteractiveWrapper}>
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
                  <div className={styles.l2ButtonInteractiveWrapper}>
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

function DynamicSlider({
  sliderId,
  title,
  data = [],
  onSlideChange,
  activeItemId,
  isAccordionOpen,
  onToggleAccordion,
  // New Props
  isLocked = false,
  isDocumentCreationMode = false,
  selectedGoodsForDoc = [],
  onToggleGoodForDoc,
  onUpdateGoodDetailForDoc,
}) {
  const initialSlideIndex = Math.max(
    0,
    data.findIndex((item) => item?.id === activeItemId)
  );

  const handleSwiperChange = (swiper) => {
    if (isLocked) return; // Prevent slide change if locked

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

  const swiperKey = `${sliderId}-len${data.length}-active${activeItemId}-locked${isLocked}`;

  const currentGoodInDocument =
    isDocumentCreationMode && sliderId === SLIDER_TYPES.GOODS && activeItemId
      ? selectedGoodsForDoc.find((g) => g.id === activeItemId)
      : null;

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
          navigation={data.length > 1 && !isLocked}
          pagination={
            data.length > 1 && !isLocked ? { clickable: true } : false
          }
          onSlideChangeTransitionEnd={handleSwiperChange}
          observer={true}
          observeParents={true}
          className={`${styles.swiperInstance} ${
            isLocked ? styles.swiperLocked : ""
          }`}
          allowTouchMove={!isLocked}
        >
          {data.map((item) => {
            if (!item) return null;
            const IconComponent =
              sliderId === SLIDER_TYPES.JOURNAL && JOURNAL_ICONS[item.id]
                ? JOURNAL_ICONS[item.id]
                : null;

            const isSelectedForDocument =
              isDocumentCreationMode &&
              sliderId === SLIDER_TYPES.GOODS &&
              selectedGoodsForDoc.some((g) => g.id === item.id);

            return (
              <SwiperSlide
                key={item.id}
                className={`${styles.slide} ${
                  isSelectedForDocument ? styles.slideSelectedForDocument : ""
                }`}
              >
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
                  {sliderId === SLIDER_TYPES.GOODS &&
                    item.unit_code && ( // In original data.json, goods have 'unit', not 'unit_code'
                      <span className={styles.slideSubText}>
                        {item.unit_code || item.unit} {/* Fallback to unit */}
                      </span>
                    )}
                </div>
                {isSelectedForDocument && (
                  <div className={styles.selectedGoodIndicator}>
                    ✓ In Document
                  </div>
                )}
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
            {isDocumentCreationMode &&
              sliderId === SLIDER_TYPES.GOODS &&
              currentGoodInDocument &&
              " (Editing for Doc)"}
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
                key={`details-accordion-${currentItemForAccordion.id}`}
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

                  {isDocumentCreationMode &&
                    sliderId === SLIDER_TYPES.GOODS && (
                      <div className={styles.documentGoodDetails}>
                        <h4>
                          Document Specifics for {currentItemForAccordion.name}:
                        </h4>
                        <button
                          onClick={() =>
                            onToggleGoodForDoc(currentItemForAccordion)
                          }
                          className={`${styles.modalActionButton} ${
                            currentGoodInDocument
                              ? styles.removeButton
                              : styles.addButton
                          }`}
                        >
                          {currentGoodInDocument ? (
                            <IoTrashBinOutline />
                          ) : (
                            <IoAddCircleOutline />
                          )}
                          {currentGoodInDocument
                            ? "Remove from Document"
                            : "Add to Document"}
                        </button>

                        {currentGoodInDocument && (
                          <>
                            <div className={styles.formGroup}>
                              <label
                                htmlFor={`qty-${currentItemForAccordion.id}`}
                              >
                                Quantity:
                              </label>
                              <input
                                type="number"
                                id={`qty-${currentItemForAccordion.id}`}
                                value={currentGoodInDocument.quantity ?? ""} // Use nullish coalescing for default empty string
                                onChange={(e) =>
                                  onUpdateGoodDetailForDoc(
                                    currentItemForAccordion.id,
                                    "quantity",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                min="0"
                                className={styles.formInputSmall} // Optional: style for smaller inputs
                              />
                            </div>
                            <div className={styles.formGroup}>
                              <label
                                htmlFor={`price-${currentItemForAccordion.id}`}
                              >
                                Price per unit:
                              </label>
                              <input
                                type="number"
                                id={`price-${currentItemForAccordion.id}`}
                                value={currentGoodInDocument.price ?? ""}
                                onChange={(e) =>
                                  onUpdateGoodDetailForDoc(
                                    currentItemForAccordion.id,
                                    "price",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                min="0"
                                step="0.01"
                                className={styles.formInputSmall}
                              />
                            </div>
                            <div className={styles.formGroup}>
                              <label
                                htmlFor={`amount-${currentItemForAccordion.id}`}
                              >
                                Total Amount:
                              </label>
                              <input
                                type="number"
                                id={`amount-${currentItemForAccordion.id}`}
                                value={currentGoodInDocument.amount ?? ""}
                                readOnly
                                disabled
                                className={styles.formInputSmall}
                              />
                            </div>
                          </>
                        )}
                      </div>
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

function AccountNode({
  node,
  level = 0,
  openNodes,
  toggleNode,
  selectedAccountId,
  onSelectNode,
  onDoubleClickNode,
  onTriggerAddChildToNode,
  onDeleteNode,
  conceptualRootId,
}) {
  const isOpen =
    openNodes[node.id] ?? (level === 0 && node.id === conceptualRootId);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedAccountId;
  const isConceptualRootNode = node.id === conceptualRootId;
  const isActualL1Account = level === 1 && !isConceptualRootNode;

  const handleRowSingleClick = (e) => {
    if (e.target.closest(`.${styles.accountNodeToggle}`)) {
      e.stopPropagation();
      return;
    }
    onSelectNode(node.id);
  };

  const handleRowDoubleClick = () => {
    if (onDoubleClickNode) {
      onDoubleClickNode(node.id, isConceptualRootNode, isActualL1Account);
    }
  };

  const handleToggleIconClick = (e) => {
    e.stopPropagation();
    if (hasChildren) {
      toggleNode(node.id);
    }
  };

  const handleAddChildClick = (e) => {
    e.stopPropagation();
    if (onTriggerAddChildToNode) {
      onTriggerAddChildToNode(node.id, node.code);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (isConceptualRootNode) return;
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
  const indentSize = 15;

  return (
    <>
      <div
        className={`${styles.accountNodeRow} ${
          isSelected ? styles.accountNodeSelected : ""
        }`}
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
          onClick={handleToggleIconClick}
          role="button"
          tabIndex={-1}
          aria-hidden="true"
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
          {isSelected && onTriggerAddChildToNode && (
            <button
              onClick={handleAddChildClick}
              className={`${styles.accountNodeActionButton} ${styles.accountNodeAddChildButton}`}
              title={`Add sub-account to ${node.name}${
                isConceptualRootNode ? " (New Top-Level)" : ""
              }`}
            >
              <IoAddCircleOutline />
            </button>
          )}
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
                  onDoubleClickNode={onDoubleClickNode}
                  onTriggerAddChildToNode={onTriggerAddChildToNode}
                  onDeleteNode={onDeleteNode}
                  conceptualRootId={conceptualRootId}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function JournalModal({
  isOpen,
  onClose,
  onConfirmSelection,
  onSetShowRoot,
  hierarchy = [],
  onDeleteAccount,
  onTriggerAddChild,
}) {
  const [openNodes, setOpenNodes] = useState({});
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const ROOT_MODAL_NODE_ID_INTERNAL = hierarchy[0]?.id;

  useEffect(() => {
    if (!isOpen) {
      setOpenNodes({});
      setSelectedAccountId(null);
    } else {
      if (hierarchy.length > 0 && hierarchy[0]?.isConceptualRoot) {
        setOpenNodes({ [hierarchy[0].id]: true });
        setSelectedAccountId(hierarchy[0].id);
      }
    }
  }, [isOpen, hierarchy]);

  const toggleNode = useCallback((nodeId) => {
    setOpenNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }, []);

  const handleSelectNode = useCallback((nodeId) => {
    setSelectedAccountId(nodeId);
    console.log(
      "JournalModal: Single Click - Selected Account Node ID:",
      nodeId
    );
  }, []);

  const handleDoubleClickNode = useCallback(
    (nodeId, nodeIsConceptualRoot, nodeIsActualL1) => {
      console.log("JournalModal: Double Click on Node ID:", nodeId);
      if (nodeIsConceptualRoot) {
        if (onSetShowRoot) {
          onSetShowRoot();
        }
        onClose();
      } else if (nodeIsActualL1) {
        if (onConfirmSelection) {
          onConfirmSelection(nodeId);
        }
        onClose();
      }
    },
    [onSetShowRoot, onConfirmSelection, onClose]
  );

  if (!isOpen) return null;

  return (
    <motion.div
      className={styles.modalOverlay}
      onClick={onClose}
      key="journal-modal-overlay"
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
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        key="journal-modal-content"
        initial={{ opacity: 0, scale: 0.9, y: "5%" }}
        animate={{ opacity: 1, scale: 1, y: "0%" }}
        exit={{ opacity: 0, scale: 0.9, y: "5%" }}
        transition={{ duration: 0.25, ease: "circOut" }}
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
            hierarchy.map((conceptualRootNode) => (
              <AccountNode
                key={conceptualRootNode.id}
                node={conceptualRootNode}
                level={0}
                openNodes={openNodes}
                toggleNode={toggleNode}
                selectedAccountId={selectedAccountId}
                onSelectNode={handleSelectNode}
                onDoubleClickNode={handleDoubleClickNode}
                onTriggerAddChildToNode={onTriggerAddChild}
                onDeleteNode={onDeleteAccount}
                conceptualRootId={ROOT_MODAL_NODE_ID_INTERNAL}
              />
            ))
          ) : (
            <p>No accounts to display.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

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
      codeSeparator = ""; // No separator for L2 in pattern "101"
      codePatternHint = `Enter 2 digits (e.g., "01" for code ${context.parentCode}01)`;
    } else {
      // L3 and deeper
      currentLevel = (context.parentCode.match(/-/g) || []).length + 2; // A bit more dynamic level detection
      codePrefixForDisplay = context.parentCode;
      codeSeparator = "-";
      codePatternHint = `Enter 1 or 2 digits (e.g., "1" or "01" for code ${context.parentCode}-01)`;
    }
  } else {
    // Adding L1
    currentLevel = 1;
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
    } else if (currentLevel === 2 && !context.parentCode.includes("-")) {
      // For "101" style L2
      if (!/^\d{2}$/.test(trimmedSuffix)) {
        setError(
          `Level 2 code suffix (after "${codePrefixForDisplay}") must be exactly two digits. e.g., "01"`
        );
        return;
      }
      finalCodeForNewAccount = codePrefixForDisplay + trimmedSuffix;
    } else {
      // For L3+ "X-X-XX" style or L2 if L1 was like "A-1" (not current case)
      if (!/^\d{1,2}$/.test(trimmedSuffix)) {
        setError(
          `Code suffix (after "${codePrefixForDisplay}${codeSeparator}") must be one or two digits. e.g., "1" or "01"`
        );
        return;
      }
      finalCodeForNewAccount =
        codePrefixForDisplay + codeSeparator + trimmedSuffix;
    }

    const newAccountId = finalCodeForNewAccount; // Using final code as ID for simplicity here
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
      style={{ zIndex: 1001 }}
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
              id="newJournalCodeSuffix"
              value={newCodeSuffix}
              onChange={(e) => setNewCodeSuffix(e.target.value)}
              placeholder={codePatternHint}
              required
              aria-describedby={error ? "formErrorText" : undefined}
            />
            {currentLevel > 1 && (
              <small className={styles.inputHint}>
                Full Code Preview: {codePrefixForDisplay}
                {codeSeparator}
                {newCodeSuffix ||
                  (currentLevel === 2 && !context.parentCode.includes("-")
                    ? "XX"
                    : "X")}
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

function DocumentConfirmationModal({
  isOpen,
  onClose,
  onValidate,
  partner,
  goods,
}) {
  if (!isOpen) return null;

  const partnerNode = partner; // Assuming partner is already the full node

  return (
    <motion.div
      className={styles.modalOverlay}
      key="doc-confirm-modal-overlay"
      initial="closed"
      animate="open"
      exit="closed"
      variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
      transition={{ duration: 0.2 }}
      style={{ zIndex: 1002 }} // Ensure on top of other modals if any overlap
    >
      <motion.div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        key="doc-confirm-modal-content"
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
        <h2>Document Confirmation</h2>

        {partnerNode && (
          <div className={styles.confirmationSection}>
            <h3>Partner:</h3>
            <p>
              <strong>Name:</strong> {partnerNode.name}
            </p>
            <p>
              <strong>ID:</strong> {partnerNode.id}
            </p>
            {partnerNode.location && (
              <p>
                <strong>Location:</strong> {partnerNode.location}
              </p>
            )}
          </div>
        )}

        {goods && goods.length > 0 && (
          <div className={styles.confirmationSection}>
            <h3>Selected Goods:</h3>
            <ul className={styles.confirmationGoodsList}>
              {goods.map((good) => (
                <li key={good.id}>
                  <strong>
                    {good.name} ({good.code || good.id})
                  </strong>{" "}
                  {/* Fallback for code */}
                  <p>
                    Qty: {good.quantity}, Price: ${good.price?.toFixed(2)},
                    Amount: ${good.amount?.toFixed(2)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.modalActions}>
          <button
            type="button"
            className={`${styles.modalButtonSecondary} ${styles.modalActionButton}`}
            onClick={onClose}
          >
            Back to Edit
          </button>
          <button
            type="button"
            onClick={onValidate}
            className={`${styles.modalButtonPrimary} ${styles.modalActionButton}`}
          >
            Validate Document
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Main Page Component ---
export default function Home() {
  const [sliderOrder, setSliderOrder] = useState(INITIAL_ORDER);
  const [activeDataSource, setActiveDataSource] = useState("data1");
  const [activeDataSet, setActiveDataSet] = useState(initialData1);

  const initialTopLevelId = ROOT_JOURNAL_ID;

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

  const ROOT_JOURNAL_ID_FOR_MODAL = "__MODAL_ROOT_NODE__";

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

  // NEW State Variables for Document Creation
  const [isDocumentCreationMode, setIsDocumentCreationMode] = useState(false);
  const [lockedPartnerId, setLockedPartnerId] = useState(null);
  const [selectedGoodsForDocument, setSelectedGoodsForDocument] = useState([]);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);

  const isTerminalJournalActive = useMemo(() => {
    if (
      selectedTopLevelJournalId === ROOT_JOURNAL_ID ||
      !activeDataSet?.account_hierarchy
    ) {
      return false;
    }
    const l1Node = findNodeById(
      activeDataSet.account_hierarchy,
      selectedTopLevelJournalId
    );
    if (!l1Node) return false;

    const l2Children = l1Node.children || [];
    return l2Children.length === 0;
  }, [selectedTopLevelJournalId, activeDataSet, ROOT_JOURNAL_ID]);

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
    selectedLevel3JournalIds,
    "DocMode:",
    isDocumentCreationMode,
    "LockedPartner:",
    lockedPartnerId
  );

  useEffect(() => {
    console.log(
      "Filtering effect triggered. Selected L1:",
      selectedTopLevelJournalId,
      "L2s:",
      selectedLevel2JournalIds,
      "Selected L3s:",
      selectedLevel3JournalIds
    );

    let finalFilteredPartners = activeDataSet?.partners || [];
    let finalFilteredGoods = activeDataSet?.goods || [];

    if (
      JSON.stringify(displayedPartners) !==
      JSON.stringify(finalFilteredPartners)
    )
      setDisplayedPartners(finalFilteredPartners);
    if (JSON.stringify(displayedGoods) !== JSON.stringify(finalFilteredGoods))
      setDisplayedGoods(finalFilteredGoods);

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
  ]);

  const handleDataSourceChange = (event) => {
    const newSourceKey = event.target.value;
    if (newSourceKey === activeDataSource) return;
    const newDataSet = newSourceKey === "data1" ? initialData1 : initialData2;

    setActiveDataSource(newSourceKey);
    setActiveDataSet(newDataSet);

    setSelectedTopLevelJournalId(ROOT_JOURNAL_ID);
    setSelectedLevel2JournalIds([]);
    setSelectedLevel3JournalIds([]);

    setSelectedPartnerId(getFirstId(newDataSet?.partners));
    setSelectedGoodsId(getFirstId(newDataSet?.goods));

    // Reset document creation mode if data source changes
    setIsDocumentCreationMode(false);
    setLockedPartnerId(null);
    setSelectedGoodsForDocument([]);
    setIsConfirmationModalOpen(false);
  };

  const openJournalModal = useCallback(() => setIsJournalModalOpen(true), []);
  const closeJournalModal = useCallback(() => setIsJournalModalOpen(false), []);

  const handleSelectTopLevelJournal = useCallback(
    (newTopLevelId, childToSelectInL2 = null) => {
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
      setSelectedLevel3JournalIds([]);
    },
    [activeDataSet, ROOT_JOURNAL_ID]
  );

  const handleNavigateContextDown = useCallback(
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
      setSelectedLevel2JournalIds([currentL1ToBecomeL2]);
      setSelectedLevel3JournalIds([]);
    },
    [
      activeDataSet,
      ROOT_JOURNAL_ID,
      setSelectedTopLevelJournalId,
      setSelectedLevel2JournalIds,
      setSelectedLevel3JournalIds,
    ]
  );

  const handleToggleLevel2JournalId = useCallback(
    (level2IdToToggle) => {
      let l2SourceNodes;
      let currentL1Node;

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

      const newSelectedL2Ids = selectedLevel2JournalIds.includes(
        level2IdToToggle
      )
        ? selectedLevel2JournalIds.filter((id) => id !== level2IdToToggle)
        : [...selectedLevel2JournalIds, level2IdToToggle];

      setSelectedLevel2JournalIds(newSelectedL2Ids);

      setSelectedLevel3JournalIds((prevSelectedL3Ids) => {
        if (newSelectedL2Ids.length === 0) return [];
        const validL3s = [];
        for (const l3Id of prevSelectedL3Ids) {
          let l3StillValid = false;
          for (const newL2Id of newSelectedL2Ids) {
            const newL2Node = findNodeById(currentL1Node?.children, newL2Id);
            if (
              newL2Node &&
              newL2Node.children?.some((l3Child) => l3Child.id === l3Id)
            ) {
              l3StillValid = true;
              break;
            }
          }
          if (l3StillValid) validL3s.push(l3Id);
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
    ]
  );

  const handleToggleLevel3JournalId = useCallback(
    (level3IdToToggle) => {
      console.log("handleToggleLevel3JournalId CALLED for:", level3IdToToggle);
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
        let actualL1ParentOfL3 = null;
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
            `Error in L3 Up (L1=Root): Could not find actual L1 parent for L3 item ${l3ItemId}.`
          );
          return;
        }
        const newL1Id = actualL1ParentOfL3.id;
        const newL2toSelect = l3ItemId;
        console.log(
          `  L3 Up (L1=Root): New L1: ${newL1Id}, L2 to select: ${newL2toSelect}`
        );
        setSelectedTopLevelJournalId(newL1Id);
        setSelectedLevel2JournalIds([newL2toSelect]);
        setSelectedLevel3JournalIds([]);
      } else {
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
        const newL1Id = l2ParentOfClickedL3.id;
        const newL2toSelect = l3ItemId;
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
          "L3 Down (L1=Root) - Fallback: Make L2 parent of L3 the new L1."
        );
        let actualL2ParentOfL3 = null;
        for (const l1Node of activeDataSet.account_hierarchy) {
          if (selectedLevel2JournalIds.includes(l1Node.id)) {
            // This L1Node is an actual L1, acting as L2 in Root view
            if (l1Node.children) {
              for (const l2Node of l1Node.children) {
                // This l2Node is an actual L2, acting as L3 in Root view
                // The l3ItemId IS this l2Node, or a child of it if the hierarchy is deeper in data.
                // For current spec (L1=Root, L2 Scroller = actual L1s, L3 Scroller = actual L2s)
                // l3ItemId IS an actual L2. Its L1 parent should become the new L1.
                // This path is wrong. We need the L1 parent of l3ItemId (which is an actual L2).
                // The logic is becoming: Make the *parent* of the double-clicked L3 item (which is an L2) the new L1.
                // This makes l3ItemId (the actual L2) the selected L2.
                // THIS IS THE SAME AS "GO UP" for an unselected L2 when L1 is Root.
                const l1ParentOfL3Item = findParentOfNode(
                  l3ItemId,
                  activeDataSet.account_hierarchy
                );
                if (
                  l1ParentOfL3Item &&
                  l1ParentOfL3Item.id !== ROOT_JOURNAL_ID
                ) {
                  actualL2ParentOfL3 = l1ParentOfL3Item; // This is actually the new L1
                  break;
                }
              }
            }
          }
          if (actualL2ParentOfL3) break;
        }

        if (actualL2ParentOfL3) {
          console.log(
            `  L3 Down (L1=Root, L3 unselected): Making L1 parent ${actualL2ParentOfL3.id} of L3 ${l3ItemId} the new L1.`
          );
          setSelectedTopLevelJournalId(actualL2ParentOfL3.id);
          setSelectedLevel2JournalIds([l3ItemId]);
          setSelectedLevel3JournalIds([]);
        } else {
          console.error(
            `L3 Down (L1=Root, L3 unselected): Could not find L1 parent for L3 item ${l3ItemId}.`
          );
        }
        return;
      }

      const parentOfCurrentL1 = findParentOfNode(
        selectedTopLevelJournalId,
        activeDataSet.account_hierarchy
      );
      const newL1ContextId = parentOfCurrentL1
        ? parentOfCurrentL1.id
        : ROOT_JOURNAL_ID;
      const oldL1ToBecomeSelectedL2 = selectedTopLevelJournalId;

      let originalL2ParentOfDClickedL3 = null;
      const currentL1Node = findNodeById(
        activeDataSet.account_hierarchy,
        selectedTopLevelJournalId
      );
      if (currentL1Node && currentL1Node.children) {
        for (const originalL2Node of currentL1Node.children) {
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
        setSelectedTopLevelJournalId(newL1ContextId);
        setSelectedLevel2JournalIds([oldL1ToBecomeSelectedL2]);
        setSelectedLevel3JournalIds([]);
        return;
      }
      setSelectedTopLevelJournalId(newL1ContextId);
      setSelectedLevel2JournalIds([oldL1ToBecomeSelectedL2]);
      setSelectedLevel3JournalIds([]);
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
  );

  const handleSwipe = useCallback(
    (sourceSliderId, selectedItemId) => {
      if (
        isDocumentCreationMode &&
        sourceSliderId === SLIDER_TYPES.PARTNER &&
        selectedItemId !== lockedPartnerId
      ) {
        // If in document creation mode, prevent partner change by swiping.
        // Re-set to locked partner ID. This is a bit of a hack. Ideally, Swiper allowTouchMove handles it.
        // But if nav buttons are used, this might be needed.
        setSelectedPartnerId(lockedPartnerId);
        console.warn(
          "Partner swipe attempted during document creation. Reverted."
        );
        return;
      }

      if (sourceSliderId === SLIDER_TYPES.PARTNER)
        setSelectedPartnerId(selectedItemId);
      else if (sourceSliderId === SLIDER_TYPES.GOODS)
        setSelectedGoodsId(selectedItemId);
    },
    [isDocumentCreationMode, lockedPartnerId]
  ); // Added dependencies

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
      const contextParentId = addJournalContext?.parentId;
      const isAddingToRoot = !contextParentId;

      setActiveDataSet((currentDataset) => {
        const originalHierarchy = currentDataset.account_hierarchy || [];
        const proposedNewId = newAccountData.id;
        // Check for ID collision
        if (findNodeById(originalHierarchy, proposedNewId)) {
          alert(
            `Error: Account Code/ID "${proposedNewId}" already exists in the hierarchy.`
          );
          return currentDataset;
        }

        const newHierarchy = JSON.parse(JSON.stringify(originalHierarchy));
        if (isAddingToRoot) {
          newHierarchy.push(newAccountData);
        } else {
          const parentNode = findNodeById(newHierarchy, contextParentId);
          if (!parentNode) {
            alert(
              `Error: Parent node "${contextParentId}" not found for adding child.`
            );
            return currentDataset;
          }
          parentNode.children = parentNode.children || [];
          parentNode.children.push(newAccountData);
        }
        return { ...currentDataset, account_hierarchy: newHierarchy };
      });
      closeAddJournalModal();
    },
    [addJournalContext, closeAddJournalModal] // Removed activeDataSet, selected IDs
  );

  const handleDeleteJournalAccount = useCallback(
    (accountIdToDelete) => {
      let newHierarchyAfterDelete;
      setActiveDataSet((currentDataset) => {
        const hierarchyCopy = JSON.parse(
          JSON.stringify(currentDataset.account_hierarchy || [])
        );
        let nodeWasRemoved = false;
        const removeNodeRecursively = (nodes, idToRemove) => {
          for (let i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].id === idToRemove) {
              nodes.splice(i, 1);
              nodeWasRemoved = true;
              return true;
            }
            if (nodes[i].children && nodes[i].children.length > 0) {
              if (removeNodeRecursively(nodes[i].children, idToRemove)) {
                if (nodes[i].children.length === 0) delete nodes[i].children;
                return true;
              }
            }
          }
          return false;
        };
        removeNodeRecursively(hierarchyCopy, accountIdToDelete);
        if (!nodeWasRemoved) {
          console.warn("Node to delete was not found:", accountIdToDelete);
          newHierarchyAfterDelete = currentDataset.account_hierarchy; // no change
          return currentDataset;
        }
        newHierarchyAfterDelete = hierarchyCopy;
        return { ...currentDataset, account_hierarchy: hierarchyCopy };
      });

      // State updates after deletion, using the newHierarchyAfterDelete
      // This needs to run AFTER setActiveDataSet has effectively completed,
      // or use the hierarchyCopy which is guaranteed to be up-to-date here.
      // We use hierarchyCopy (which became newHierarchyAfterDelete)
      let newTopLevelId = selectedTopLevelJournalId;
      let newL2Ids = [...selectedLevel2JournalIds];
      let newL3Ids = [...selectedLevel3JournalIds];

      const idStillExists = (id, hierarchy) => !!findNodeById(hierarchy, id);

      if (
        accountIdToDelete === newTopLevelId ||
        !idStillExists(newTopLevelId, newHierarchyAfterDelete)
      ) {
        newTopLevelId = getFirstId(newHierarchyAfterDelete) || ROOT_JOURNAL_ID;
        newL2Ids = [];
        newL3Ids = [];
      }

      const currentTopNodeAfterDelete = findNodeById(
        newHierarchyAfterDelete,
        newTopLevelId
      );
      newL2Ids = newL2Ids.filter(
        (id) =>
          id !== accountIdToDelete &&
          idStillExists(id, newHierarchyAfterDelete) &&
          currentTopNodeAfterDelete?.children?.some((c) => c.id === id)
      );

      let validL3SourceNodes = [];
      if (currentTopNodeAfterDelete) {
        newL2Ids.forEach((l2Id) => {
          const l2Node = findNodeById(currentTopNodeAfterDelete.children, l2Id);
          if (l2Node && l2Node.children)
            validL3SourceNodes.push(...l2Node.children);
        });
      }
      newL3Ids = newL3Ids.filter(
        (id) =>
          id !== accountIdToDelete &&
          idStillExists(id, newHierarchyAfterDelete) &&
          validL3SourceNodes.some((c) => c.id === id)
      );

      setSelectedTopLevelJournalId(newTopLevelId);
      setSelectedLevel2JournalIds(newL2Ids);
      setSelectedLevel3JournalIds(newL3Ids);
    },
    [
      selectedTopLevelJournalId,
      selectedLevel2JournalIds,
      selectedLevel3JournalIds,
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
    const config = SLIDER_CONFIG_REF.current[sliderId]; // Use ref here
    if (!sliderId || !config) return;
    setVisibility((prev) => ({ ...prev, [sliderId]: !prev[sliderId] }));
    setTimeout(() => {
      visibilitySwiperRef.current?.update();
    }, 50);
  }, []); // SLIDER_CONFIG_REF is constant-like due to ref

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
  );

  // --- Document Creation Handlers ---
  const handleStartDocumentCreation = useCallback(() => {
    if (!selectedPartnerId) {
      alert("Please select a partner first.");
      return;
    }
    setIsDocumentCreationMode(true);
    setLockedPartnerId(selectedPartnerId);
    setSelectedGoodsForDocument([]);
    setAccordionTypeState((prev) => ({
      ...Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: false }), {}),
      [SLIDER_TYPES.GOODS]: true, // Open Goods accordion
    }));
    console.log("Document creation started for partner:", selectedPartnerId);
  }, [selectedPartnerId]);

  const handleCancelDocumentCreation = useCallback(() => {
    setIsDocumentCreationMode(false);
    setLockedPartnerId(null);
    setSelectedGoodsForDocument([]);
    setIsConfirmationModalOpen(false);
    console.log("Document creation cancelled.");
  }, []);

  const handleToggleGoodForDocument = useCallback((goodItem) => {
    setSelectedGoodsForDocument((prev) => {
      const existingGood = prev.find((g) => g.id === goodItem.id);
      if (existingGood) {
        return prev.filter((g) => g.id !== goodItem.id);
      } else {
        return [
          ...prev,
          {
            id: goodItem.id,
            name: goodItem.name,
            code: goodItem.unit_code || goodItem.unit || goodItem.id, // Adjusted to include item.unit
            quantity: 1,
            price: 0,
            amount: 0,
          },
        ];
      }
    });
  }, []);

  const handleUpdateGoodDetailForDocument = useCallback(
    (goodId, field, value) => {
      setSelectedGoodsForDocument((prev) =>
        prev.map((g) => {
          if (g.id === goodId) {
            const updatedGood = { ...g, [field]: value };
            if (
              (field === "quantity" || field === "price") &&
              typeof updatedGood.quantity === "number" &&
              typeof updatedGood.price === "number"
            ) {
              updatedGood.amount = parseFloat(
                (updatedGood.quantity * updatedGood.price).toFixed(2)
              );
            }
            return updatedGood;
          }
          return g;
        })
      );
    },
    []
  );

  const handleFinishDocument = useCallback(() => {
    if (selectedGoodsForDocument.length === 0) {
      alert("Please select at least one good for the document.");
      return;
    }
    if (!lockedPartnerId) {
      alert("Error: No partner locked for this document.");
      return;
    }
    setIsConfirmationModalOpen(true);
  }, [selectedGoodsForDocument, lockedPartnerId]);

  const handleValidateDocument = useCallback(() => {
    const partnerDetails = findNodeById(
      activeDataSet.partners,
      lockedPartnerId
    );
    console.log("--- DOCUMENT VALIDATED ---");
    console.log("Partner:", partnerDetails);
    console.log("Goods:", selectedGoodsForDocument);
    console.log("--------------------------");

    setIsConfirmationModalOpen(false);
    setIsDocumentCreationMode(false);
    setLockedPartnerId(null);
    setSelectedGoodsForDocument([]);
  }, [lockedPartnerId, selectedGoodsForDocument, activeDataSet]);

  // Use a ref for SLIDER_CONFIG to avoid re-creating it on every render, helps with useCallback deps
  const SLIDER_CONFIG_REF = useRef({
    [SLIDER_TYPES.JOURNAL]: {
      Component: JournalHierarchySlider,
      title: "Journal",
    },
    [SLIDER_TYPES.PARTNER]: { Component: DynamicSlider, title: "Partner" },
    [SLIDER_TYPES.GOODS]: { Component: DynamicSlider, title: "Goods" },
    [SLIDER_TYPES.PROJECT]: { Component: DynamicSlider, title: "Project" },
    [SLIDER_TYPES.DOCUMENT]: { Component: DynamicSlider, title: "Document" },
  });

  const getSliderProps = (sliderId) => {
    switch (sliderId) {
      case SLIDER_TYPES.JOURNAL:
        return {
          hierarchyData: activeDataSet?.account_hierarchy || [],
          selectedTopLevelId: selectedTopLevelJournalId,
          selectedLevel2Ids: selectedLevel2JournalIds,
          selectedLevel3Ids: selectedLevel3JournalIds,
          onSelectTopLevel: handleSelectTopLevelJournal,
          onToggleLevel2Id: handleToggleLevel2JournalId,
          onToggleLevel3Id: handleToggleLevel3JournalId,
          onL3DoubleClick: handleL3DoubleClick,
          onOpenModal: openJournalModal,
          isAccordionOpen: accordionTypeState[SLIDER_TYPES.JOURNAL],
          onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.JOURNAL),
          onNavigateContextDown: handleNavigateContextDown,
          rootJournalIdConst: ROOT_JOURNAL_ID,
        };
      case SLIDER_TYPES.PARTNER:
        return {
          data: displayedPartners,
          activeItemId: selectedPartnerId,
          onSlideChange: (id) => handleSwipe(sliderId, id),
          isAccordionOpen: accordionTypeState[sliderId],
          onToggleAccordion: () => toggleAccordion(sliderId),
          isLocked: isDocumentCreationMode && lockedPartnerId !== null,
        };
      case SLIDER_TYPES.GOODS:
        return {
          data: displayedGoods,
          activeItemId: selectedGoodsId,
          onSlideChange: (id) => handleSwipe(sliderId, id),
          isAccordionOpen: accordionTypeState[sliderId],
          onToggleAccordion: () => toggleAccordion(sliderId),
          isDocumentCreationMode: isDocumentCreationMode,
          selectedGoodsForDoc: selectedGoodsForDocument,
          onToggleGoodForDoc: handleToggleGoodForDocument,
          onUpdateGoodDetailForDoc: handleUpdateGoodDetailForDocument,
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
        return { data: [], activeItemId: null, isAccordionOpen: false };
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
              loop={false} // Usually better not to loop visibility toggles unless many
              className={styles.visibilitySwiper}
              onSwiper={(swiper) => {
                visibilitySwiperRef.current = swiper;
              }}
              observer={true}
              observeParents={true}
            >
              {INITIAL_ORDER.map((sliderId) => {
                // Iterate over INITIAL_ORDER to maintain toggle order
                const config = SLIDER_CONFIG_REF.current[sliderId];
                if (!config) return null;
                const title = config.title || sliderId;
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
                        {isCurrentlyVisible && visibleIndex !== -1
                          ? `${visibleIndex + 1}: `
                          : ""}
                        {title}
                      </button>
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
              if (typeof sliderId !== "string" || sliderId === "") return null;
              if (!visibility[sliderId]) return null;
              const config = SLIDER_CONFIG_REF.current[sliderId];
              if (!config) return null;

              const { Component, title: sliderTitle } = config;
              const sliderProps = getSliderProps(sliderId);

              const visibleOrderedIds = sliderOrder.filter(
                (id) => visibility[id]
              );
              const currentVisibleIndex = visibleOrderedIds.indexOf(sliderId);
              const canMoveUp = currentVisibleIndex > 0;
              const canMoveDown =
                currentVisibleIndex < visibleOrderedIds.length - 1;

              const isPartnerSlider = sliderId === SLIDER_TYPES.PARTNER;

              return (
                <motion.div
                  key={sliderId}
                  layoutId={sliderId}
                  layout
                  style={{ order: index }}
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
                      disabled={
                        isDocumentCreationMode &&
                        isPartnerSlider &&
                        lockedPartnerId !== selectedPartnerId
                      } // Disable edit if partner is not the locked one
                    >
                      <IoOptionsOutline />
                    </button>

                    {/* Document Creation/Cancel Buttons for Partner Slider */}
                    {isPartnerSlider &&
                      isTerminalJournalActive &&
                      !isDocumentCreationMode &&
                      selectedPartnerId && (
                        <button
                          onClick={handleStartDocumentCreation}
                          className={`${styles.controlButton} ${styles.createDocumentButton}`}
                          title="Create Document with this Partner"
                        >
                          <IoAddCircleOutline /> Create Doc
                        </button>
                      )}
                    {isPartnerSlider &&
                      isDocumentCreationMode &&
                      lockedPartnerId === selectedPartnerId && (
                        <button
                          onClick={handleCancelDocumentCreation}
                          className={`${styles.controlButton} ${styles.cancelDocumentButton}`}
                          title="Cancel Document Creation"
                        >
                          <IoTrashBinOutline /> Cancel Doc
                        </button>
                      )}

                    <div className={styles.moveButtonGroup}>
                      {canMoveUp && (
                        <button
                          onClick={() => moveSlider(sliderId, "up")}
                          className={styles.controlButton}
                          aria-label={`Move ${sliderTitle} up`}
                          disabled={isDocumentCreationMode} // Disable move when creating doc
                        >
                          ▲ Up
                        </button>
                      )}
                      {canMoveDown && (
                        <button
                          onClick={() => moveSlider(sliderId, "down")}
                          className={styles.controlButton}
                          aria-label={`Move ${sliderTitle} down`}
                          disabled={isDocumentCreationMode} // Disable move when creating doc
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

      {isDocumentCreationMode && (
        <div className={styles.finishDocumentContainer}>
          <button
            onClick={handleFinishDocument}
            className={`${styles.modalButtonPrimary} ${styles.finishDocumentButton}`}
          >
            Finish Document & Review
          </button>
        </div>
      )}

      <AnimatePresence>
        {isJournalModalOpen && (
          <JournalModal
            isOpen={isJournalModalOpen}
            onClose={closeJournalModal}
            onConfirmSelection={handleSelectTopLevelJournal}
            onSetShowRoot={() => handleSelectTopLevelJournal(ROOT_JOURNAL_ID)}
            hierarchy={[
              {
                id: ROOT_JOURNAL_ID_FOR_MODAL,
                name: ``,
                code: "ROOT",
                children: activeDataSet?.account_hierarchy || [],
                isConceptualRoot: true,
              },
            ]}
            onTriggerAddChild={(parentId, parentCode) => {
              const parentNodeDetails = findNodeById(
                activeDataSet?.account_hierarchy,
                parentId
              );
              if (parentId === ROOT_JOURNAL_ID_FOR_MODAL) {
                openAddJournalModalWithContext({
                  level: "top",
                  parentId: null,
                  parentCode: null,
                });
              } else {
                openAddJournalModalWithContext({
                  level: "child",
                  parentId: parentId,
                  parentCode: parentCode,
                  parentName: parentNodeDetails?.name || "",
                });
              }
            }}
            onDeleteAccount={handleDeleteJournalAccount}
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
      <AnimatePresence>
        {isConfirmationModalOpen && (
          <DocumentConfirmationModal
            isOpen={isConfirmationModalOpen}
            onClose={() => setIsConfirmationModalOpen(false)}
            onValidate={handleValidateDocument}
            partner={findNodeById(activeDataSet.partners, lockedPartnerId)}
            goods={selectedGoodsForDocument}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
