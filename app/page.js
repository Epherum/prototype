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
} from "react-icons/io5";

// Helper
const getFirstId = (arr) =>
  arr && arr.length > 0 && arr[0] ? arr[0].id : null;

// --- NEW Helper: Find Node in Hierarchy ---
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

// --- Constants ---
const SLIDER_TYPES = {
  JOURNAL: "journal",
  PARTNER: "partner",
  GOODS: "goods",
  PROJECT: "project", // New
  DOCUMENT: "document", // New
};

// --- NEW: JournalHierarchySlider Component ---
function JournalHierarchySlider({
  sliderId,
  title, // "Journal"
  hierarchyData = [],
  selectedParentId,
  selectedChildId,
  selectedGrandchildId,
  onSelectChild, // Callback when swiper changes child
  onSelectGrandchild, // Callback when grandchild button clicked
  onOpenModal, // Callback to open parent selection modal
  isAccordionOpen,
  onToggleAccordion,
}) {
  const swiperRef = useRef(null); // Ref to control Swiper instance

  // --- Find Nodes ---
  const parentNode = findNodeById(hierarchyData, selectedParentId);
  const childNodes = parentNode?.children || []; // Data for the Swiper
  const currentChildNode = findNodeById(childNodes, selectedChildId);
  const grandchildNodes = currentChildNode?.children || []; // Data for grandchild buttons

  // --- Swiper Logic ---
  const initialSlideIndex = Math.max(
    0,
    childNodes.findIndex((node) => node?.id === selectedChildId)
  );

  // Effect to update swiper when selectedChildId changes EXTERNALLY (e.g., parent change)
  useEffect(() => {
    const newIndex = childNodes.findIndex(
      (node) => node?.id === selectedChildId
    );
    if (
      swiperRef.current &&
      newIndex !== -1 &&
      newIndex !== swiperRef.current.activeIndex
    ) {
      console.log(
        `JournalHierarchySlider (${sliderId}): External child change detected. Sliding to index ${newIndex}`
      );
      swiperRef.current.slideTo(newIndex);
    }
  }, [selectedChildId, childNodes, sliderId]); // Re-run if selected child or the list of children changes

  const handleSwiperChange = (swiper) => {
    const currentRealIndex = swiper.activeIndex;
    if (
      childNodes &&
      childNodes.length > currentRealIndex &&
      childNodes[currentRealIndex]
    ) {
      const newChildId = childNodes[currentRealIndex].id;
      console.log(
        `JournalHierarchySlider (${sliderId}): Swipe Change. Index: ${currentRealIndex}, New Child ID: ${newChildId}`
      );
      // Call the callback passed from Home to update state
      onSelectChild(newChildId);
    } else {
      console.warn(
        `JournalHierarchySlider (${sliderId}): Swipe Change - Invalid index (${currentRealIndex}) or childNodes. Len: ${childNodes?.length}`
      );
    }
  };

  // Key for Swiper based on parent (to recreate if parent changes drastically)
  // and childNodes length to handle potential data loading issues.
  const swiperKey = `${sliderId}-parent-${selectedParentId}-len${childNodes.length}-activeChild${selectedChildId}`;

  return (
    <>
      {/* Parent Display (Example placement) */}
      <div className={styles.journalParentHeader}>
        <span className={styles.journalParentInfo}>
          {parentNode
            ? `${parentNode.code} - ${parentNode.name}`
            : "Select Parent"}
        </span>
        {/* Button to open modal is now in Home component's controls section */}
      </div>

      <h2 className={styles.sliderTitle}>{title} - Level 2 (Children)</h2>

      {childNodes.length > 0 ? (
        <Swiper
          key={swiperKey}
          ref={swiperRef} // Assign ref
          modules={[Navigation, Pagination]}
          initialSlide={initialSlideIndex}
          loop={false}
          spaceBetween={20}
          slidesPerView={1}
          navigation={childNodes.length > 1}
          pagination={childNodes.length > 1 ? { clickable: true } : false}
          onSlideChangeTransitionEnd={handleSwiperChange}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }} // Store swiper instance
          observer={true}
          observeParents={true}
          className={`${styles.swiperInstance} ${styles.journalSwiperInstance}`} // Add specific class if needed
        >
          {childNodes.map((childNode) => {
            if (!childNode) return null; // Safety check

            // Find grandchildren specific to *this* child slide
            const currentGrandchildren = childNode.children || [];

            return (
              <SwiperSlide key={childNode.id} className={styles.slide}>
                {/* Grandchild Buttons Container (Above Name) */}
                <div className={styles.grandchildButtonsContainer}>
                  {currentGrandchildren.slice(0, 2).map(
                    (
                      gc // Example: Max 2 above
                    ) => (
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
                    )
                  )}
                </div>

                {/* Child Name */}
                <div className={styles.slideTextContent}>
                  <span className={styles.slideName}>
                    {childNode.name || childNode.id || "Unnamed Child"}
                  </span>
                  <span className={styles.slideSubText}>{childNode.code}</span>
                </div>

                {/* Grandchild Buttons Container (Below Name) */}
                <div className={styles.grandchildButtonsContainer}>
                  {currentGrandchildren.slice(2).map(
                    (
                      gc // Example: Rest below
                    ) => (
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
                    )
                  )}
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      ) : (
        <div className={styles.noData}>
          No child accounts under '{parentNode?.name || "selected parent"}'.
        </div>
      )}

      {/* Accordion Section (Displays details of the SELECTED CHILD) */}
      {currentChildNode && (
        <div className={styles.accordionContainer}>
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
                // ... accordion animation props ...
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
                  {/* Add more details if available */}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

const SLIDER_CONFIG = {
  [SLIDER_TYPES.JOURNAL]: {
    Component: JournalHierarchySlider,
    title: "Journal",
  },
  [SLIDER_TYPES.PARTNER]: { Component: DynamicSlider, title: "Partner" },
  [SLIDER_TYPES.GOODS]: { Component: DynamicSlider, title: "Goods" },
  [SLIDER_TYPES.PROJECT]: { Component: DynamicSlider, title: "Project" }, // New
  [SLIDER_TYPES.DOCUMENT]: { Component: DynamicSlider, title: "Document" }, // New
};

const INITIAL_ORDER = [
  SLIDER_TYPES.JOURNAL,
  SLIDER_TYPES.PARTNER,
  SLIDER_TYPES.GOODS,
  SLIDER_TYPES.PROJECT,
  SLIDER_TYPES.DOCUMENT,
];

// Removed ALLOWED_ORDERS and isOrderAllowed

const JOURNAL_ICONS = {
  J01: IoCartOutline, // Example ID mapping
  J02: IoPricetagOutline, // Example ID mapping
  J03: IoBuildOutline, // Example ID mapping
  // Add more mappings based on your actual Journal IDs
};

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
  // Calculate initialSlide index based on current props for THIS render
  const initialSlideIndex = Math.max(
    0,
    data.findIndex((item) => item?.id === activeItemId)
  );
  console.log(
    `DynamicSlider Render (${sliderId}): ActiveItemID Prop: ${activeItemId}, Initial Index Calc: ${initialSlideIndex}, Data length: ${data.length}`
  );

  const handleSwiperChange = (swiper) => {
    const currentRealIndex = swiper.activeIndex; // Simplified
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

  // Find Current Item for Accordion
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

  // SIMPLE Key for Swiper
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
            if (!item) return null; // Safety check
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
                  {/* Display name, handle cases where name might not exist directly */}
                  <span className={styles.slideName}>
                    {item.name || item.id || "Unnamed Item"}
                  </span>
                  {/* Add specific subtext if available and needed */}
                  {sliderId === SLIDER_TYPES.GOODS && item.unit_code && (
                    <span className={styles.slideSubText}>
                      {item.unit_code}
                    </span>
                  )}
                  {/* ... other potential subtext ... */}
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      ) : (
        <div className={styles.noData}>No items match criteria.</div>
      )}
      {/* Accordion Section */}
      {currentItemForAccordion && (
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
                  {/* Display details available on the item */}
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
                  {/* Add more details specific to type if needed */}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

// --- MODIFIED: Recursive component to render each node ---
// --- MODIFIED: Recursive component to render each node ---
// --- MODIFIED: Recursive component to render each node ---
function AccountNode({
  node,
  level = 0,
  openNodes,
  toggleNode,
  selectedAccountId,
  onSelectNode,
}) {
  const isOpen = openNodes[node.id] ?? false;
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedAccountId;

  const handleRowClick = () => {
    onSelectNode(node.id); // Always select
    if (hasChildren) {
      toggleNode(node.id); // Toggle if children exist
    }
  };

  return (
    // Use a fragment or simple div, no specific container style needed unless desired
    <>
      {/* Clickable row */}
      <div
        className={`${styles.accountNodeRow} ${
          isSelected ? styles.accountNodeSelected : ""
        }`}
        style={{ paddingLeft: `${level * 25}px` }} // Indentation applied here
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isOpen : undefined}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && handleRowClick()
        }
      >
        {/* Toggle Icon */}
        <span className={styles.accountNodeToggle} aria-hidden="true">
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
        {/* Account Info */}
        <span className={styles.accountNodeCode}>{node.code}</span>
        <span className={styles.accountNodeName}>{node.name}</span>
      </div>

      {/* --- Children Rendering Section - Ensure Structure is Correct --- */}
      <div className={styles.accountNodeChildrenContainer}>
        {" "}
        {/* Optional: Wrapper for styling children block */}
        <AnimatePresence initial={false}>
          {hasChildren &&
            isOpen && ( // Condition MUST be here
              <motion.div
                key={`${node.id}-children`} // Key is essential
                initial="collapsed"
                animate="open"
                exit="collapsed"
                variants={{
                  // Explicitly define variants
                  open: { opacity: 1, height: "auto" },
                  collapsed: { opacity: 0, height: 0 },
                }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                // Style for animation and hierarchy line
                style={{
                  overflow: "hidden",
                  // Apply paddingLeft instead of margin for border alignment
                  paddingLeft: `${level * 25 + 20}px`, // Align with text start
                  position: "relative", // Needed for pseudo-element line
                }}
                // Add pseudo-element for the vertical line if desired
                className={styles.accountNodeChildrenMotionWrapper}
              >
                {/* Vertical line using pseudo-element */}
                {/* Render children recursively */}
                {node.children.map((childNode) => (
                  <AccountNode
                    key={childNode.id}
                    node={childNode}
                    level={level + 1}
                    openNodes={openNodes}
                    toggleNode={toggleNode}
                    selectedAccountId={selectedAccountId}
                    onSelectNode={onSelectNode}
                  />
                ))}
              </motion.div>
            )}
        </AnimatePresence>
      </div>
      {/* --- End Children Rendering Section --- */}
    </>
  );
}
// page.js
// ... other imports, components etc ...

// --- JournalModal Component (CORRECTED) ---
function JournalModal({ isOpen, onClose, onConfirmSelection, hierarchy = [] }) {
  // Props: onClose, onConfirmSelection
  const [openNodes, setOpenNodes] = useState({});
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  const toggleNode = useCallback((nodeId) => {
    setOpenNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }, []);

  const handleSelectNode = useCallback((nodeId) => {
    setSelectedAccountId(nodeId);
    console.log("Selected Account Node ID:", nodeId);
  }, []);

  // This is the INTERNAL click handler for the "Select" button
  const handleConfirmSelectionClick = () => {
    if (selectedAccountId) {
      console.log("Modal Confirm Button Clicked. ID:", selectedAccountId);
      // Call the CALLBACK PROP passed from Home component
      if (onConfirmSelection) {
        onConfirmSelection(selectedAccountId); // Call the prop function
      }
      onClose(); // Close the modal using the onClose prop
    } else {
      console.log("Modal Confirm Button Clicked, but no account selected.");
    }
  };

  const handleAddNew = () => {
    console.log("Add New Account Clicked");
    // Logic for adding new account would go here
    onClose(); // Close modal for now
  };

  // Reset states when modal closes/opens
  useEffect(() => {
    if (!isOpen) {
      setOpenNodes({});
      setSelectedAccountId(null);
    }
    // Optionally reset scroll position of hierarchy container on open
    // const container = document.querySelector(`.${styles.accountHierarchyContainer}`);
    // if (isOpen && container) {
    //     container.scrollTop = 0;
    // }
  }, [isOpen]);

  return (
    // Use motion.div for the overlay to animate it
    <motion.div
      className={styles.modalOverlay}
      onClick={onClose} // Close on overlay click
      key="journal-modal-overlay" // More specific key
      initial="closed"
      animate="open"
      exit="closed"
      variants={{
        open: { opacity: 1 },
        closed: { opacity: 0 },
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Use motion.div for the content */}
      <motion.div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
        key="journal-modal-content" // More specific key
        variants={{
          open: {
            opacity: 1,
            scale: 1,
            transition: { delay: 0.1, duration: 0.3 },
          },
          closed: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
        }}
        // Inherits initial/animate/exit from parent overlay
      >
        <button
          className={styles.modalCloseButton}
          onClick={onClose} // Use onClose prop
          aria-label="Close modal"
        >
          ×
        </button>
        <h2>Select Journal Account Category</h2> {/* Updated Title */}
        {/* Hierarchy List */}
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
              />
            ))
          ) : (
            <p>No hierarchy data available.</p>
          )}
        </div>
        {/* Action Buttons */}
        <div className={styles.modalActions}>
          <button
            className={`${styles.modalButtonSecondary} ${styles.modalActionButton}`}
            onClick={handleAddNew}
          >
            <IoAddCircleOutline /> Add New
          </button>
          <button
            className={`${styles.modalButtonPrimary} ${styles.modalActionButton}`}
            // *** ENSURE THIS onClick CALLS the INTERNAL handler ***
            onClick={handleConfirmSelectionClick}
            disabled={!selectedAccountId}
          >
            <IoCheckmarkCircleOutline /> Select Category {/* Updated Label */}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
// --- END JournalModal ---

// ... rest of your page.js (Home component etc.)
// --- Main Page Component ---
export default function Home() {
  // === State ===
  const [sliderOrder, setSliderOrder] = useState(INITIAL_ORDER);
  const [activeDataSource, setActiveDataSource] = useState("data1");
  // Load initial data - adjust based on where your structured data comes from
  const [activeDataSet, setActiveDataSet] = useState(initialData1);

  // --- Selections ---
  // !! Journal Selection State Overhaul !!
  const initialParentId = "cat-6"; // Default Parent
  const [selectedParentJournalId, setSelectedParentJournalId] =
    useState(initialParentId);

  // Find initial child and grandchild based on parent
  const getInitialChildAndGrandchild = useCallback((parentId, dataset) => {
    const parentNode = findNodeById(dataset?.account_hierarchy, parentId);
    const firstChild = parentNode?.children?.[0];
    const firstGrandchild = firstChild?.children?.[0];
    return {
      childId: firstChild?.id || null,
      grandchildId: firstGrandchild?.id || null,
    };
  }, []); // No dependencies needed, it's a pure function of its args

  const { childId: initialChildId, grandchildId: initialGrandchildId } =
    getInitialChildAndGrandchild(initialParentId, activeDataSet);

  const [selectedChildJournalId, setSelectedChildJournalId] =
    useState(initialChildId);
  const [selectedGrandchildJournalId, setSelectedGrandchildJournalId] =
    useState(initialGrandchildId);

  const [selectedPartnerId, setSelectedPartnerId] = useState(() =>
    getFirstId(activeDataSet?.partners)
  );
  const [selectedGoodsId, setSelectedGoodsId] = useState(() =>
    getFirstId(activeDataSet?.goods)
  );
  const [selectedProjectId, setSelectedProjectId] = useState(
    "project-placeholder"
  ); // Placeholder ID
  const [selectedDocumentId, setSelectedDocumentId] = useState(
    "document-placeholder"
  ); // Placeholder ID

  // --- Displayed Data (Filtered) ---
  const placeholderProjectData = [
    { id: "project-placeholder", name: "Sample Project" },
  ];
  const placeholderDocumentData = [
    { id: "document-placeholder", name: "Specification Doc" },
  ];

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

  // --- UI State ---
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

  // --- NEW: Ref for Visibility Swiper ---
  const visibilitySwiperRef = useRef(null);

  // --- NEW: Effect to update Visibility Swiper on Order Change ---
  useEffect(() => {
    if (visibilitySwiperRef.current) {
      console.log("Updating visibility swiper due to order change.");
      // Give Swiper a chance to recognize the new DOM structure after React render
      requestAnimationFrame(() => {
        visibilitySwiperRef.current?.update();
        // Optional: Reset scroll position if needed, although loop might handle this
        // visibilitySwiperRef.current?.slideToLoop(0, 0);
      });
    }
  }, [sliderOrder]); // Re-run when sliderOrder changes

  // === Handlers ===
  const handleDataSourceChange = (event) => {
    const newSourceKey = event.target.value;
    if (newSourceKey === activeDataSource) return;
    const newDataSet = newSourceKey === "data1" ? initialData1 : initialData2;

    setActiveDataSource(newSourceKey);
    setActiveDataSet(newDataSet);

    // Reset Journal selections based on new dataset
    const newInitialParentId = "cat-6"; // Or derive differently if needed
    const { childId: newChildId, grandchildId: newGrandchildId } =
      getInitialChildAndGrandchild(newInitialParentId, newDataSet);
    setSelectedParentJournalId(newInitialParentId);
    setSelectedChildJournalId(newChildId);
    setSelectedGrandchildJournalId(newGrandchildId);

    // Reset displayed data
    setDisplayedJournals(newDataSet?.journals || []);
    setDisplayedPartners(newDataSet?.partners || []);
    setDisplayedGoods(newDataSet?.goods || []);
    setDisplayedProjects(placeholderProjectData);
    setDisplayedDocuments(placeholderDocumentData);

    // Reset UI state
    setSliderOrder(INITIAL_ORDER);
    setVisibility({
      [SLIDER_TYPES.JOURNAL]: true,
      [SLIDER_TYPES.PARTNER]: true,
      [SLIDER_TYPES.GOODS]: true,
      [SLIDER_TYPES.PROJECT]: false,
      [SLIDER_TYPES.DOCUMENT]: false,
    });
    setAccordionTypeState({
      [SLIDER_TYPES.JOURNAL]: false,
      [SLIDER_TYPES.PARTNER]: false,
      [SLIDER_TYPES.GOODS]: false,
      [SLIDER_TYPES.PROJECT]: false,
      [SLIDER_TYPES.DOCUMENT]: false,
    });
    setIsJournalModalOpen(false);
  };

  const openJournalModal = useCallback(() => setIsJournalModalOpen(true), []);
  const closeJournalModal = useCallback(() => setIsJournalModalOpen(false), []);

  // === Filtering useEffect ===
  // Needs careful review regarding which Journal ID to use for filtering
  useEffect(() => {
    console.log(
      "%c--- useEffect START (Filter Logic - NEEDS UPDATE for Journal Hierarchy) ---",
      "color: blue; font-weight: bold;"
    );
    console.log("Order:", sliderOrder.join(" -> "));
    console.log("Selections:", {
      ParentJ: selectedParentJournalId,
      ChildJ: selectedChildJournalId,
      GrandchildJ: selectedGrandchildJournalId,
      P: selectedPartnerId,
      G: selectedGoodsId,
      Pr: selectedProjectId,
      D: selectedDocumentId,
    });

    // --- !!! Placeholder Filtering Logic - NEEDS UPDATE !!! ---
    // Determine which Journal ID (parent, child, grandchild) is relevant for filtering
    // For now, let's assume the CHILD ID is the primary filter key from Journal
    const activeJournalFilterId = selectedChildJournalId; // Or maybe grandchild?

    // `finalFilteredJournals` is no longer needed as a separate list here.
    // The JournalHierarchySlider derives its display data from the hierarchy.
    let finalFilteredPartners = activeDataSet?.partners || [];
    let finalFilteredGoods = activeDataSet?.goods || [];
    const finalFilteredProjects = placeholderProjectData; // Assuming these are static for now
    const finalFilteredDocuments = placeholderDocumentData; // Assuming these are static for now

    // --- !!! START REPLACEMENT SECTION FOR DB LOGIC (Placeholder) !!! ---
    // PSEUDOCODE - NEEDS REAL IMPLEMENTATION based on `activeJournalFilterId`,
    // `selectedPartnerId`, `selectedGoodsId`, and `sliderOrder`.
    // This logic would potentially filter `finalFilteredPartners`, `finalFilteredGoods`,
    // and maybe even indirectly affect which parts of the hierarchy are *valid*
    // (though the current structure doesn't directly support filtering the hierarchy itself easily).

    /*
    const selections = {
        [SLIDER_TYPES.JOURNAL]: activeJournalFilterId, // Use the relevant journal ID
        [SLIDER_TYPES.PARTNER]: selectedPartnerId,
        [SLIDER_TYPES.GOODS]: selectedGoodsId,
        // ...
    };

    let currentFilteredData = {
        [SLIDER_TYPES.PARTNER]: activeDataSet?.partners || [],
        [SLIDER_TYPES.GOODS]: activeDataSet?.goods || [],
        [SLIDER_TYPES.PROJECT]: finalFilteredProjects,
        [SLIDER_TYPES.DOCUMENT]: finalFilteredDocuments,
    };


    for (let i = 0; i < sliderOrder.length; i++) {
        const targetSlider = sliderOrder[i];
        if (targetSlider === SLIDER_TYPES.JOURNAL) continue; // Skip Journal itself for filtering its internal list

        let potentialData = [...currentFilteredData[targetSlider]];

        for (let j = 0; j < i; j++) {
             const sourceSlider = sliderOrder[j];
             const sourceSelectionId = selections[sourceSlider];
             if (!sourceSelectionId) continue;

             // !!! IMPLEMENT ACTUAL FILTERING RULES HERE !!!
             // Example: Filter Partners based on Journal selection
             // if (sourceSlider === SLIDER_TYPES.JOURNAL && targetSlider === SLIDER_TYPES.PARTNER) {
             //    potentialData = filterPartnersByJournal(potentialData, sourceSelectionId, activeDataSet.journal_partner_links);
             // }
             // // Example: Filter Goods based on Journal AND Partner selections
             // if (targetSlider === SLIDER_TYPES.GOODS) {
             //    const journalSel = selections[SLIDER_TYPES.JOURNAL];
             //    const partnerSel = selections[SLIDER_TYPES.PARTNER];
             //    if (sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) < i && sliderOrder.indexOf(SLIDER_TYPES.PARTNER) < i) {
             //       potentialData = filterGoodsByJournalAndPartner(potentialData, journalSel, partnerSel, activeDataSet.valid_combinations);
             //    } else if (sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) < i) {
             //       potentialData = filterGoodsByJournal(potentialData, journalSel, activeDataSet.journal_good_links);
             //    } // etc.
             // }


             if (potentialData.length === 0) break;
         }
         currentFilteredData[targetSlider] = potentialData;
    }

    finalFilteredPartners = currentFilteredData[SLIDER_TYPES.PARTNER];
    finalFilteredGoods = currentFilteredData[SLIDER_TYPES.GOODS];
    // Update Project/Document if they become filterable
    // finalFilteredProjects = currentFilteredData[SLIDER_TYPES.PROJECT];
    // finalFilteredDocuments = currentFilteredData[SLIDER_TYPES.DOCUMENT];
    */
    // --- !!! END REPLACEMENT SECTION FOR DB LOGIC !!! ---

    // --- Final State Update ---
    console.log(
      "%cSetting Displayed State (Excluding Journal)",
      "color: orange;"
    );
    // Remove the check and update for displayedJournals
    // if (JSON.stringify(displayedJournals) !== JSON.stringify(finalFilteredJournals)) // REMOVED
    //  setDisplayedJournals(finalFilteredJournals); // REMOVED

    if (
      JSON.stringify(displayedPartners) !==
      JSON.stringify(finalFilteredPartners)
    )
      setDisplayedPartners(finalFilteredPartners);
    if (JSON.stringify(displayedGoods) !== JSON.stringify(finalFilteredGoods))
      setDisplayedGoods(finalFilteredGoods);

    // Update Project/Document if their data changes based on filtering
    // IMPORTANT: Only update if they actually changed to avoid loops
    if (
      JSON.stringify(displayedProjects) !==
      JSON.stringify(finalFilteredProjects)
    )
      setDisplayedProjects(finalFilteredProjects);
    if (
      JSON.stringify(displayedDocuments) !==
      JSON.stringify(finalFilteredDocuments)
    )
      setDisplayedDocuments(finalFilteredDocuments);

    // --- Selection Reset Check ---
    // Journal reset logic needs refinement. For now, rely on selection handlers.
    // The primary concern is if the selected *other* items become invalid due to a Journal change.
    console.log(
      "%c--- Checking Selections (Excluding Journal Reset for now) ---",
      "color: purple;"
    );
    let resetTriggered = false;

    // Check Partner validity against the newly filtered list
    if (
      !resetTriggered && // Only reset one thing at a time to avoid cascading resets in one cycle
      selectedPartnerId &&
      !finalFilteredPartners.some((p) => p?.id === selectedPartnerId)
    ) {
      const newSelection = getFirstId(finalFilteredPartners);
      console.warn(
        `!!! Resetting Partner selection to ${newSelection} (was ${selectedPartnerId}) due to filter change.`
      );
      setSelectedPartnerId(newSelection);
      resetTriggered = true;
    }
    // Check Goods validity against the newly filtered list
    if (
      !resetTriggered &&
      selectedGoodsId &&
      !finalFilteredGoods.some((g) => g?.id === selectedGoodsId)
    ) {
      const newSelection = getFirstId(finalFilteredGoods);
      console.warn(
        `!!! Resetting Goods selection to ${newSelection} (was ${selectedGoodsId}) due to filter change.`
      );
      setSelectedGoodsId(newSelection);
      resetTriggered = true;
    }
    // Add checks for Project/Document if they become filterable and resettable
    if (
      !resetTriggered &&
      selectedProjectId &&
      !finalFilteredProjects.some((proj) => proj?.id === selectedProjectId)
    ) {
      const newSelection = getFirstId(finalFilteredProjects);
      console.warn(
        `!!! Resetting Project selection to ${newSelection} (was ${selectedProjectId}) due to filter change.`
      );
      setSelectedProjectId(newSelection);
      resetTriggered = true;
    }
    if (
      !resetTriggered &&
      selectedDocumentId &&
      !finalFilteredDocuments.some((doc) => doc?.id === selectedDocumentId)
    ) {
      const newSelection = getFirstId(finalFilteredDocuments);
      console.warn(
        `!!! Resetting Document selection to ${newSelection} (was ${selectedDocumentId}) due to filter change.`
      );
      setSelectedDocumentId(newSelection);
      resetTriggered = true;
    }

    console.log("%c--- useEffect END ---", "color: blue; font-weight: bold;");
  }, [
    sliderOrder,
    // Journal dependencies:
    selectedParentJournalId,
    selectedChildJournalId,
    selectedGrandchildJournalId,
    // Other dependencies:
    selectedPartnerId,
    selectedGoodsId,
    selectedProjectId,
    selectedDocumentId,
    activeDataSet,
    // State setters are stable, no need to include them
    // Avoid displayedXYZ states here unless absolutely needed for a specific comparison logic
    displayedPartners, // Need to include if comparing against previous state
    displayedGoods, // Need to include if comparing against previous state
    displayedProjects, // Need to include if comparing against previous state
    displayedDocuments, // Need to include if comparing against previous state
  ]);

  // === Event Handlers ===
  const handleSwipe = useCallback(
    (sourceSliderId, selectedItemId) => {
      console.log(`Swipe: ${sourceSliderId}, New ID: ${selectedItemId}`);
      if (sourceSliderId === SLIDER_TYPES.JOURNAL) {
        // This now means the *child* has changed via Swiper
        setSelectedChildJournalId(selectedItemId);
        // Reset grandchild to the first one of the new child
        const childNode = findNodeById(
          activeDataSet?.account_hierarchy,
          selectedItemId
        );
        const firstGrandchild = childNode?.children?.[0];
        setSelectedGrandchildJournalId(firstGrandchild?.id || null);
        console.log(
          ` -> Journal Child: ${selectedItemId}, Reset Grandchild: ${
            firstGrandchild?.id || null
          }`
        );
      } else if (sourceSliderId === SLIDER_TYPES.PARTNER)
        setSelectedPartnerId(selectedItemId);
      // ... rest of handleSwipe
    },
    [activeDataSet]
  ); // Added activeDataSet dependency for findNodeById

  // NEW: Handler for grandchild button clicks
  const handleSelectGrandchildJournal = useCallback((grandchildId) => {
    console.log("Grandchild Selected:", grandchildId);
    setSelectedGrandchildJournalId(grandchildId);
  }, []);

  // NEW: Handler for when modal confirms a new PARENT selection
  const handleSelectParentJournal = useCallback(
    (parentId) => {
      console.log("New Parent Selected:", parentId);
      setSelectedParentJournalId(parentId);
      // Reset child and grandchild based on the new parent
      const { childId: newChildId, grandchildId: newGrandchildId } =
        getInitialChildAndGrandchild(parentId, activeDataSet);
      setSelectedChildJournalId(newChildId);
      setSelectedGrandchildJournalId(newGrandchildId);
      console.log(
        ` -> New Child: ${newChildId}, New Grandchild: ${newGrandchildId}`
      );
    },
    [activeDataSet, getInitialChildAndGrandchild]
  ); // Dependencies

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
  }, []); // Depends only on setAccordionTypeState which is stable

  const toggleVisibility = useCallback((sliderId) => {
    if (!sliderId || !SLIDER_CONFIG[sliderId]) return;
    setVisibility((prev) => ({ ...prev, [sliderId]: !prev[sliderId] }));
    // Update swiper after a short delay AFTER state change allows render
    setTimeout(() => {
      visibilitySwiperRef.current?.update();
    }, 50); // Small delay helps swiper recalc layout
  }, []);

  // --- MODIFIED moveSlider ---
  const moveSlider = useCallback(
    (sliderId, direction) => {
      // Use functional update to ensure we have the latest order and visibility
      setSliderOrder((currentOrder) => {
        const currentIndex = currentOrder.indexOf(sliderId);

        // Should not happen in practice, but good safeguard
        if (currentIndex === -1 || !visibility[sliderId]) {
          console.warn(
            `moveSlider called for invalid or hidden sliderId: ${sliderId}`
          );
          return currentOrder;
        }

        let targetIndex = -1;

        // Find the *next visible* slider index in the desired direction
        if (direction === "up") {
          for (let i = currentIndex - 1; i >= 0; i--) {
            const potentialTargetId = currentOrder[i];
            if (visibility[potentialTargetId]) {
              // Check if the potential target is visible
              targetIndex = i;
              break; // Found the first visible item above
            }
          }
        } else {
          // direction === "down"
          for (let i = currentIndex + 1; i < currentOrder.length; i++) {
            const potentialTargetId = currentOrder[i];
            if (visibility[potentialTargetId]) {
              // Check if the potential target is visible
              targetIndex = i;
              break; // Found the first visible item below
            }
          }
        }

        // If no visible target was found (already at the edge relative to visible items)
        if (targetIndex === -1) {
          console.log(
            `moveSlider: No visible target found for ${sliderId} in direction ${direction}.`
          );
          return currentOrder; // No change needed
        }

        // Create a new array and perform the swap
        const newOrder = [...currentOrder];
        // Swap the slider being moved with the found visible target slider
        [newOrder[currentIndex], newOrder[targetIndex]] = [
          newOrder[targetIndex],
          newOrder[currentIndex],
        ];

        console.log(
          `moveSlider: Order changed from ${currentOrder.join(
            " -> "
          )} to ${newOrder.join(" -> ")}`
        );
        return newOrder; // Return the updated order
      });
    },
    [visibility]
  ); // Add visibility as a dependency!

  // --- MODIFIED getSliderProps ---
  const getSliderProps = (sliderId) => {
    switch (sliderId) {
      case SLIDER_TYPES.JOURNAL:
        // Props for JournalHierarchySlider
        return {
          hierarchyData: activeDataSet?.account_hierarchy || [],
          selectedParentId: selectedParentJournalId,
          selectedChildId: selectedChildJournalId,
          selectedGrandchildId: selectedGrandchildJournalId,
          onSelectChild: (childId) =>
            handleSwipe(SLIDER_TYPES.JOURNAL, childId), // Reuse handleSwipe logic for child change
          onSelectGrandchild: handleSelectGrandchildJournal,
          onOpenModal: openJournalModal, // To open the selection modal
        };
      case SLIDER_TYPES.PARTNER:
        return { data: displayedPartners, activeItemId: selectedPartnerId };
      case SLIDER_TYPES.GOODS:
        return { data: displayedGoods, activeItemId: selectedGoodsId };
      case SLIDER_TYPES.PROJECT:
        return { data: displayedProjects, activeItemId: selectedProjectId };
      case SLIDER_TYPES.DOCUMENT:
        return { data: displayedDocuments, activeItemId: selectedDocumentId };
      default:
        return { data: [], activeItemId: null }; // Or specific props for default
    }
  };

  // === Render ===
  return (
    <div className={styles.pageContainer}>
      {/* Page Title */}
      <h1 className={styles.title}>Project Interface</h1>

      {/* Sticky Header Container */}
      <div className={styles.stickyHeaderContainer}>
        {/* Data Source Selector */}
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

        {/* Visibility Toggles Swiper */}
        <LayoutGroup id="visibility-toggles-layout">
          <div className={styles.visibilitySwiperContainer}>
            <Swiper
              modules={[Navigation]}
              spaceBetween={10}
              slidesPerView={"auto"}
              centeredSlides={false}
              loop={false} // Keep loop disabled for accurate indexing representation
              className={styles.visibilitySwiper}
              onSwiper={(swiper) => {
                visibilitySwiperRef.current = swiper;
              }}
              observer={true}
              observeParents={true}
              // navigation // Optional: Add Prev/Next buttons
            >
              {sliderOrder.map((sliderId, index) => {
                const config = SLIDER_CONFIG[sliderId];
                const title = config?.title || sliderId;
                const isCurrentlyVisible = visibility[sliderId];

                // Calculate visible index (for display purposes only)
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
                      layout // Animate layout changes from reordering
                      layoutId={`visibility-${sliderId}`} // Use a distinct layoutId prefix for this group
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
                        {/* Show number only if visible */}
                        {isCurrentlyVisible ? `${visibleIndex + 1}: ` : ""}
                        {title}
                      </button>
                      {/* Arrow: Render always but maybe fade with button? */}
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
        {/* End Visibility Toggles Swiper */}
      </div>
      {/* End Sticky Header Container */}

      {/* Main Sliders Area */}
      {/* Use a DIFFERENT LayoutGroup ID or remove ID if nesting causes issues */}
      <LayoutGroup id="main-sliders-layout-group">
        <div className={styles.slidersArea}>
          <AnimatePresence initial={false}>
            {sliderOrder.map((sliderId, index) => {
              // Render logic checks visibility state BEFORE rendering
              if (!visibility[sliderId]) return null;

              const config = SLIDER_CONFIG[sliderId];
              // Ensure config exists before destructuring
              if (!config) {
                console.error(
                  `Configuration missing for sliderId: ${sliderId}`
                );
                return null;
              }
              const { Component, title: sliderTitle } = config;

              // Get props using the updated function, specific to the slider type
              const sliderSpecificProps = getSliderProps(sliderId);

              // Common UI state/logic
              const isAccordionOpenForType = accordionTypeState[sliderId];
              const onToggleAccordionCallback = () => toggleAccordion(sliderId);

              // Determine if move buttons should be enabled based on VISIBLE items
              // Calculate visible index within the currently visible sliders
              const visibleOrder = sliderOrder.filter((id) => visibility[id]);
              const currentVisibleIndex = visibleOrder.indexOf(sliderId);
              const canMoveUp = currentVisibleIndex > 0;
              const canMoveDown = currentVisibleIndex < visibleOrder.length - 1;

              // Callback for standard sliders (non-Journal)
              const onSlideChangeCallback =
                sliderId !== SLIDER_TYPES.JOURNAL
                  ? (id) => handleSwipe(sliderId, id)
                  : undefined; // JournalHierarchySlider uses onSelectChild prop

              return (
                <motion.div
                  key={sliderId} // Key for React map
                  layoutId={sliderId} // ID tracked within *this* group
                  layout // Enable layout animation
                  style={{ order: index }} // Apply visual order based on full sliderOrder
                  initial={{ opacity: 0, height: 0, y: 20 }} // Added slight Y animation
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }} // Added slight Y animation
                  transition={{
                    opacity: { duration: 0.3, ease: "easeInOut" },
                    height: { duration: 0.3, ease: "easeInOut" },
                    y: { duration: 0.3, ease: "easeInOut" },
                    layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }, // Smoother layout easing
                  }}
                  className={styles.sliderWrapper}
                >
                  {/* Controls */}
                  <div className={styles.controls}>
                    {/* Edit Button */}
                    <button
                      onClick={
                        // Use the specific onOpenModal from props if it exists (for Journal), otherwise default
                        sliderSpecificProps.onOpenModal
                          ? sliderSpecificProps.onOpenModal
                          : () => console.log(`Options clicked for ${sliderId}`)
                      }
                      className={`${styles.controlButton} ${styles.editButton}`}
                      aria-label={`Options for ${sliderTitle}`} // More generic label
                      title={`Options for ${sliderTitle}`}
                    >
                      <IoOptionsOutline />
                    </button>

                    {/* Parent Info Display for Journal - RENDERED INSIDE JournalHierarchySlider */}
                    {/* {sliderId === SLIDER_TYPES.JOURNAL && (
                        <span className={styles.journalParentInfo}>
                            {parentNode ? `${parentNode.code} - ${parentNode.name}` : 'Select Parent'}
                        </span>
                    )} */}

                    {/* Move Buttons */}
                    <div className={styles.moveButtonGroup}>
                      {canMoveUp && (
                        <button
                          onClick={() => moveSlider(sliderId, "up")}
                          className={styles.controlButton}
                          aria-label={`Move ${sliderTitle} up`}
                          // disabled={!canMoveUp} // Use CSS if preferred
                        >
                          ▲ Up
                        </button>
                      )}
                      {/* Add spacer if only one button is visible */}
                      {/* {(!canMoveUp && canMoveDown) && <div style={{width: '60px'}}></div>} */}
                      {canMoveDown && (
                        <button
                          onClick={() => moveSlider(sliderId, "down")}
                          className={styles.controlButton}
                          aria-label={`Move ${sliderTitle} down`}
                          // disabled={!canMoveDown} // Use CSS if preferred
                        >
                          ▼ Down
                        </button>
                      )}
                      {/* Add spacer if only one button is visible */}
                      {/* {(!canMoveDown && canMoveUp) && <div style={{width: '60px'}}></div>} */}
                    </div>
                  </div>

                  {/* Render the correct component with its specific props */}
                  {/* Component receives sliderId, title automatically */}
                  <Component
                    sliderId={sliderId}
                    title={sliderTitle} // Pass title explicitly if needed by component
                    // Spread the specific props fetched for this slider type
                    {...sliderSpecificProps}
                    // Pass common props needed by all slider types
                    // Note: DynamicSlider expects 'data' and 'activeItemId' which are inside sliderSpecificProps
                    onSlideChange={onSlideChangeCallback} // Only for non-journal sliders
                    isAccordionOpen={isAccordionOpenForType}
                    onToggleAccordion={onToggleAccordionCallback}
                    // Pass any other common props needed by BOTH slider types here
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>
      {/* --- END Main Sliders LayoutGroup --- */}

      {/* --- Journal Modal --- */}
      <AnimatePresence>
        {/* Conditionally render based on state */}
        {isJournalModalOpen && (
          <JournalModal
            // key="journal-modal-instance" // Key can sometimes help AnimatePresence
            isOpen={isJournalModalOpen} // Pass state down
            onClose={closeJournalModal}
            onConfirmSelection={handleSelectParentJournal} // Handler to update parent state
            hierarchy={activeDataSet?.account_hierarchy || []} // Pass the hierarchy data
          />
        )}
      </AnimatePresence>
      {/* --- END AnimatePresence Wrapper --- */}
    </div> // End pageContainer
  );
} // End Home component
