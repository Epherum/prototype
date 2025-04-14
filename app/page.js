"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion"; // Ensure AnimatePresence is imported
import Image from "next/image"; // <-- Import Next.js Image
import styles from "./page.module.css";
import initialData1 from "./data.json";
import initialData2 from "./data2.json"; // Import the new file

// Swiper Imports
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

// Add these alongside your other imports
import {
  IoCartOutline, // For Buy/Procurement
  IoPricetagOutline, // For Sell
  IoBuildOutline, // For Manufacturing
  IoWalletOutline, // For Finance
  IoNavigateOutline, // For Logistics
  IoClipboardOutline, // For Inventory/Adjustment
  IoOptionsOutline,
} from "react-icons/io5";

// Helper
const getFirstId = (arr) => (arr && arr.length > 0 ? arr[0].id : null);

// Constants
const SLIDER_TYPES = { JOURNAL: "journal", PARTNER: "partner", GOODS: "goods" };
const SLIDER_CONFIG = {
  [SLIDER_TYPES.JOURNAL]: { Component: DynamicSlider, title: "Journal" },
  [SLIDER_TYPES.PARTNER]: { Component: DynamicSlider, title: "Partner" },
  [SLIDER_TYPES.GOODS]: { Component: DynamicSlider, title: "Goods" },
};
const INITIAL_ORDER = [
  SLIDER_TYPES.JOURNAL,
  SLIDER_TYPES.PARTNER,
  SLIDER_TYPES.GOODS,
];

// --- Place near other constants like SLIDER_TYPES ---
const ALLOWED_ORDERS = [
  // Order 1
  [SLIDER_TYPES.JOURNAL, SLIDER_TYPES.PARTNER, SLIDER_TYPES.GOODS],
  // Order 2
  [SLIDER_TYPES.JOURNAL, SLIDER_TYPES.GOODS, SLIDER_TYPES.PARTNER],
  // Order 3 (NOTE: Your description had partner->journal->goods, ensure this matches your intent)
  [SLIDER_TYPES.PARTNER, SLIDER_TYPES.JOURNAL, SLIDER_TYPES.GOODS],
  // Order 4 (NOTE: Your description had good->journal->partner, ensure this matches your intent)
  [SLIDER_TYPES.GOODS, SLIDER_TYPES.JOURNAL, SLIDER_TYPES.PARTNER],
  [SLIDER_TYPES.GOODS, SLIDER_TYPES.PARTNER, SLIDER_TYPES.JOURNAL], // 5 (NEW:  Good -> Partner -> Journal)
  [SLIDER_TYPES.PARTNER, SLIDER_TYPES.GOODS, SLIDER_TYPES.JOURNAL],
];

// Helper function to check if an order array is valid
// Uses JSON stringify for easy array comparison
const isOrderAllowed = (orderToCheck) => {
  const orderString = JSON.stringify(orderToCheck);
  return ALLOWED_ORDERS.some(
    (allowed) => JSON.stringify(allowed) === orderString
  );
};

const JOURNAL_ICONS = {
  "journal-1": IoCartOutline,
  "journal-2": IoPricetagOutline,
  "journal-3": IoBuildOutline,
  "journal-4": IoWalletOutline,
  "journal-5": IoNavigateOutline,
  "journal-6": IoClipboardOutline,
};

// --- DynamicSlider Component (Major Updates) ---
function DynamicSlider({
  sliderId,
  title,
  data = [],
  onSlideChange,
  activeItemId,
  orderIndex,
  isAccordionOpen,
  onToggleAccordion,
}) {
  const swiperRef = useRef(null);

  useEffect(() => {
    if (swiperRef.current && data.length > 0) {
      const activeIndex = data.findIndex((item) => item.id === activeItemId);
      const targetIndex = activeIndex !== -1 ? activeIndex : 0;
      if (swiperRef.current.realIndex !== targetIndex) {
        // Use realIndex for loops
        // Use slideToLoop if loop=true, otherwise slideTo
        swiperRef.current.slideToLoop
          ? swiperRef.current.slideToLoop(targetIndex, 0)
          : swiperRef.current.slideTo(targetIndex, 0);
      }
      swiperRef.current.update();
    } else if (swiperRef.current) {
      swiperRef.current.update();
    }
  }, [activeItemId, data]); // Rerun when active ID or data itself changes

  const handleSwiperChange = (swiper) => {
    // Use realIndex when loop is enabled
    const currentRealIndex =
      swiper.realIndex !== undefined ? swiper.realIndex : swiper.activeIndex;
    if (data.length > currentRealIndex) {
      onSlideChange(data[currentRealIndex].id);
    }
  };

  // --- ADJUSTED currentItem LOGIC ---
  // Find the currently active item based on the prop
  let currentItem = data.find((item) => item.id === activeItemId);

  // *** FALLBACK LOGIC ***
  // If the activeItemId prop doesn't match any item in the *current* data array
  // (e.g., due to filtering or initial load mismatch), AND data exists,
  // default to using the FIRST item in the current data array for displaying details.
  if (!currentItem && data.length > 0) {
    currentItem = data[0];
  }
  // *** END FALLBACK LOGIC ***

  return (
    <>
      <h2 className={styles.sliderTitle}>{title}</h2>
      {data.length > 0 ? (
        <Swiper
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
          modules={[Navigation, Pagination]}
          loop={false} // Enable loop only if more than 1 slide
          spaceBetween={20} // Slightly less space
          slidesPerView={1}
          navigation={data.length > 1} // Hide nav if only 1 slide
          pagination={data.length > 1 ? { clickable: true } : false} // Hide pagination too
          onSlideChange={handleSwiperChange}
          className={`${styles.swiperInstance} `}
          // Key change forces re-init if data fundamentally changes (e.g., filtering to 1 item)
          key={data.map((d) => d.id).join("-")}
          initialSlide={Math.max(
            0,
            data.findIndex((item) => item.id === activeItemId)
          )}
          observer={true}
          observeParents={true}
        >
          {data.map((item) => {
            // <<< --- START ICON LOGIC --- >>>
            // 1. Define a variable to hold the potential icon component
            let IconComponent = null;
            // 2. Check if this is the Journal slider AND if an icon exists for this specific item's ID
            if (sliderId === SLIDER_TYPES.JOURNAL && JOURNAL_ICONS[item.id]) {
              // 3. Assign the mapped icon component
              IconComponent = JOURNAL_ICONS[item.id];
            }
            // <<< --- END ICON LOGIC --- >>>

            // The return statement for each slide
            return (
              <SwiperSlide key={item.id} className={styles.slide}>
                {/* Image Section (Conditional) - Keep commented out based on previous request */}
                {/*
                  {(sliderId === SLIDER_TYPES.PARTNER ||
                    sliderId === SLIDER_TYPES.GOODS) &&
                    item.imageUrl && (
                      <div className={styles.slideImageWrapper}>
                        <Image ... />
                      </div>
                  )}
                  */}
                {/* Text Content */}
                <div
                  className={`${styles.slideTextContent} ${
                    // Base class
                    IconComponent ? styles.slideTextContentWithIcon : "" // Conditional class
                  }`}
                >
                  {/* <<< --- START ICON RENDERING --- >>> */}
                  {/* 4. Conditionally render the IconComponent if it was found */}
                  {IconComponent && (
                    <IconComponent
                      className={styles.slideIcon}
                      aria-hidden="true"
                    />
                  )}
                  {/* <<< --- END ICON RENDERING --- >>> */}

                  <span className={styles.slideName}>{item.name}</span>
                  {/* Conditionally show simple details like quantity for goods */}
                  {sliderId === SLIDER_TYPES.GOODS && item.quantity && (
                    <span className={styles.slideSubText}>
                      {item.quantity} {item.unit}
                    </span>
                  )}
                  {sliderId === SLIDER_TYPES.PARTNER && item.location && (
                    <span className={styles.slideSubText}>{item.location}</span>
                  )}
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      ) : (
        <div className={styles.noData}>No items match criteria.</div>
      )}
      {/* Accordion Section */}
      {currentItem && ( // Only show accordion if there's an active item
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
              ▼ {/* Simple arrow, rotates via CSS */}
            </span>
          </button>
          {/* AnimatePresence manages the details visibility */}
          <AnimatePresence initial={false}>
            {isAccordionOpen && (
              <motion.div
                key={`details-${currentItem.id}`} // Key needed for AnimatePresence
                initial="collapsed"
                animate="open"
                exit="collapsed"
                variants={{
                  open: { opacity: 1, height: "auto", marginTop: "8px" },
                  collapsed: { opacity: 0, height: 0, marginTop: "0px" },
                }}
                transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }} // Smoother ease
                className={styles.detailsContentWrapper} // Wrapper for overflow hidden
              >
                {/* Display Details based on slider type */}
                <div className={styles.detailsContent}>
                  {/* Common Detail: Description */}
                  {currentItem.description && (
                    <p>
                      <strong>Description:</strong> {currentItem.description}
                    </p>
                  )}

                  {/* Goods Specific Details */}
                  {sliderId === SLIDER_TYPES.GOODS && (
                    <>
                      {currentItem.quantity !== undefined && (
                        <p>
                          <strong>Quantity:</strong> {currentItem.quantity}{" "}
                          {currentItem.unit}
                        </p>
                      )}
                      {currentItem.ownedBy && (
                        <p>
                          <strong>Owned By:</strong>{" "}
                          {currentItem.ownedBy.join(", ")}
                        </p>
                      )}
                      {currentItem.journal && (
                        <p>
                          <strong>Associated Journal:</strong>{" "}
                          {currentItem.journal}
                        </p>
                      )}
                    </>
                  )}
                  {/* Partner Specific Details */}
                  {sliderId === SLIDER_TYPES.PARTNER && (
                    <>
                      {currentItem.location && (
                        <p>
                          <strong>Location:</strong> {currentItem.location}
                        </p>
                      )}
                      {currentItem.journals && (
                        <p>
                          <strong>Handles Journals:</strong>{" "}
                          {currentItem.journals.join(", ")}
                        </p>
                      )}
                      {currentItem.goods && (
                        <p>
                          <strong>Associated Goods:</strong>{" "}
                          {currentItem.goods.join(", ")}
                        </p>
                      )}
                    </>
                  )}
                  {/* Journal specific details already in description, maybe add related partners/goods? */}
                  {/* (Could fetch this if needed, but keeping simple for now) */}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

// --- NEW: Simple Modal Component ---
function JournalModal({ isOpen, onClose }) {
  // Use AnimatePresence later if you want fade-in/out
  if (!isOpen) return null;

  return (
    // Overlay captures clicks to close
    <div className={styles.modalOverlay} onClick={onClose}>
      {/* Content stops propagation so clicking inside doesn't close it */}
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.modalCloseButton}
          onClick={onClose}
          aria-label="Close modal"
        >
          × {/* Simple 'X' character */}
        </button>
        <h2>Journal Options</h2>
        <p>Work in Progress...</p>
        {/* Future content goes here */}
      </div>
    </div>
  );
}
// --- END: Simple Modal Component ---

export default function Home() {
  // === State ===
  const [sliderOrder, setSliderOrder] = useState(INITIAL_ORDER);
  const [activeDataSource, setActiveDataSource] = useState("data1");
  const [activeDataSet, setActiveDataSet] = useState(initialData1);

  // Restore displayed state
  const [selectedJournalId, setSelectedJournalId] = useState(() =>
    getFirstId(activeDataSet.journals)
  );
  const [selectedPartnerId, setSelectedPartnerId] = useState(() =>
    getFirstId(activeDataSet.partners)
  );
  const [selectedGoodsId, setSelectedGoodsId] = useState(() =>
    getFirstId(activeDataSet.goods)
  );
  const [displayedJournals, setDisplayedJournals] = useState(
    () => activeDataSet.journals
  );
  const [displayedPartners, setDisplayedPartners] = useState(
    () => activeDataSet.partners
  );
  const [displayedGoods, setDisplayedGoods] = useState(
    () => activeDataSet.goods
  );

  const [accordionTypeState, setAccordionTypeState] = useState({
    [SLIDER_TYPES.JOURNAL]: false,
    [SLIDER_TYPES.PARTNER]: false,
    [SLIDER_TYPES.GOODS]: false,
  });
  const [visibility, setVisibility] = useState({
    [SLIDER_TYPES.JOURNAL]: true,
    [SLIDER_TYPES.PARTNER]: true,
    [SLIDER_TYPES.GOODS]: false,
  });

  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  // --- NEW: Modal Handlers ---
  const openJournalModal = useCallback(() => setIsJournalModalOpen(true), []);
  const closeJournalModal = useCallback(() => setIsJournalModalOpen(false), []);

  // === Data Source Change Handler ===
  const handleDataSourceChange = (event) => {
    const newSourceKey = event.target.value;
    if (newSourceKey === activeDataSource) return;
    const newDataSet = newSourceKey === "data1" ? initialData1 : initialData2;

    setActiveDataSource(newSourceKey);
    setActiveDataSet(newDataSet);

    const newFirstJournal = getFirstId(newDataSet.journals);
    const newFirstPartner = getFirstId(newDataSet.partners);
    const newFirstGoods = getFirstId(newDataSet.goods);

    setSliderOrder(INITIAL_ORDER);
    setSelectedJournalId(newFirstJournal);
    setSelectedPartnerId(newFirstPartner);
    setSelectedGoodsId(newFirstGoods);
    setDisplayedJournals(newDataSet.journals); // Set displayed state on change
    setDisplayedPartners(newDataSet.partners);
    setDisplayedGoods(newDataSet.goods);
    setVisibility({
      [SLIDER_TYPES.JOURNAL]: true,
      [SLIDER_TYPES.PARTNER]: true,
      [SLIDER_TYPES.GOODS]: false,
    });
    setAccordionTypeState({
      [SLIDER_TYPES.JOURNAL]: false,
      [SLIDER_TYPES.PARTNER]: false,
      [SLIDER_TYPES.GOODS]: false,
    });
  };

  // === Filtering useEffect (Revised Loop Structure + Enhanced Logging) ===
  useEffect(() => {
    console.log(
      "%c--- useEffect START (Revised Loop) ---",
      "color: blue; font-weight: bold;"
    );
    console.log("Order:", sliderOrder.join(" -> "));
    console.log("Current Selections:", {
      journal: selectedJournalId,
      partner: selectedPartnerId,
      goods: selectedGoodsId,
    });
    console.log("Active Dataset:", activeDataSource);

    // Start with full dataset copies to hold the results for each slider
    let finalFilteredJournals = [...activeDataSet.journals];
    let finalFilteredPartners = [...activeDataSet.partners];
    let finalFilteredGoods = [...activeDataSet.goods];

    // Apply filters sequentially based on the order
    for (let i = 0; i < sliderOrder.length; i++) {
      const targetSliderType = sliderOrder[i]; // The slider we are calculating data FOR
      console.log(
        `\n%cCalculating Data for Index ${i}: ${targetSliderType}`,
        "color: green;"
      );

      // Start with the full list for the target slider type *from the original dataset* for this iteration
      let potentialData =
        targetSliderType === SLIDER_TYPES.JOURNAL
          ? [...activeDataSet.journals]
          : targetSliderType === SLIDER_TYPES.PARTNER
          ? [...activeDataSet.partners]
          : [...activeDataSet.goods];
      console.log(
        `  Initial potential data count for ${targetSliderType}: ${potentialData.length}`
      );

      // Apply filters from ALL sliders ABOVE the target slider
      for (let j = 0; j < i; j++) {
        const sourceSliderType = sliderOrder[j]; // The slider acting AS a filter
        const sourceSelectionId =
          sourceSliderType === SLIDER_TYPES.JOURNAL
            ? selectedJournalId
            : sourceSliderType === SLIDER_TYPES.PARTNER
            ? selectedPartnerId
            : selectedGoodsId;

        // Get the *actual* selected item data based on the source's ID
        // We need the full item details for filtering, so query the original activeDataSet
        const sourceItem =
          sourceSliderType === SLIDER_TYPES.JOURNAL
            ? activeDataSet.journals.find(
                (item) => item.id === sourceSelectionId
              )
            : sourceSliderType === SLIDER_TYPES.PARTNER
            ? activeDataSet.partners.find(
                (item) => item.id === sourceSelectionId
              )
            : activeDataSet.goods.find((item) => item.id === sourceSelectionId);

        console.log(
          `  Applying filter from Index ${j}: ${sourceSliderType} (Selected ID: ${sourceSelectionId})`
        );

        // CRITICAL CHECK: If the selected item from the source slider is null/undefined
        // (e.g., selection hasn't happened yet, or ID is invalid), we cannot filter based on it.
        // This often means the target list should be empty.
        if (!sourceItem) {
          console.warn(
            `    Source item for ${sourceSliderType} (ID: ${sourceSelectionId}) is NULL or not found in dataset. Clearing target ${targetSliderType}.`
          );
          potentialData = []; // If any upstream filter is invalid, the target list is empty
          break; // No need to apply further filters from other upstream sliders for this target
        }

        console.log(
          `    Found source item: ${sourceItem.name || sourceItem.id}`
        );

        // Apply the filter based on source -> target relationship
        if (sourceSliderType === SLIDER_TYPES.JOURNAL) {
          if (targetSliderType === SLIDER_TYPES.PARTNER) {
            // Filter partners based on if their 'journals' array includes the selected journal's ID
            potentialData = potentialData.filter(
              (p) =>
                Array.isArray(p.journals) && p.journals.includes(sourceItem.id)
            );
          } else if (targetSliderType === SLIDER_TYPES.GOODS) {
            // Filter goods based on if their 'journal' property matches the selected journal's ID
            potentialData = potentialData.filter(
              (g) => g.journal === sourceItem.id
            );
          }
        } else if (sourceSliderType === SLIDER_TYPES.PARTNER) {
          if (targetSliderType === SLIDER_TYPES.GOODS) {
            // Filter goods based on if their ID is included in the selected partner's 'goods' array
            potentialData = potentialData.filter(
              (g) =>
                Array.isArray(sourceItem.goods) &&
                sourceItem.goods.includes(g.id)
            );
          } else if (targetSliderType === SLIDER_TYPES.JOURNAL) {
            // Filter journals based on if their ID is included in the selected partner's 'journals' array
            potentialData = potentialData.filter(
              (j) =>
                Array.isArray(sourceItem.journals) &&
                sourceItem.journals.includes(j.id)
            );
          }
        } else if (sourceSliderType === SLIDER_TYPES.GOODS) {
          if (targetSliderType === SLIDER_TYPES.PARTNER) {
            // Filter partners based on if their ID is included in the selected good's 'ownedBy' array
            if (Array.isArray(sourceItem.ownedBy)) {
              potentialData = potentialData.filter((p) =>
                sourceItem.ownedBy.includes(p.id)
              );
            } else {
              console.warn(
                `    Goods item ${sourceItem.id} has invalid 'ownedBy' property. Clearing partners.`
              );
              potentialData = []; // Clear if ownedBy isn't array
            }
          } else if (targetSliderType === SLIDER_TYPES.JOURNAL) {
            // Filter journals based on if their ID matches the selected good's 'journal' property
            potentialData = potentialData.filter(
              (j) => j.id === sourceItem.journal
            );
          }
        }
        console.log(
          `    Data count for ${targetSliderType} after ${sourceSliderType} filter: ${potentialData.length}`
        );
        if (potentialData.length === 0 && j < i - 1) {
          console.log(
            `    Target ${targetSliderType} is empty after ${sourceSliderType} filter. No need for further upstream filters.`
          );
          break; // Optimization: If list is empty, stop applying more filters from above
        }
      } // End inner loop (applying filters from above)

      // Update the final list for the target slider for this cycle
      if (targetSliderType === SLIDER_TYPES.JOURNAL) {
        finalFilteredJournals = potentialData;
      } else if (targetSliderType === SLIDER_TYPES.PARTNER) {
        finalFilteredPartners = potentialData;
      } else if (targetSliderType === SLIDER_TYPES.GOODS) {
        finalFilteredGoods = potentialData;
      }
      console.log(
        `%c  Finished calculating for ${targetSliderType}. Final count: ${
          potentialData.length
        } [${potentialData.map((d) => d.id).join(", ")}]`,
        "color: green;"
      );
    } // End outer loop (calculating for each slider)

    // --- Final State Update ---
    // Check if the calculated lists are actually different from the current displayed state
    // This prevents unnecessary re-renders if the data hasn't changed
    const journalsChanged =
      JSON.stringify(finalFilteredJournals) !==
      JSON.stringify(displayedJournals);
    const partnersChanged =
      JSON.stringify(finalFilteredPartners) !==
      JSON.stringify(displayedPartners);
    const goodsChanged =
      JSON.stringify(finalFilteredGoods) !== JSON.stringify(displayedGoods);

    if (journalsChanged) {
      console.log("%cSetting updated Displayed Journals", "color: orange;");
      setDisplayedJournals(finalFilteredJournals);
    }
    if (partnersChanged) {
      console.log("%cSetting updated Displayed Partners", "color: orange;");
      setDisplayedPartners(finalFilteredPartners);
    }
    if (goodsChanged) {
      console.log("%cSetting updated Displayed Goods", "color: orange;");
      setDisplayedGoods(finalFilteredGoods);
    }
    if (!journalsChanged && !partnersChanged && !goodsChanged) {
      console.log("Displayed data lists have not changed.");
    }

    // --- Selection Reset Check ---
    // IMPORTANT: This check should happen *AFTER* the displayed state might have been updated.
    // However, running it here means if a reset IS needed, it triggers another useEffect cycle.
    // Let's proceed with this for now, as it ensures consistency.
    console.log("%c--- useEffect Checking Selections ---", "color: purple;");
    let resetTriggered = false; // Track if any reset happens in this cycle

    // Check Journal FIRST
    if (
      selectedJournalId &&
      !finalFilteredJournals.some((j) => j.id === selectedJournalId)
    ) {
      const newSelection = getFirstId(finalFilteredJournals);
      console.warn(
        `!!! Journal selection ${selectedJournalId} invalid in new list [${finalFilteredJournals
          .map((j) => j.id)
          .join(", ")}]. Resetting to ${newSelection}.`
      );
      setSelectedJournalId(newSelection); // This state change will trigger useEffect again
      resetTriggered = true;
    }

    // Check Partner only if Journal didn't need reset
    if (
      !resetTriggered &&
      selectedPartnerId &&
      !finalFilteredPartners.some((p) => p.id === selectedPartnerId)
    ) {
      const newSelection = getFirstId(finalFilteredPartners);
      console.warn(
        `!!! Partner selection ${selectedPartnerId} invalid in new list [${finalFilteredPartners
          .map((p) => p.id)
          .join(", ")}]. Resetting to ${newSelection}.`
      );
      setSelectedPartnerId(newSelection); // This state change will trigger useEffect again
      resetTriggered = true;
    }

    // Check Goods only if Journal and Partner didn't need reset
    if (
      !resetTriggered &&
      selectedGoodsId &&
      !finalFilteredGoods.some((g) => g.id === selectedGoodsId)
    ) {
      const newSelection = getFirstId(finalFilteredGoods);
      console.warn(
        `!!! Goods selection ${selectedGoodsId} invalid in new list [${finalFilteredGoods
          .map((g) => g.id)
          .join(", ")}]. Resetting to ${newSelection}.`
      );
      setSelectedGoodsId(newSelection); // This state change will trigger useEffect again
      resetTriggered = true;
    }

    if (!resetTriggered) {
      console.log(
        "%c--- Selections remain valid this cycle. ---",
        "color: purple;"
      );
    } else {
      console.log(
        "%c--- Selection reset was triggered. Expecting useEffect rerun. ---",
        "color: purple; font-weight: bold;"
      );
    }
    console.log("%c--- useEffect END ---", "color: blue; font-weight: bold;");
  }, [
    sliderOrder,
    selectedJournalId,
    selectedPartnerId,
    selectedGoodsId,
    activeDataSet,
    // Add displayed state as dependencies ONLY if you want to react to direct changes,
    // but it's usually derived state, so avoid adding them to prevent infinite loops.
    // displayedJournals, displayedPartners, displayedGoods
  ]);

  // === Event Handlers ===
  const handleSwipe = useCallback((sourceSliderId, selectedItemId) => {
    console.log(
      `Swipe handled on ${sourceSliderId}, selected: ${selectedItemId}`
    );
    if (sourceSliderId === SLIDER_TYPES.JOURNAL)
      setSelectedJournalId(selectedItemId);
    else if (sourceSliderId === SLIDER_TYPES.PARTNER)
      setSelectedPartnerId(selectedItemId);
    else if (sourceSliderId === SLIDER_TYPES.GOODS)
      setSelectedGoodsId(selectedItemId);
  }, []); // No dependencies needed now

  const toggleAccordion = useCallback(
    (sliderType) => {
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
      console.log(
        `Toggled accordion for type ${sliderType} to ${!accordionTypeState[
          sliderType
        ]}`
      );
    },
    [accordionTypeState]
  );

  const toggleVisibility = (sliderId) => {
    setVisibility((prev) => ({ ...prev, [sliderId]: !prev[sliderId] }));
    console.log(
      `Toggled visibility for ${sliderId} to ${!visibility[sliderId]}`
    );
  };

  // --- moveSlider (Ensure it's Simplified) ---
  const moveSlider = (sliderId, direction) => {
    setSliderOrder((currentOrder) => {
      const currentIndex = currentOrder.indexOf(sliderId);
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= currentOrder.length) {
        return currentOrder; // No change if move is out of bounds
      }

      const newOrder = [...currentOrder];
      [newOrder[currentIndex], newOrder[targetIndex]] = [
        newOrder[targetIndex],
        newOrder[currentIndex],
      ];

      // We rely on the button logic to only call this if the move IS allowed
      // No need to check isOrderAllowed here again unless you want double safety
      console.log(
        `moveSlider: Attempting order change to ${newOrder.join(" -> ")}`
      );

      // ONLY update the order state. The useEffect handles the consequences.
      return newOrder;
    });
  };
  // --- END moveSlider ---

  // --- Helper to get props - Reads from DISPLAYED state ---
  const getSliderProps = (sliderId) => {
    switch (sliderId) {
      case SLIDER_TYPES.JOURNAL:
        return { data: displayedJournals, activeItemId: selectedJournalId };
      case SLIDER_TYPES.PARTNER:
        return { data: displayedPartners, activeItemId: selectedPartnerId };
      case SLIDER_TYPES.GOODS:
        return { data: displayedGoods, activeItemId: selectedGoodsId };
      default:
        return { data: [], activeItemId: null };
    }
  };

  // === Render ===
  return (
    <div className={styles.pageContainer}>
      <h1 className={styles.title}>Welcome</h1>

      {/* --- NEW: Data Source Radio Buttons --- */}
      <div className={styles.dataSourceSelector}>
        <label>
          <input
            type="radio"
            name="dataSource"
            value="data1"
            checked={activeDataSource === "data1"}
            onChange={handleDataSourceChange}
          />
          All Entries
        </label>
        <label>
          <input
            type="radio"
            name="dataSource"
            value="data2"
            checked={activeDataSource === "data2"}
            onChange={handleDataSourceChange}
          />
          Filtered Entries
        </label>
      </div>
      {/* --- END: Data Source Radio Buttons --- */}

      {/* Visibility Toggle Buttons (Keep as is) */}
      <div className={styles.visibilityToggles}>
        {Object.values(SLIDER_TYPES).map((sliderId) => (
          <button
            key={`toggle-${sliderId}`}
            onClick={() => toggleVisibility(sliderId)}
            className={`${styles.toggleButton} ${
              visibility[sliderId] ? styles.toggleActive : ""
            }`}
          >
            {visibility[sliderId] ? "Hide" : "Show"}{" "}
            {SLIDER_CONFIG[sliderId].title}
          </button>
        ))}
      </div>

      {/* Order Info (Keep as is) */}
      <p className={styles.orderInfo}>
        Order:{" "}
        {sliderOrder
          .filter((id) => visibility[id]) // Show only visible sliders in order string
          .join(" → ")}
        {sliderOrder.filter((id) => !visibility[id]).length > 0 &&
          ` (Hidden: ${sliderOrder
            .filter((id) => !visibility[id])
            .map((id) => SLIDER_CONFIG[id].title)
            .join(", ")})`}
      </p>

      <LayoutGroup>
        <div className={styles.slidersArea}>
          <AnimatePresence>
            {sliderOrder.map((sliderId, index) => {
              // --- MOVE HOOK CALLS BEFORE CONDITIONAL RETURN ---
              const config = SLIDER_CONFIG[sliderId];
              const { Component, title } = config;
              const { data, activeItemId } = getSliderProps(sliderId);
              // Get accordion state for the currently active item in *this* slider
              // Default to false if no state exists for this item ID yet
              const isAccordionOpenForType = accordionTypeState[sliderId];

              // *** CALL useCallback UNCONDITIONALLY here ***
              const onSlideChangeCallback = useCallback(
                (id) => handleSwipe(sliderId, id),
                [handleSwipe, sliderId] // Dependencies remain the same
              );
              // --- END HOOK CALLS ---

              // --- CALCULATE MOVE VALIDITY ---
              let canMoveUp = false;
              if (index > 0) {
                // Simulate moving up
                const potentialOrderUp = [...sliderOrder];
                [potentialOrderUp[index], potentialOrderUp[index - 1]] = [
                  potentialOrderUp[index - 1],
                  potentialOrderUp[index],
                ];
                canMoveUp = isOrderAllowed(potentialOrderUp);
              }

              let canMoveDown = false;
              if (index < sliderOrder.length - 1) {
                // Simulate moving down
                const potentialOrderDown = [...sliderOrder];
                [potentialOrderDown[index], potentialOrderDown[index + 1]] = [
                  potentialOrderDown[index + 1],
                  potentialOrderDown[index],
                ];
                canMoveDown = isOrderAllowed(potentialOrderDown);
              }
              // --- END MOVE VALIDITY CALCULATION ---

              // Now, conditionally return null if not visible
              if (!visibility[sliderId]) {
                return null; // Exit AFTER hooks have been called for this iteration
              }

              // Render the visible component
              return (
                <motion.div
                  key={sliderId}
                  layoutId={sliderId}
                  layout
                  style={{ order: index }} // Keep order & hide outline
                  className={styles.sliderWrapper}
                  // --- ADD Animation Completion Callback ---
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    opacity: { duration: 0.3, ease: "easeInOut" },
                    height: { duration: 0.3, ease: "easeInOut" },
                    layout: { duration: 0.5, ease: "easeInOut" },
                  }}
                >
                  {/* --- MODIFIED: CONTROLS SECTION --- */}
                  <div className={styles.controls}>
                    {/* Left side: Either the Options button OR an empty placeholder */}
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
                      // {/* Empty div acts as the first element for space-between */}
                      // {/* Add a non-breaking space or style if needed, but often just the div is enough */}
                      <div className={styles.controlPlaceholder}> </div>
                      // Or just <div /> if that works
                    )}

                    {/* Right side: Wrapper for move buttons */}
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
                  {/* --- END CONTROLS MODIFICATION --- */}
                  {/* Component */}
                  <Component
                    sliderId={sliderId}
                    title={title}
                    data={data}
                    onSlideChange={onSlideChangeCallback} // Pass the hook result
                    activeItemId={activeItemId}
                    orderIndex={index}
                    // --- CHANGE: Pass type-based state and modified handler ---
                    isAccordionOpen={isAccordionOpenForType}
                    // Pass a function that calls the main toggle with the correct type
                    onToggleAccordion={() => toggleAccordion(sliderId)}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>
      <JournalModal isOpen={isJournalModalOpen} onClose={closeJournalModal} />
    </div>
  );
}
