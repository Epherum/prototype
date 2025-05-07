"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import Image from "next/image"; // Keep import if potentially used later
import styles from "./page.module.css";
import initialData1 from "./data.json"; // Assuming this is updated per DB structure
import initialData2 from "./data2.json"; // Assuming this is updated per DB structure

// Swiper Imports for BOTH slider types
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules"; // Import Navigation for both
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

// Icons
import {
  IoCartOutline,
  IoPricetagOutline,
  IoBuildOutline,
  IoWalletOutline,
  IoNavigateOutline,
  IoClipboardOutline,
  IoOptionsOutline,
  IoPencilOutline, // Import Edit Icon
  IoChevronDownOutline, // Icon for accordion expand
  IoChevronForwardOutline, // Icon for accordion collapse
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

// Helper
const getFirstId = (arr) =>
  arr && arr.length > 0 && arr[0] ? arr[0].id : null;

// --- Constants ---
const SLIDER_TYPES = {
  JOURNAL: "journal",
  PARTNER: "partner",
  GOODS: "goods",
  PROJECT: "project", // New
  DOCUMENT: "document", // New
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

// page.js

// ... imports, other components ...

// --- JournalHierarchySlider Component (MODIFIED) ---
function JournalHierarchySlider({
  sliderId,
  title,
  // Mode and Data Props
  mode,
  hierarchyData = [],
  childNodes = [],
  topLevelJournalData = [],
  // ID Props
  selectedParentId,
  selectedChildId,
  selectedGrandchildId,
  // Callback Props
  onSelectParent,
  onSelectChild,
  onSelectGrandchild,
  onOpenModal,
  // UI Props
  isAccordionOpen,
  onToggleAccordion,
}) {
  const swiperRef = useRef(null);
  const dataForSwiper = mode === "parents" ? topLevelJournalData : childNodes;
  const activeItemIdForSwiper =
    mode === "parents" ? selectedParentId : selectedChildId;
  const parentNode = findNodeById(hierarchyData, selectedParentId);
  const currentChildNode =
    mode === "children" ? findNodeById(childNodes, selectedChildId) : null;
  const grandchildNodes = currentChildNode?.children || [];

  const initialSlideIndex = Math.max(
    0,
    dataForSwiper.findIndex((node) => node?.id === activeItemIdForSwiper)
  );

  useEffect(() => {
    const newIndex = dataForSwiper.findIndex(
      (node) => node?.id === activeItemIdForSwiper
    );
    if (
      swiperRef.current &&
      newIndex !== -1 &&
      newIndex !== swiperRef.current.activeIndex
    ) {
      swiperRef.current.slideTo(newIndex);
    }
  }, [activeItemIdForSwiper, dataForSwiper, sliderId, mode]);

  const handleSwiperChange = (swiper) => {
    const currentRealIndex = swiper.activeIndex;
    if (dataForSwiper?.[currentRealIndex]) {
      const newId = dataForSwiper[currentRealIndex].id;
      console.log(
        `JournalHierarchySlider (${sliderId}, Mode: ${mode}): Swipe. Index: ${currentRealIndex}, ID: ${newId}. WAITING FOR EXPLICIT SELECTION IN PARENT MODE.`
      );
      // In 'parents' mode, swipe changes the viewed slide, but selection happens via button.
      // In 'children' mode, swipe IS the selection.
      if (mode === "children" && onSelectChild) {
        onSelectChild(newId);
      }
      // If mode is 'parents', onSelectParent will be called by the button inside the slide.
    }
  };

  const swiperKey = `${sliderId}-mode-${mode}-parent-${selectedParentId}-len${dataForSwiper.length}-active${activeItemIdForSwiper}`;

  return (
    <>
      {mode === "children" && parentNode && (
        <div className={styles.journalParentHeader}>
          <span className={styles.journalParentInfo}>
            Parent: {parentNode.code} - {parentNode.name}
          </span>
        </div>
      )}
      <h2 className={styles.sliderTitle}>
        {title} -{" "}
        {mode === "parents"
          ? "Select Top-Level Category"
          : `Children of ${parentNode?.code || "N/A"}`}
      </h2>
      {dataForSwiper.length > 0 ? (
        <Swiper
          key={swiperKey}
          ref={swiperRef}
          modules={[Navigation, Pagination]}
          initialSlide={initialSlideIndex}
          loop={false}
          spaceBetween={20}
          slidesPerView={1}
          navigation={dataForSwiper.length > 1}
          pagination={dataForSwiper.length > 1 ? { clickable: true } : false}
          onSlideChangeTransitionEnd={handleSwiperChange} // Swiping in parent mode now just shows, button selects
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
          observer={true}
          observeParents={true}
          className={`${styles.swiperInstance} ${styles.journalSwiperInstance}`}
        >
          {dataForSwiper.map((node) => {
            if (!node) return null;

            if (mode === "parents") {
              return (
                <SwiperSlide
                  key={node.id}
                  className={`${styles.slide} ${styles.parentModeSlide}`}
                >
                  {" "}
                  {/* Added parentModeSlide class */}
                  <div className={styles.slideTextContent}>
                    <span className={styles.slideName}>
                      {node.name || node.id || "Unnamed Category"}
                    </span>
                    <span className={styles.slideSubText}>{node.code}</span>
                  </div>
                  {/* --- NEW: Select Button within Parent Mode Slide --- */}
                  {onSelectParent && ( // Ensure callback is provided
                    <button
                      onClick={() => onSelectParent(node.id)}
                      className={styles.selectParentButton}
                    >
                      Select Category: {node.code}
                    </button>
                  )}
                </SwiperSlide>
              );
            } else {
              // mode === 'children'
              const currentGrandchildren = node.children || [];
              return (
                <SwiperSlide key={node.id} className={styles.slide}>
                  <div className={styles.grandchildButtonsContainer}>
                    {onSelectGrandchild &&
                      currentGrandchildren.slice(0, 2).map((gc) => (
                        <button
                          key={gc.id}
                          onClick={() => onSelectGrandchild(gc.id)}
                          className={`${styles.grandchildButton} ${
                            selectedGrandchildId === gc.id
                              ? styles.grandchildButtonActive
                              : ""
                          }`}
                        >
                          {gc.code}
                        </button>
                      ))}
                  </div>
                  <div className={styles.slideTextContent}>
                    <span className={styles.slideName}>
                      {node.name || node.id || "Unnamed Child"}
                    </span>
                    <span className={styles.slideSubText}>{node.code}</span>
                  </div>
                  <div className={styles.grandchildButtonsContainer}>
                    {onSelectGrandchild &&
                      currentGrandchildren.slice(2).map((gc) => (
                        <button
                          key={gc.id}
                          onClick={() => onSelectGrandchild(gc.id)}
                          className={`${styles.grandchildButton} ${
                            selectedGrandchildId === gc.id
                              ? styles.grandchildButtonActive
                              : ""
                          }`}
                        >
                          {gc.code}
                        </button>
                      ))}
                  </div>
                </SwiperSlide>
              );
            }
          })}
        </Swiper>
      ) : (
        <div className={styles.noData}>
          {mode === "parents"
            ? "No top-level categories found."
            : `No child accounts under '${
                parentNode?.name || "selected parent"
              }'.`}
        </div>
      )}
      {mode === "children" && currentChildNode && onToggleAccordion && (
        <div className={styles.accordionContainer}>
          {/* ... Accordion content ... */}
          <button
            onClick={onToggleAccordion}
            className={styles.detailsButton}
            aria-expanded={isAccordionOpen}
          >
            Details ({currentChildNode.name})
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
                key={`details-${currentChildNode.id}`}
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
                    <strong>Name:</strong> {currentChildNode.name}
                  </p>
                  <p>
                    <strong>Code:</strong> {currentChildNode.code}
                  </p>
                  <p>
                    <strong>ID:</strong> {currentChildNode.id}
                  </p>
                  <p>
                    <strong>Has Grandchildren:</strong>{" "}
                    {grandchildNodes.length > 0 ? "Yes" : "No"}
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

// ... DynamicSlider, AccountNode, JournalModal, Home (with its render method updated as in Step 1) ...
// --- DynamicSlider Component (Simplified Version) ---
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
                key={`details-${currentItemForAccordion.id}`}
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

// --- AccountNode Component (CORRECTED CLICK/TOGGLE LOGIC) ---
function AccountNode({
  node,
  level = 0,
  openNodes,
  toggleNode,
  selectedAccountId,
  onSelectNode,
  onTriggerAddChildToNode,
  onDeleteNode,
}) {
  const isOpen = openNodes[node.id] ?? false;
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedAccountId;

  // Handles click on the entire row
  const handleRowClick = () => {
    onSelectNode(node.id); // Always select the node
    if (hasChildren) {
      toggleNode(node.id); // If it has children, also toggle its open state
    }
  };

  // Handles click specifically on the toggle icon
  const handleToggleIconClick = (e) => {
    e.stopPropagation(); // Prevent the row click from firing
    if (hasChildren) {
      toggleNode(node.id); // Only toggle if it has children
    }
  };

  const handleAddChildClick = (e) => {
    e.stopPropagation(); // Prevent row click from firing
    if (onTriggerAddChildToNode) {
      onTriggerAddChildToNode(node.id, node.code);
    }
  };
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (onDeleteNode) {
      // Confirmation
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
        style={{ paddingLeft: `${level * 25}px` }}
        onClick={handleRowClick} // Main click handler for the row
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isOpen : undefined}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && handleRowClick()
        }
      >
        {/* Toggle Icon - click specifically toggles */}
        <span
          className={styles.accountNodeToggle}
          onClick={handleToggleIconClick} // Specific handler for icon
          aria-hidden="true"
          role="button" // Make it act like a button for accessibility
          tabIndex={0} // Make it focusable
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && handleToggleIconClick(e)
          } // Keyboard accessible
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
        {/* Action Buttons Container */}
        <div className={styles.accountNodeActions}>
          {isSelected && onTriggerAddChildToNode && (
            <button
              onClick={handleAddChildClick}
              className={styles.accountNodeActionButton}
              title={`Add sub-account to ${node.name}`}
            >
              <IoAddCircleOutline />
            </button>
          )}
          {isSelected &&
            onDeleteNode && ( // Show delete if selected and callback exists
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
                paddingLeft: `${level * 25 + 20}px`,
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
                  onTriggerAddChildToNode={onTriggerAddChildToNode}
                  onDeleteNode={onDeleteNode} // Pass the prop down
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
// --- END AccountNode ---

// ... (Rest of your page.js: JournalModal, AddJournalModal, Home component, etc.)
// --- END AccountNode ---
// --- JournalModal Component (MODIFIED) ---
function JournalModal({
  isOpen,
  onClose,
  onConfirmSelection, // Renamed from handleConfirmSelection, now selects parent
  onSetMode, // *** NEW PROP ***
  hierarchy = [],
  onTriggerAdd,
  onTriggerAddChild, // For adding a child to a specific node
  onDeleteAccount,
}) {
  const [openNodes, setOpenNodes] = useState({});
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  const toggleNode = useCallback((nodeId) => {
    setOpenNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }, []);

  const handleSelectNode = useCallback((nodeId) => {
    setSelectedAccountId(nodeId);
    console.log("Selected Account Node ID:", nodeId);
  }, []);

  // Handler for the standard "Select Category" button
  const handleConfirmParentSelectionClick = () => {
    if (selectedAccountId) {
      console.log(
        "Modal Confirm Parent Selection Clicked. ID:",
        selectedAccountId
      );
      if (onConfirmSelection) {
        onConfirmSelection(selectedAccountId); // This selects the parent AND sets mode='children' in Home
      }
      onClose(); // Close the modal
    }
  };

  // *** NEW Handler for the "Show Top-Level" button ***
  const handleShowTopLevelClick = () => {
    console.log("Modal Show Top-Level Clicked.");
    if (onSetMode) {
      onSetMode("parents"); // Tell Home to change the Journal Slider mode
    }
    onClose(); // Close the modal
  };
  // This "Add New" button is for adding a TOP-LEVEL category
  const handleAddNewTopLevel = () => {
    console.log("Add New Top-Level Account Clicked in JournalModal");
    if (onTriggerAdd) {
      const context = { level: "top", parentId: null, parentCode: null };
      onTriggerAdd(context); // This calls openAddJournalModalWithContext in Home
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setOpenNodes({});
      setSelectedAccountId(null);
    }
  }, [isOpen]);

  return (
    <motion.div
      className={styles.modalOverlay}
      onClick={onClose}
      key="journal-modal-overlay"
      initial="closed"
      animate="open"
      exit="closed"
      variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <motion.div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        key="journal-modal-content"
        variants={{
          open: {
            opacity: 1,
            scale: 1,
            transition: { delay: 0.1, duration: 0.3 },
          },
          closed: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
        }}
      >
        <button
          className={styles.modalCloseButton}
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>
        <h2>Select Journal Account Category</h2>

        <div className={styles.modalTopActions}>
          <button
            className={`${styles.modalButtonSecondary} ${styles.modalActionButton}`}
            onClick={handleShowTopLevelClick}
          >
            <IoNavigateOutline />
            Show Top-Level Categories in Slider
          </button>
        </div>

        <div className={styles.accountHierarchyContainer}>
          {hierarchy.length > 0 ? (
            hierarchy.map((rootNode) => (
              <AccountNode
                key={rootNode.id}
                node={rootNode}
                level={0}
                openNodes={openNodes}
                toggleNode={toggleNode}
                selectedAccountId={selectedAccountId}
                onSelectNode={handleSelectNode}
                onTriggerAddChildToNode={onTriggerAddChild} // *** PASS THE PROP HERE ***
                onDeleteNode={onDeleteAccount} // *** PASS THE PROP HERE ***
              />
            ))
          ) : (
            <p>No hierarchy data available.</p>
          )}
        </div>

        <div className={styles.modalActions}>
          {/* This button now explicitly adds a TOP-LEVEL category */}
          <button
            className={`${styles.modalButtonSecondary} ${styles.modalActionButton}`}
            onClick={handleAddNewTopLevel}
          >
            <IoAddCircleOutline /> Add Top-Level
          </button>
          <button
            className={`${styles.modalButtonPrimary} ${styles.modalActionButton}`}
            onClick={handleConfirmParentSelectionClick} // Renamed internal handler
            disabled={!selectedAccountId}
          >
            <IoCheckmarkCircleOutline /> Select Category
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- AddJournalModal Component (Full Current Version with Validation) ---
function AddJournalModal({ isOpen, onClose, onSubmit, context }) {
  // const [newId, setNewId] = useState(""); // ID will be auto-generated from code
  const [newCodeSuffix, setNewCodeSuffix] = useState(""); // User types only the suffix
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  let codePrefixForDisplay = ""; // e.g., "4" or "401" or "401-12" (parent's code for display)
  let codeSeparator = ""; // "" for level 2, "-" for level 3+
  let codePatternHint = "";
  let finalCodeForNewAccount = ""; // For constructing the full code

  // Determine level and parent info
  let currentLevel = 1; // Default to top-level
  if (context?.parentCode) {
    if (
      !context.parentCode.includes("-") &&
      context.parentCode.length === 1 &&
      /^\d$/.test(context.parentCode)
    ) {
      currentLevel = 2; // Child of top-level
      codePrefixForDisplay = context.parentCode;
      codeSeparator = "";
      codePatternHint = `Enter 2 digits (e.g., "01" for code ${context.parentCode}01)`;
    } else {
      currentLevel = 3; // Grandchild or deeper (could be more levels)
      codePrefixForDisplay = context.parentCode;
      codeSeparator = "-";
      codePatternHint = `Enter 1 or 2 digits (e.g., "01" for code ${context.parentCode}-01)`;
    }
  } else {
    // Top-level
    codePatternHint = `Enter a single digit (1-9)`;
  }

  useEffect(() => {
    if (isOpen) {
      setNewCodeSuffix(""); // User always types the suffix part
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
      // Suffix and Name are required
      setError("Code Suffix and Name fields are required.");
      return;
    }

    // --- Strict Code Validation ---
    if (currentLevel === 1) {
      // Top-Level
      if (!/^[1-9]$/.test(trimmedSuffix)) {
        // Single digit 1-9
        setError("Top-level code must be a single digit (1-9).");
        return;
      }
      finalCodeForNewAccount = trimmedSuffix;
    } else if (currentLevel === 2) {
      // Child of Top-Level (e.g., 4 -> 401)
      if (!/^\d{2}$/.test(trimmedSuffix)) {
        // Exactly two digits
        setError(
          `Level 2 code suffix (after "${codePrefixForDisplay}") must be exactly two digits. e.g., "01"`
        );
        return;
      }
      finalCodeForNewAccount = codePrefixForDisplay + trimmedSuffix;
    } else {
      // Level 3+ (e.g., 401 -> 401-01 or 401-12-01)
      if (!/^\d{1,2}$/.test(trimmedSuffix)) {
        // One or two digits for the suffix part
        setError(
          `Level 3+ code suffix (after "${codePrefixForDisplay}${codeSeparator}") must be one or two digits. e.g., "01"`
        );
        return;
      }
      finalCodeForNewAccount =
        codePrefixForDisplay + codeSeparator + trimmedSuffix;
    }
    // --- End Validation ---

    // ID is now the same as the code
    const newAccountId = finalCodeForNewAccount;

    // Check for duplicate ID/Code (this should ideally be in Home's handleAddJournalSubmit
    // as it has the full hierarchy. For now, we proceed.)

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
      // Corrected condition for top level
      title = "Add New Top-Level Category";
    } else {
      // Adding child/grandchild
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
// --- END AddJournalModal ---

// ... (Rest of your page.js: AccountNode, JournalModal, JournalHierarchySlider, DynamicSlider, Home component, etc.)
// --- Main Page Component ---
export default function Home() {
  // === State ===
  const [sliderOrder, setSliderOrder] = useState(INITIAL_ORDER);
  const [activeDataSource, setActiveDataSource] = useState("data1");
  const [activeDataSet, setActiveDataSet] = useState(initialData1);

  // --- Journal State ---
  const initialParentId = "cat-6";
  const [selectedParentJournalId, setSelectedParentJournalId] =
    useState(initialParentId);
  const [journalSliderMode, setJournalSliderMode] = useState("children"); // 'children' or 'parents'

  const getInitialChildAndGrandchild = useCallback((parentId, dataset) => {
    const parentNode = findNodeById(dataset?.account_hierarchy, parentId);
    const firstChild = parentNode?.children?.[0];
    const firstGrandchild = firstChild?.children?.[0];
    return {
      childId: firstChild?.id || null,
      grandchildId: firstGrandchild?.id || null,
    };
  }, []);

  const { childId: initialChildId, grandchildId: initialGrandchildId } =
    getInitialChildAndGrandchild(initialParentId, activeDataSet);
  const [selectedChildJournalId, setSelectedChildJournalId] =
    useState(initialChildId);
  const [selectedGrandchildJournalId, setSelectedGrandchildJournalId] =
    useState(initialGrandchildId);

  // Other selections
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

  // Placeholders for Project/Document
  const placeholderProjectData = [
    { id: "project-placeholder", name: "Sample Project" },
  ];
  const placeholderDocumentData = [
    { id: "document-placeholder", name: "Specification Doc" },
  ];

  // Displayed Data (Filtered)
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

  // UI State
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

  // --- NEW State for AddJournalModal ---
  const [isAddJournalModalOpen, setIsAddJournalModalOpen] = useState(false);
  const [addJournalContext, setAddJournalContext] = useState(null); // { level: 'top'/'child'/'grandchild', parentId: 'some-id' or null }

  const visibilitySwiperRef = useRef(null);

  // --- Effects ---
  useEffect(() => {
    // For visibility swiper
    if (visibilitySwiperRef.current) {
      console.log("Updating visibility swiper due to order change.");
      requestAnimationFrame(() => {
        visibilitySwiperRef.current?.update();
      });
    }
  }, [sliderOrder]);

  // Filtering useEffect
  useEffect(() => {
    console.log(
      "%c--- useEffect START (Filter Logic) ---",
      "color: blue; font-weight: bold;"
    );
    // ... (Current filtering logic, ensure it uses selectedChildJournalId or other relevant ID)
    // For now, assuming it uses selectedChildJournalId if Journal is a filter source
    const activeJournalFilterId = selectedChildJournalId;

    let finalFilteredPartners = activeDataSet?.partners || [];
    let finalFilteredGoods = activeDataSet?.goods || [];
    // ... (Your placeholder or actual filtering logic for partners, goods etc.)

    if (
      JSON.stringify(displayedPartners) !==
      JSON.stringify(finalFilteredPartners)
    )
      setDisplayedPartners(finalFilteredPartners);
    if (JSON.stringify(displayedGoods) !== JSON.stringify(finalFilteredGoods))
      setDisplayedGoods(finalFilteredGoods);

    // Selection Reset Checks
    let resetTriggered = false;
    if (
      !resetTriggered &&
      selectedPartnerId &&
      !finalFilteredPartners.some((p) => p?.id === selectedPartnerId)
    ) {
      setSelectedPartnerId(getFirstId(finalFilteredPartners));
      resetTriggered = true;
    }
    if (
      !resetTriggered &&
      selectedGoodsId &&
      !finalFilteredGoods.some((g) => g?.id === selectedGoodsId)
    ) {
      setSelectedGoodsId(getFirstId(finalFilteredGoods));
      resetTriggered = true;
    }
    // ... Project/Document reset checks ...
    console.log("%c--- useEffect END ---", "color: blue; font-weight: bold;");
  }, [
    sliderOrder,
    selectedParentJournalId,
    selectedChildJournalId,
    selectedGrandchildJournalId, // Journal selections
    selectedPartnerId,
    selectedGoodsId,
    selectedProjectId,
    selectedDocumentId, // Other selections
    activeDataSet,
    displayedPartners,
    displayedGoods,
    displayedProjects,
    displayedDocuments, // To compare before setting
  ]);

  // === Handlers ===
  const handleDataSourceChange = (event) => {
    const newSourceKey = event.target.value;
    if (newSourceKey === activeDataSource) return;
    const newDataSet = newSourceKey === "data1" ? initialData1 : initialData2;

    setActiveDataSource(newSourceKey);
    setActiveDataSet(newDataSet);

    const newInitialParentId = "cat-6";
    const { childId: newChildId, grandchildId: newGrandchildId } =
      getInitialChildAndGrandchild(newInitialParentId, newDataSet);
    setSelectedParentJournalId(newInitialParentId);
    setSelectedChildJournalId(newChildId);
    setSelectedGrandchildJournalId(newGrandchildId);
    setJournalSliderMode("children"); // Reset mode

    setSelectedPartnerId(getFirstId(newDataSet?.partners));
    setSelectedGoodsId(getFirstId(newDataSet?.goods));
    setSelectedProjectId("project-placeholder");
    setSelectedDocumentId("document-placeholder");

    setDisplayedPartners(newDataSet?.partners || []);
    setDisplayedGoods(newDataSet?.goods || []);
    setDisplayedProjects(placeholderProjectData);
    setDisplayedDocuments(placeholderDocumentData);

    setSliderOrder(INITIAL_ORDER);
    setVisibility({
      /* ... initial visibility ... */
    });
    setAccordionTypeState({
      /* ... initial accordion state ... */
    });
    setIsJournalModalOpen(false);
  };

  const openJournalModal = useCallback(() => setIsJournalModalOpen(true), []);
  const closeJournalModal = useCallback(() => setIsJournalModalOpen(false), []);

  const handleSetJournalMode = useCallback((mode) => {
    if (mode === "parents" || mode === "children") {
      console.log("Setting Journal Slider Mode to:", mode);
      setJournalSliderMode(mode);
    } else {
      console.warn("Invalid journal slider mode requested:", mode);
    }
  }, []);

  const handleSelectParentJournal = useCallback(
    (parentId) => {
      console.log("New Parent Selected:", parentId);
      if (!findNodeById(activeDataSet?.account_hierarchy, parentId)) {
        console.error("Selected Parent ID not found in hierarchy:", parentId);
        return;
      }
      setSelectedParentJournalId(parentId);
      const { childId: newChildId, grandchildId: newGrandchildId } =
        getInitialChildAndGrandchild(parentId, activeDataSet);
      setSelectedChildJournalId(newChildId);
      setSelectedGrandchildJournalId(newGrandchildId);
      setJournalSliderMode("children");
      console.log(
        ` -> New Child: ${newChildId}, New Grandchild: ${newGrandchildId}. Mode set to 'children'.`
      );
    },
    [activeDataSet, getInitialChildAndGrandchild]
  );

  const handleSelectJournalChild = useCallback(
    (childId) => {
      console.log("Child Selected:", childId);
      const parentNode = findNodeById(
        activeDataSet?.account_hierarchy,
        selectedParentJournalId
      );
      const isValidChild = parentNode?.children?.some((c) => c.id === childId);

      if (isValidChild) {
        setSelectedChildJournalId(childId);
        const childNode = findNodeById(parentNode.children, childId);
        const firstGrandchild = childNode?.children?.[0];
        setSelectedGrandchildJournalId(firstGrandchild?.id || null);
        console.log(` -> Reset Grandchild: ${firstGrandchild?.id || null}`);
      } else {
        console.warn(
          `Selected child ${childId} is not valid under parent ${selectedParentJournalId}. Selection ignored.`
        );
      }
    },
    [activeDataSet, selectedParentJournalId]
  );

  const handleSelectGrandchildJournal = useCallback((grandchildId) => {
    console.log("Grandchild Selected:", grandchildId);
    setSelectedGrandchildJournalId(grandchildId);
  }, []);

  const handleSwipe = useCallback((sourceSliderId, selectedItemId) => {
    console.log(`Swipe: ${sourceSliderId}, New ID: ${selectedItemId}`);
    if (sourceSliderId === SLIDER_TYPES.PARTNER)
      setSelectedPartnerId(selectedItemId);
    else if (sourceSliderId === SLIDER_TYPES.GOODS)
      setSelectedGoodsId(selectedItemId);
    else if (sourceSliderId === SLIDER_TYPES.PROJECT)
      setSelectedProjectId(selectedItemId);
    else if (sourceSliderId === SLIDER_TYPES.DOCUMENT)
      setSelectedDocumentId(selectedItemId);
  }, []);

  const openAddJournalModalWithContext = useCallback((context) => {
    console.log("Opening Add Journal Modal with context:", context);
    setAddJournalContext(context);
    setIsAddJournalModalOpen(true);
    setIsJournalModalOpen(false); // Close the main journal modal
  }, []);

  const closeAddJournalModal = useCallback(() => {
    setIsAddJournalModalOpen(false);
    setAddJournalContext(null);
  }, []);

  // page.js / Home component

  const handleAddJournalSubmit = useCallback(
    (newAccountData) => {
      // newAccountData is {id, code, name, children}
      console.log(
        "Submitting new journal account:",
        newAccountData,
        "Using context:",
        addJournalContext
      ); // Use addJournalContext

      setActiveDataSet((currentDataset) => {
        const originalHierarchy = currentDataset.account_hierarchy || [];
        const proposedNewId = newAccountData.id; // This is the final code/ID

        // --- More Robust Duplicate ID/Code Check ---
        // Use addJournalContext here
        if (
          addJournalContext?.level === "top" ||
          !addJournalContext?.parentId
        ) {
          // For top-level, check if ID exists anywhere at the top
          if (originalHierarchy.some((node) => node.id === proposedNewId)) {
            alert(
              `Error: Top-level Account Code/ID "${proposedNewId}" already exists.`
            );
            setIsAddJournalModalOpen(true); // Re-open add modal
            return currentDataset; // Important: return original dataset on error
          }
        } else {
          // For children, check if ID exists under the specific parent
          const parentNode = findNodeById(
            originalHierarchy,
            addJournalContext.parentId
          ); // Use addJournalContext
          if (
            parentNode &&
            parentNode.children &&
            parentNode.children.some((child) => child.id === proposedNewId)
          ) {
            alert(
              `Error: Account Code/ID "${proposedNewId}" already exists under parent "${addJournalContext.parentCode}".`
            ); // Use addJournalContext
            setIsAddJournalModalOpen(true);
            return currentDataset;
          }
          if (!parentNode) {
            alert(
              `Error: Parent node "${addJournalContext.parentId}" not found for adding child.`
            ); // Use addJournalContext
            setIsAddJournalModalOpen(true);
            return currentDataset;
          }
        }
        // --- End Duplicate Check ---

        const newHierarchy = JSON.parse(JSON.stringify(originalHierarchy));

        let newParentIdToSelect = selectedParentJournalId;
        let newChildIdToSelect = selectedChildJournalId;

        // Use addJournalContext here as well for adding logic
        if (
          addJournalContext?.level === "top" ||
          !addJournalContext?.parentId
        ) {
          newHierarchy.push(newAccountData);
          newParentIdToSelect = newAccountData.id;
        } else {
          const findAndAdd = (nodes, parentId, newItem) => {
            for (let i = 0; i < nodes.length; i++) {
              if (nodes[i].id === parentId) {
                nodes[i].children.push(newItem);
                return true;
              }
              if (nodes[i].children?.length > 0) {
                if (findAndAdd(nodes[i].children, parentId, newItem))
                  return true;
              }
            }
            return false;
          };
          if (
            !findAndAdd(
              newHierarchy,
              addJournalContext.parentId,
              newAccountData
            )
          ) {
            // Use addJournalContext
            alert(
              `Critical Error: Could not add child. Parent "${addJournalContext.parentId}" disappeared or structure issue.`
            ); // Use addJournalContext
            setIsAddJournalModalOpen(true);
            return currentDataset;
          }
          newParentIdToSelect = addJournalContext.parentId; // Use addJournalContext
          newChildIdToSelect = newAccountData.id;
        }

        // Update selections:
        if (
          addJournalContext?.level === "top" ||
          !addJournalContext?.parentId
        ) {
          // Use addJournalContext
          handleSelectParentJournal(newParentIdToSelect);
        } else if (addJournalContext?.parentId) {
          // Use addJournalContext
          setSelectedParentJournalId(newParentIdToSelect);
          setSelectedChildJournalId(newChildIdToSelect);
          setSelectedGrandchildJournalId(null);
          setJournalSliderMode("children");
        }

        return { ...currentDataset, account_hierarchy: newHierarchy };
      });

      closeAddJournalModal();
    },
    [
      addJournalContext,
      selectedParentJournalId,
      getInitialChildAndGrandchild,
      handleSelectParentJournal,
    ]
  ); // addJournalContext IS a dependency
  // page.js / Home component

  const handleDeleteJournalAccount = useCallback(
    (accountIdToDelete) => {
      console.log("Attempting to delete account ID:", accountIdToDelete);

      setActiveDataSet((currentDataset) => {
        const hierarchyCopy = JSON.parse(
          JSON.stringify(currentDataset.account_hierarchy || [])
        );
        let nodeWasRemoved = false;

        const removeNodeRecursively = (nodes, idToRemove) => {
          /* ... same as your provided code ... */
          for (let i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].id === idToRemove) {
              nodes.splice(i, 1);
              nodeWasRemoved = true;
              return true;
            }
            if (nodes[i].children && nodes[i].children.length > 0) {
              if (removeNodeRecursively(nodes[i].children, idToRemove)) {
                return true;
              }
            }
          }
          return false;
        };

        removeNodeRecursively(hierarchyCopy, accountIdToDelete);

        if (!nodeWasRemoved) {
          console.warn(
            "Node to delete was not found in hierarchy:",
            accountIdToDelete
          );
          return currentDataset;
        }
        console.log("Node deleted. New hierarchy (copy):", hierarchyCopy);

        let newParentId = selectedParentJournalId;
        let newChildId = selectedChildJournalId;
        let newGrandchildId = selectedGrandchildJournalId;
        let newMode = journalSliderMode;

        const idStillExists = (id, hierarchy) => !!findNodeById(hierarchy, id);

        // Determine the parent of the deleted node, if it wasn't top-level
        let parentOfDeletedNodeId = null;
        if (accountIdToDelete !== newParentId) {
          // If we didn't delete the currently selected parent
          const findParent = (nodes, childId) => {
            for (const node of nodes) {
              if (node.children?.some((c) => c.id === childId)) return node.id;
              if (node.children?.length > 0) {
                const foundParent = findParent(node.children, childId);
                if (foundParent) return foundParent;
              }
            }
            return null;
          };
          parentOfDeletedNodeId = findParent(hierarchyCopy, accountIdToDelete);
        }

        // If the selected parent was deleted, select the first available top-level.
        if (
          !idStillExists(newParentId, hierarchyCopy) ||
          accountIdToDelete === newParentId
        ) {
          newParentId = getFirstId(hierarchyCopy) || null;
          newMode = newParentId ? "children" : "parents"; // Default to children if a parent exists
        }

        // If the selected child was deleted OR its parent changed/was deleted, find a new child.
        const currentParentNode = findNodeById(hierarchyCopy, newParentId);
        if (
          !idStillExists(newChildId, hierarchyCopy) ||
          accountIdToDelete === newChildId ||
          (currentParentNode &&
            !currentParentNode.children?.some((c) => c.id === newChildId))
        ) {
          newChildId = getFirstId(currentParentNode?.children) || null;
        }

        // If the selected grandchild was deleted OR its parent (the child) changed/was deleted, find a new grandchild.
        let currentChildNodeForGrandchildren = null;
        if (newParentId && newChildId) {
          // Only look for child if parent is valid
          const tempParent = findNodeById(hierarchyCopy, newParentId);
          currentChildNodeForGrandchildren = findNodeById(
            tempParent?.children,
            newChildId
          );
        }

        if (
          !idStillExists(newGrandchildId, hierarchyCopy) ||
          accountIdToDelete === newGrandchildId ||
          (currentChildNodeForGrandchildren &&
            !currentChildNodeForGrandchildren.children?.some(
              (gc) => gc.id === newGrandchildId
            ))
        ) {
          newGrandchildId =
            getFirstId(currentChildNodeForGrandchildren?.children) || null;
        }

        // Final safety: if no valid parent, clear children and set mode
        if (!newParentId) {
          newChildId = null;
          newGrandchildId = null;
          newMode = "parents";
        } else if (newMode === "parents" && newParentId) {
          // If was in 'parents' mode but now have a valid parent
          newMode = "children";
        }

        console.log(
          "Selections after delete - Parent:",
          newParentId,
          "Child:",
          newChildId,
          "Grandchild:",
          newGrandchildId,
          "Mode:",
          newMode
        );

        setSelectedParentJournalId(newParentId);
        setSelectedChildJournalId(newChildId);
        setSelectedGrandchildJournalId(newGrandchildId);
        setJournalSliderMode(newMode);

        // Also, ensure the selection within the JournalModal itself is cleared if the deleted item was selected there
        // This might require passing a reset function to JournalModal or relying on its useEffect for isOpen.
        // For now, if JournalModal is open and selectedAccountId was the one deleted, it should naturally become unselected.

        return {
          ...currentDataset,
          account_hierarchy: hierarchyCopy,
        };
      });
    },
    [
      selectedParentJournalId,
      selectedChildJournalId,
      selectedGrandchildJournalId,
      journalSliderMode,
      getInitialChildAndGrandchild,
    ]
  ); // Added getInitial...

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

  // --- SLIDER_CONFIG & getSliderProps ---
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
        const topLevelJournals = activeDataSet?.account_hierarchy || [];
        const parentNode = findNodeById(
          topLevelJournals,
          selectedParentJournalId
        );
        const childNodes = parentNode?.children || [];

        if (journalSliderMode === "parents") {
          return {
            mode: "parents",
            onOpenModal: openJournalModal,
            hierarchyData: topLevelJournals,
            topLevelJournalData: topLevelJournals,
            selectedParentId: selectedParentJournalId,
            onSelectParent: handleSelectParentJournal,
            selectedChildId: null,
            selectedGrandchildId: null,
            onSelectChild: undefined,
            onSelectGrandchild: undefined,
            isAccordionOpen: false,
            onToggleAccordion: undefined,
          };
        } else {
          // mode === 'children'
          return {
            mode: "children",
            onOpenModal: openJournalModal,
            hierarchyData: topLevelJournals,
            childNodes: childNodes,
            selectedParentId: selectedParentJournalId,
            selectedChildId: selectedChildJournalId,
            selectedGrandchildId: selectedGrandchildJournalId,
            onSelectChild: handleSelectJournalChild,
            onSelectGrandchild: handleSelectGrandchildJournal,
            isAccordionOpen: accordionTypeState[SLIDER_TYPES.JOURNAL],
            onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.JOURNAL),
            topLevelJournalData: [],
            onSelectParent: undefined,
          };
        }
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

  // === Render ===
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
              if (!visibility[sliderId]) return null;
              const config = SLIDER_CONFIG[sliderId];
              if (!config) {
                console.error(`Config missing for ${sliderId}`);
                return null;
              }
              const { Component, title: sliderTitle } = config;
              const sliderProps = getSliderProps(sliderId);
              const visibleOrder = sliderOrder.filter((id) => visibility[id]);
              const currentVisibleIndex = visibleOrder.indexOf(sliderId);
              const canMoveUp = currentVisibleIndex > 0;
              const canMoveDown = currentVisibleIndex < visibleOrder.length - 1;

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
                    >
                      <IoOptionsOutline />
                    </button>
                    <div className={styles.moveButtonGroup}>
                      {canMoveUp && (
                        <button
                          onClick={() => moveSlider(sliderId, "up")}
                          className={styles.controlButton}
                        >
                          ▲ Up
                        </button>
                      )}
                      {canMoveDown && (
                        <button
                          onClick={() => moveSlider(sliderId, "down")}
                          className={styles.controlButton}
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
            onConfirmSelection={handleSelectParentJournal}
            onSetMode={handleSetJournalMode}
            hierarchy={activeDataSet?.account_hierarchy || []}
            onTriggerAdd={openAddJournalModalWithContext} // For "Add Top-Level" button
            onDeleteAccount={handleDeleteJournalAccount} // *** PASS DELETE HANDLER ***
            // *** PASS `openAddJournalModalWithContext` FOR ADDING CHILDREN ***
            // It expects a context object, which AccountNode will now provide partially
            onTriggerAddChild={(parentId, parentCode) => {
              const parentNodeDetails = findNodeById(
                activeDataSet?.account_hierarchy,
                parentId
              ); // Find the parent node
              openAddJournalModalWithContext({
                level: "child",
                parentId: parentId,
                parentCode: parentCode,
                parentName: parentNodeDetails?.name || "", // Pass parent's name
              });
            }}
          />
        )}
      </AnimatePresence>

      {/* Add Journal Modal (new one) */}
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
