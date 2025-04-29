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

// --- Constants ---
const SLIDER_TYPES = {
  JOURNAL: "journal",
  PARTNER: "partner",
  GOODS: "goods",
  PROJECT: "project", // New
  DOCUMENT: "document", // New
};

const SLIDER_CONFIG = {
  [SLIDER_TYPES.JOURNAL]: { Component: DynamicSlider, title: "Journal" },
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
// --- MODIFIED: JournalModal Component ---
function JournalModal({ isOpen, onClose, hierarchy = [] }) {
  const [openNodes, setOpenNodes] = useState({});
  const [selectedAccountId, setSelectedAccountId] = useState(null); // NEW: Track selected node ID

  const toggleNode = useCallback((nodeId) => {
    setOpenNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }, []);

  const handleSelectNode = useCallback((nodeId) => {
    setSelectedAccountId(nodeId); // Update selected ID state
    console.log("Selected Account Node ID:", nodeId); // Log selection
  }, []);

  const handleConfirmSelection = () => {
    if (selectedAccountId) {
      console.log("CONFIRMED SELECTION:", selectedAccountId);
      // Here you would typically pass the selectedAccountId back to the parent
      // e.g., by changing onClose to onSelect(selectedAccountId)
      onClose(); // Close modal for now
    }
  };

  const handleAddNew = () => {
    console.log("Add New Account Clicked");
    // Logic to handle adding a new account would go here (e.g., open another form)
    onClose(); // Close modal for now
  };

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setOpenNodes({});
      setSelectedAccountId(null);
    }
  }, [isOpen]);

  return (
    // Use motion.div for the overlay to animate it
    <motion.div
      className={styles.modalOverlay}
      onClick={onClose} // Close on overlay click
      // Animation Props
      key="journal-modal" // Added key for AnimatePresence tracking
      initial="closed" // Start in 'closed' state
      animate="open" // Animate to 'open' state when present
      exit="closed" // Animate back to 'closed' state on exit
      variants={{
        // Define animation states
        open: { opacity: 1 },
        closed: { opacity: 0 },
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }} // Control timing
    >
      {/* Use motion.div for the content as well for potential scale/slide animation */}
      <motion.div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
        // Optional: Add different animation for the content (e.g., scale)
        variants={{
          open: {
            opacity: 1,
            scale: 1,
            transition: { delay: 0.1, duration: 0.3 },
          }, // Delay content slightly
          closed: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
        }}
        // Inherits initial/animate/exit from parent overlay, or define explicitly
      >
        <button
          className={styles.modalCloseButton}
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>
        <h2>Select Journal Account</h2>

        {/* Hierarchy List */}
        <div className={styles.accountHierarchyContainer}>
          {/* ... Map over hierarchy calling AccountNode ... */}
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
          {/* ... Add New / Select buttons ... */}
          <button
            className={`${styles.modalButtonSecondary} ${styles.modalActionButton}`}
            onClick={handleAddNew}
          >
            <IoAddCircleOutline /> Add New
          </button>
          <button
            className={`${styles.modalButtonPrimary} ${styles.modalActionButton}`}
            onClick={handleConfirmSelection}
            disabled={!selectedAccountId}
          >
            <IoCheckmarkCircleOutline /> Select
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
// --- END JournalModal ---
// --- Main Page Component ---
export default function Home() {
  // === State ===
  const [sliderOrder, setSliderOrder] = useState(INITIAL_ORDER);
  const [activeDataSource, setActiveDataSource] = useState("data1");
  // Load initial data - adjust based on where your structured data comes from
  const [activeDataSet, setActiveDataSet] = useState(initialData1);

  // --- Selections ---
  const [selectedJournalId, setSelectedJournalId] = useState(() =>
    getFirstId(activeDataSet?.journals)
  );
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

  const [displayedJournals, setDisplayedJournals] = useState(
    () => activeDataSet?.journals || []
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

    // Reset selections
    const newFirstJournal = getFirstId(newDataSet?.journals);
    const newFirstPartner = getFirstId(newDataSet?.partners);
    const newFirstGoods = getFirstId(newDataSet?.goods);
    setSelectedJournalId(newFirstJournal);
    setSelectedPartnerId(newFirstPartner);
    setSelectedGoodsId(newFirstGoods);
    setSelectedProjectId("project-placeholder");
    setSelectedDocumentId("document-placeholder");

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
  // !! IMPORTANT: This needs significant update based on the FINAL database structure !!
  // !! and how Project/Document sliders should interact (if at all)        !!
  useEffect(() => {
    console.log(
      "%c--- useEffect START (Filter Logic - NEEDS UPDATE) ---",
      "color: blue; font-weight: bold;"
    );
    console.log("Order:", sliderOrder.join(" -> "));
    console.log("Selections:", {
      J: selectedJournalId,
      P: selectedPartnerId,
      G: selectedGoodsId,
      Pr: selectedProjectId,
      D: selectedDocumentId,
    });

    // --- !!! START REPLACEMENT SECTION FOR DB LOGIC !!! ---
    // This section needs to be replaced with logic querying activeDataSet's
    // link tables (journal_partner_links, journal_good_links, valid_combinations)
    // based on sliderOrder and selectedJournalId, selectedPartnerId, selectedGoodsId.

    // Placeholder - Assumes filtering only affects J, P, G for now
    let finalFilteredJournals = activeDataSet?.journals || [];
    let finalFilteredPartners = activeDataSet?.partners || [];
    let finalFilteredGoods = activeDataSet?.goods || [];

    // Example of how filtering *might* look (PSEUDOCODE - NEEDS REAL IMPLEMENTATION)
    /*
    const selections = {
      [SLIDER_TYPES.JOURNAL]: selectedJournalId,
      [SLIDER_TYPES.PARTNER]: selectedPartnerId,
      [SLIDER_TYPES.GOODS]: selectedGoodsId,
      // Add project/document if they become filters
    };

    const dataMap = {
       [SLIDER_TYPES.JOURNAL]: activeDataSet?.journals || [],
       [SLIDER_TYPES.PARTNER]: activeDataSet?.partners || [],
       [SLIDER_TYPES.GOODS]: activeDataSet?.goods || [],
       [SLIDER_TYPES.PROJECT]: displayedProjects, // Use current state
       [SLIDER_TYPES.DOCUMENT]: displayedDocuments, // Use current state
    };

    let currentFilteredData = {...dataMap}; // Copy initial data

    for (let i = 0; i < sliderOrder.length; i++) {
        const targetSlider = sliderOrder[i];
        let potentialData = [...dataMap[targetSlider]]; // Start with full list for target

        // Apply filters from sliders ABOVE target
        for (let j = 0; j < i; j++) {
            const sourceSlider = sliderOrder[j];
            const sourceSelectionId = selections[sourceSlider];

            if (!sourceSelectionId) continue; // No selection in source slider

            // !!! IMPLEMENT ACTUAL FILTERING RULES HERE !!!
            // This depends heavily on the link tables and the desired logic
            // e.g., if source is Journal and target is Partner:
            // potentialData = filterPartnersByJournal(potentialData, sourceSelectionId, activeDataSet.journal_partner_links);
            // e.g., if source is Partner and target is Goods (using triplets):
            // potentialData = filterGoodsByPartnerAndJournal(potentialData, selections[SLIDER_TYPES.PARTNER], selections[SLIDER_TYPES.JOURNAL], activeDataSet.valid_combinations);

             if (potentialData.length === 0) break; // Stop applying filters if list empty
        }
        currentFilteredData[targetSlider] = potentialData;
    }

    finalFilteredJournals = currentFilteredData[SLIDER_TYPES.JOURNAL];
    finalFilteredPartners = currentFilteredData[SLIDER_TYPES.PARTNER];
    finalFilteredGoods = currentFilteredData[SLIDER_TYPES.GOODS];
    // Update displayedProjects/Documents if they become filterable
    */
    // --- !!! END REPLACEMENT SECTION FOR DB LOGIC !!! ---

    // --- Final State Update ---
    console.log("%cSetting Displayed State", "color: orange;");
    // Use JSON compare to prevent infinite loops if objects are structurally same
    if (
      JSON.stringify(displayedJournals) !==
      JSON.stringify(finalFilteredJournals)
    )
      setDisplayedJournals(finalFilteredJournals);
    if (
      JSON.stringify(displayedPartners) !==
      JSON.stringify(finalFilteredPartners)
    )
      setDisplayedPartners(finalFilteredPartners);
    if (JSON.stringify(displayedGoods) !== JSON.stringify(finalFilteredGoods))
      setDisplayedGoods(finalFilteredGoods);
    // Update Project/Document if their data changes
    // setDisplayedProjects(...)
    // setDisplayedDocuments(...)

    // --- Selection Reset Check ---
    console.log("%c--- Checking Selections ---", "color: purple;");
    let resetTriggered = false;
    if (
      selectedJournalId &&
      !finalFilteredJournals.some((j) => j?.id === selectedJournalId)
    ) {
      const newSelection = getFirstId(finalFilteredJournals);
      console.warn(`!!! Resetting Journal selection to ${newSelection}`);
      setSelectedJournalId(newSelection);
      resetTriggered = true;
    }
    if (
      !resetTriggered &&
      selectedPartnerId &&
      !finalFilteredPartners.some((p) => p?.id === selectedPartnerId)
    ) {
      const newSelection = getFirstId(finalFilteredPartners);
      console.warn(`!!! Resetting Partner selection to ${newSelection}`);
      setSelectedPartnerId(newSelection);
      resetTriggered = true;
    }
    if (
      !resetTriggered &&
      selectedGoodsId &&
      !finalFilteredGoods.some((g) => g?.id === selectedGoodsId)
    ) {
      const newSelection = getFirstId(finalFilteredGoods);
      console.warn(`!!! Resetting Goods selection to ${newSelection}`);
      setSelectedGoodsId(newSelection);
      resetTriggered = true;
    }
    // Add checks for Project/Document if needed

    console.log("%c--- useEffect END ---", "color: blue; font-weight: bold;");
  }, [
    sliderOrder,
    selectedJournalId,
    selectedPartnerId,
    selectedGoodsId,
    // Add selectedProjectId, selectedDocumentId if they drive filtering
    activeDataSet,
    // IMPORTANT: Avoid adding displayedXYZ states as dependencies unless absolutely necessary
  ]);

  // === Event Handlers ===
  const handleSwipe = useCallback((sourceSliderId, selectedItemId) => {
    console.log(`Swipe: ${sourceSliderId}, ${selectedItemId}`);
    if (sourceSliderId === SLIDER_TYPES.JOURNAL)
      setSelectedJournalId(selectedItemId);
    else if (sourceSliderId === SLIDER_TYPES.PARTNER)
      setSelectedPartnerId(selectedItemId);
    else if (sourceSliderId === SLIDER_TYPES.GOODS)
      setSelectedGoodsId(selectedItemId);
    else if (sourceSliderId === SLIDER_TYPES.PROJECT)
      setSelectedProjectId(selectedItemId);
    else if (sourceSliderId === SLIDER_TYPES.DOCUMENT)
      setSelectedDocumentId(selectedItemId);
  }, []); // Stable state setters don't need to be dependencies

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

  // Simplified moveSlider (no order checks)
  const moveSlider = (sliderId, direction) => {
    setSliderOrder((currentOrder) => {
      const currentIndex = currentOrder.indexOf(sliderId);
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= currentOrder.length)
        return currentOrder;

      const newOrder = [...currentOrder];
      [newOrder[currentIndex], newOrder[targetIndex]] = [
        newOrder[targetIndex],
        newOrder[currentIndex],
      ];
      console.log(`moveSlider: Order change to ${newOrder.join(" -> ")}`);
      return newOrder;
    });
  };

  // Updated getSliderProps
  const getSliderProps = (sliderId) => {
    switch (sliderId) {
      case SLIDER_TYPES.JOURNAL:
        return { data: displayedJournals, activeItemId: selectedJournalId };
      case SLIDER_TYPES.PARTNER:
        return { data: displayedPartners, activeItemId: selectedPartnerId };
      case SLIDER_TYPES.GOODS:
        return { data: displayedGoods, activeItemId: selectedGoodsId };
      case SLIDER_TYPES.PROJECT:
        return { data: displayedProjects, activeItemId: selectedProjectId };
      case SLIDER_TYPES.DOCUMENT:
        return { data: displayedDocuments, activeItemId: selectedDocumentId };
      default:
        return { data: [], activeItemId: null };
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
              spaceBetween={10} // Slightly more space?
              slidesPerView={"auto"}
              centeredSlides={false}
              loop={true} // Keep loop disabled
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

                // Calculate visible index
                let visibleIndex = -1;
                if (isCurrentlyVisible) {
                  const visibleOrder = sliderOrder.filter(
                    (id) => visibility[id]
                  );
                  visibleIndex = visibleOrder.indexOf(sliderId);
                }

                return (
                  // SwiperSlide itself is stable
                  <SwiperSlide
                    key={sliderId}
                    className={styles.visibilitySwiperSlide}
                  >
                    {/* --- REMOVED AnimatePresence --- */}
                    {/* Always render motion.div, animate based on state */}
                    <motion.div
                      layout // Animate layout changes from reordering
                      layoutId={sliderId} // ID for tracking during reorder
                      className={styles.visibilitySlideContent}
                      // --- Animate based on visibility state ---
                      initial={false} // Don't run initial animation based on visibility state on load
                      animate={{
                        opacity: isCurrentlyVisible ? 1 : 0.4, // Fade hidden items
                        scale: isCurrentlyVisible ? 1 : 0.95, // Slightly shrink hidden items
                        // Remove width animation, let content define width
                      }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                    >
                      <button
                        onClick={() => toggleVisibility(sliderId)}
                        // Apply active style based on visibility, remove general non-active opacity
                        className={`${styles.visibilityButton} ${
                          isCurrentlyVisible
                            ? styles.visibilityActive
                            : styles.visibilityInactive
                        }`}
                        // Disable button clicks if hidden? Optional.
                        // disabled={!isCurrentlyVisible}
                        // Use aria-hidden for accessibility if truly hidden visually by opacity/scale
                        aria-hidden={!isCurrentlyVisible}
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
                          // Animate arrow along with button
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
      {/* Main Sliders Area - */}
      <LayoutGroup id="main-sliders-layout">
        {" "}
        {/* Optional: Add ID for clarity */}
        <div className={styles.slidersArea}>
          <AnimatePresence>
            {sliderOrder.map((sliderId, index) => {
              const config = SLIDER_CONFIG[sliderId];
              // Render logic checks visibility state BEFORE rendering
              if (!config || !visibility[sliderId]) return null;

              const { Component, title: sliderTitle } = config;
              const { data, activeItemId } = getSliderProps(sliderId);
              const isAccordionOpenForType = accordionTypeState[sliderId];
              const canMoveUp = index > 0;
              const canMoveDown = index < sliderOrder.length - 1;
              const onSlideChangeCallback = (id) => handleSwipe(sliderId, id);
              const onToggleAccordionCallback = () => toggleAccordion(sliderId);

              return (
                // This motion.div uses the SAME layoutId string (e.g., "journal")
                // but it's tracked within THIS LayoutGroup, separate from the header
                <motion.div
                  key={sliderId} // Key for React map
                  layoutId={sliderId} // ID tracked within *this* group
                  layout // Enable layout animation
                  style={{ order: index }} // Apply visual order for flexbox
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    opacity: { duration: 0.3, ease: "easeInOut" },
                    height: { duration: 0.3, ease: "easeInOut" },
                    layout: { duration: 0.5, ease: "easeInOut" }, // Layout animation timing
                  }}
                  className={styles.sliderWrapper}
                >
                  {/* Controls */}
                  <div className={styles.controls}>
                    {/* Edit Button (Left Aligned Example) */}
                    <button
                      onClick={
                        sliderId === SLIDER_TYPES.JOURNAL
                          ? openJournalModal // Trigger modal only for Journal
                          : () => console.log(`Edit clicked for ${sliderId}`) // Placeholder for others
                      }
                      className={`${styles.controlButton} ${styles.editButton}`}
                      aria-label={`Edit ${sliderTitle}`}
                      title={`Edit ${sliderTitle}`}
                    >
                      <IoOptionsOutline />
                    </button>

                    <div className={styles.moveButtonGroup}>
                      {canMoveUp && (
                        <button
                          onClick={() => moveSlider(sliderId, "up")}
                          className={styles.controlButton}
                          aria-label={`Move ${sliderTitle} up`}
                        >
                          ▲ Up
                        </button>
                      )}
                      {canMoveDown && (
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
                  {/* Component */}
                  <Component
                    sliderId={sliderId}
                    title={sliderTitle}
                    data={data}
                    onSlideChange={onSlideChangeCallback}
                    activeItemId={activeItemId}
                    isAccordionOpen={isAccordionOpenForType}
                    onToggleAccordion={onToggleAccordionCallback}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>{" "}
      {/* --- END Main Sliders LayoutGroup --- */}
      {/* --- WRAP MODAL in AnimatePresence --- */}
      <AnimatePresence>
        {/* Conditionally render based on state */}
        {isJournalModalOpen && (
          <JournalModal
            // Key prop might not be strictly needed here if overlay has one
            // key="journal-modal-instance"
            isOpen={isJournalModalOpen} // Pass state down (though AnimatePresence controls mounting)
            onClose={closeJournalModal}
            hierarchy={activeDataSet?.account_hierarchy || []}
          />
        )}
      </AnimatePresence>
      {/* --- END AnimatePresence Wrapper --- */}
    </div> // End pageContainer
  );
} // End Home Component
