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

// --- JournalModal Component ---
function JournalModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.modalCloseButton}
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>
        <h2>Journal Options / Hierarchy</h2>
        <p>Work in Progress... (Accordion Waterfall Here)</p>
      </div>
    </div>
  );
}

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
    if (
      !sliderId ||
      !SLIDER_TYPES[
        Object.keys(SLIDER_TYPES).find((key) => SLIDER_TYPES[key] === sliderId)
      ]
    )
      return;
    setVisibility((prev) => ({ ...prev, [sliderId]: !prev[sliderId] }));
  }, []); // Depends only on setVisibility which is stable

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
      <h1 className={styles.title}>Project Interface</h1> {/* Updated Title */}
      {/* Data Source Selector */}
      <div className={styles.dataSourceSelector}>
        <label>
          <input
            type="radio"
            name="dataSource"
            value="data1"
            checked={activeDataSource === "data1"}
            onChange={handleDataSourceChange}
          />
          All Data
        </label>
        <label>
          <input
            type="radio"
            name="dataSource"
            value="data2"
            checked={activeDataSource === "data2"}
            onChange={handleDataSourceChange}
          />
          Filtered Data (Triplets)
        </label>
      </div>
      {/* Visibility Toggles Swiper */}
      <div className={styles.visibilitySwiperContainer}>
        <Swiper
          key={`visibility-swiper-${sliderOrder.join("-")}`} // Re-init on order change
          modules={[Navigation]} // Add Navigation if needed
          spaceBetween={5}
          slidesPerView={"auto"}
          centeredSlides={false}
          loop={true}
          // navigation // Uncomment for prev/next arrows on the swiper
          className={styles.visibilitySwiper}
        >
          {sliderOrder.map((sliderId, index) => (
            <SwiperSlide
              key={sliderId}
              className={styles.visibilitySwiperSlide}
            >
              <button
                onClick={() => toggleVisibility(sliderId)}
                className={`${styles.visibilityButton} ${
                  visibility[sliderId] ? styles.visibilityActive : ""
                }`}
                aria-pressed={visibility[sliderId]}
              >
                {SLIDER_CONFIG[sliderId]?.title || sliderId}
              </button>
              {/* Arrow rendered conditionally based on original array index */}
              {index < sliderOrder.length - 1 && (
                <span className={styles.visibilityArrow} aria-hidden="true">
                  →
                </span>
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      {/* Main Sliders Area */}
      <LayoutGroup>
        <div className={styles.slidersArea}>
          <AnimatePresence>
            {sliderOrder.map((sliderId, index) => {
              const config = SLIDER_CONFIG[sliderId];
              if (!config) return null;

              const { Component, title } = config;
              const { data, activeItemId } = getSliderProps(sliderId);
              const isAccordionOpenForType = accordionTypeState[sliderId];

              const canMoveUp = index > 0;
              const canMoveDown = index < sliderOrder.length - 1;

              // Define callbacks inside map or ensure stable reference if defined outside
              const onSlideChangeCallback = (id) => handleSwipe(sliderId, id);
              const onToggleAccordionCallback = () => toggleAccordion(sliderId);

              // Conditional rendering based on visibility state
              if (!visibility[sliderId]) {
                // Although we don't render, AnimatePresence needs a key if elements might exit
                // However, since we return null directly, it might be okay.
                // If exit animations fail, wrap this in a null-rendering motion.div with a key.
                return null;
              }

              return (
                <motion.div
                  key={sliderId} // Key for map and AnimatePresence
                  layoutId={sliderId} // Key for LayoutGroup animation
                  layout
                  style={{ order: index }} // Use inline style for order for Framer Motion
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    opacity: { duration: 0.3, ease: "easeInOut" },
                    height: { duration: 0.3, ease: "easeInOut" },
                    layout: { duration: 0.5, ease: "easeInOut" },
                  }}
                  className={styles.sliderWrapper}
                >
                  {/* Controls */}
                  <div className={styles.controls}>
                    {sliderId === SLIDER_TYPES.JOURNAL ? (
                      <button
                        onClick={openJournalModal}
                        className={`${styles.controlButton} ${styles.modalButton}`}
                        aria-label="Open Journal Options"
                        title="Journal Options"
                      >
                        <IoOptionsOutline />
                      </button>
                    ) : (
                      <div className={styles.controlPlaceholder}> </div>
                    )}
                    <div className={styles.moveButtonGroup}>
                      {canMoveUp && (
                        <button
                          onClick={() => moveSlider(sliderId, "up")}
                          className={styles.controlButton}
                          aria-label={`Move ${title} up`}
                        >
                          ▲ Up
                        </button>
                      )}
                      {canMoveDown && (
                        <button
                          onClick={() => moveSlider(sliderId, "down")}
                          className={styles.controlButton}
                          aria-label={`Move ${title} down`}
                        >
                          ▼ Down
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Render Slider Component */}
                  <Component
                    sliderId={sliderId}
                    title={title} // Pass title here
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
      </LayoutGroup>
      {/* Journal Modal */}
      <JournalModal isOpen={isJournalModalOpen} onClose={closeJournalModal} />
    </div>
  );
}
