"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion"; // Ensure AnimatePresence is imported
import Image from "next/image"; // <-- Import Next.js Image
import styles from "./page.module.css";
import initialData from "./data.json";

// Swiper Imports
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

import {
  IoCartOutline, // For Buy/Procurement
  IoPricetagOutline, // For Sell
  IoBuildOutline, // For Manufacturing
  IoWalletOutline, // For Finance
  IoNavigateOutline, // For Logistics
  IoClipboardOutline, // For Inventory/Adjustment
} from "react-icons/io5";

// Helper
const getFirstId = (arr) => (arr && arr.length > 0 ? arr[0].id : null);

// --- DynamicSlider Component (Major Updates) ---
function DynamicSlider({
  sliderId,
  title,
  data = [], // Default to empty array for safety
  onSlideChange,
  locked,
  activeItemId,
  orderIndex,
  isItemLocked,
  // Accordion props
  isAccordionOpen,
  onToggleAccordion, // Expects the handler from the parent, e.g., () => toggleAccordion(sliderId)
}) {
  const swiperRef = useRef(null);

  // Effect to programmatically move swiper when activeItemId or data changes
  useEffect(() => {
    if (swiperRef.current && data.length > 0) {
      const activeIndex = data.findIndex((item) => item.id === activeItemId);
      const targetIndex = activeIndex !== -1 ? activeIndex : 0; // Go to 0 if not found
      const currentRealIndex =
        swiperRef.current.realIndex !== undefined
          ? swiperRef.current.realIndex
          : swiperRef.current.activeIndex;

      // Use slideToLoop if loop=true, otherwise slideTo
      // Check if the swiper isn't already animating and the index needs changing
      if (!swiperRef.current.animating && currentRealIndex !== targetIndex) {
        if (swiperRef.current.params.loop) {
          swiperRef.current.slideToLoop(targetIndex, 0); // 0ms transition for programmatic changes
        } else {
          swiperRef.current.slideTo(targetIndex, 0);
        }
      }
      // Ensure swiper updates its internal state if data/params changed
      swiperRef.current.update();
    } else if (swiperRef.current) {
      swiperRef.current.update(); // Update even if empty
    }
  }, [activeItemId, data]); // Rerun when active ID or data itself changes

  // Handler for when user manually swipes
  const handleSwiperChange = (swiper) => {
    // Use realIndex when loop is enabled
    const currentRealIndex =
      swiper.realIndex !== undefined ? swiper.realIndex : swiper.activeIndex;
    if (!locked && data.length > currentRealIndex) {
      // Callback to parent component to update the selected ID state
      onSlideChange(data[currentRealIndex].id);
    }
  };

  // Find the currently active item based on state to display details/image
  const currentItem = data.find((item) => item.id === activeItemId);

  // Prepare locked item display name
  const lockedItemName =
    isItemLocked && currentItem ? `: ${currentItem.name}` : "";

  return (
    <>
      {/* Slider Title Section */}
      <h2 className={styles.sliderTitle}>
        <span>
          {" "}
          {/* Span helps with flex alignment if needed */}
          {title} ({orderIndex + 1}){" "}
          {isItemLocked ? `[LOCKED${lockedItemName}]` : ""}
        </span>
      </h2>

      {/* Swiper Section */}
      {data.length > 0 ? (
        <Swiper
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
          modules={[Navigation, Pagination]}
          loop={data.length > 1} // Enable loop only if more than 1 slide
          spaceBetween={20} // Spacing between slides (if using slidesPerView > 1)
          slidesPerView={1} // Show one slide at a time
          navigation={!locked && data.length > 1} // Show nav buttons if not locked and more than 1 slide
          pagination={!locked && data.length > 1 ? { clickable: true } : false} // Show pagination if not locked and more than 1 slide
          allowTouchMove={!locked} // Disable swiping if locked
          onSlideChange={handleSwiperChange} // Update state on user swipe
          className={`${styles.swiperInstance} ${
            locked ? styles.lockedSwiper : ""
          }`}
          // Robust key to force re-initialization when data source or lock status changes significantly
          key={data.map((d) => d.id).join("-") + `-${locked}-${sliderId}`}
          initialSlide={Math.max(
            0,
            data.findIndex((item) => item.id === activeItemId)
          )} // Set starting slide
          observer={true} // Detect changes to Swiper parent
          observeParents={true} // Detect changes to Swiper parent
        >
          {data.map((item) => {
            // Determine which icon to use for Journal items
            let IconComponent = null;
            if (sliderId === SLIDER_TYPES.JOURNAL && JOURNAL_ICONS[item.id]) {
              IconComponent = JOURNAL_ICONS[item.id];
            }

            return (
              <SwiperSlide key={item.id} className={styles.slide}>
                {/* Conditional Image for Partners and Goods */}
                {(sliderId === SLIDER_TYPES.PARTNER ||
                  sliderId === SLIDER_TYPES.GOODS) &&
                  item.imageUrl && (
                    <div className={styles.slideImageWrapper}>
                      <Image
                        src={item.imageUrl} // Assumes local path like /images/placeholders/...
                        alt={item.name}
                        width={400} // IMPORTANT: Set to your placeholder's actual width
                        height={200} // IMPORTANT: Set to your placeholder's actual height
                        className={styles.slideImage}
                        priority={item.id === activeItemId} // Load active slide image sooner
                      />
                    </div>
                  )}
                {/* Text Content Area */}
                <div className={styles.slideTextContent}>
                  {/* Render Journal Icon */}
                  {IconComponent && (
                    <IconComponent
                      className={styles.slideIcon}
                      aria-hidden="true"
                    />
                  )}
                  {/* Render Item Name */}
                  <span className={styles.slideName}>{item.name}</span>

                  {/* Render Sub-text Conditionally */}
                  {sliderId === SLIDER_TYPES.GOODS &&
                    item.quantity !== undefined && (
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
        // Display when no data matches filters
        <div className={styles.noData}>No items match criteria.</div>
      )}

      {/* Accordion Section - Shows details for the currently active item */}
      {currentItem && (
        <div className={styles.accordionContainer}>
          {/* Button to toggle accordion visibility */}
          <button
            onClick={onToggleAccordion} // Calls parent handler: () => toggleAccordion(sliderId)
            className={styles.detailsButton}
            aria-expanded={isAccordionOpen}
          >
            Details
            <span
              className={`${styles.accordionIcon} ${
                isAccordionOpen ? styles.accordionIconOpen : ""
              }`}
            >
              ▼ {/* Arrow indicator */}
            </span>
          </button>
          {/* AnimatePresence handles the mounting/unmounting */}
          <AnimatePresence initial={false}>
            {isAccordionOpen && ( // Conditionally render details content
              <motion.div
                key={`details-${sliderId}`} // Use sliderId for stable key during open/close
                initial="collapsed"
                animate="open"
                exit="collapsed"
                variants={{
                  // Simplified variants: Only animate opacity
                  open: { opacity: 1 },
                  collapsed: { opacity: 0 },
                }}
                transition={{ duration: 0.2, ease: "linear" }} // Simple fade transition
                className={styles.detailsContentWrapper} // Wrapper needed for overflow: hidden
              >
                {/* Actual details content */}
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
                  {/* Journal details are primarily in its description */}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

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

const JOURNAL_ICONS = {
  "journal-1": IoCartOutline,
  "journal-2": IoPricetagOutline,
  "journal-3": IoBuildOutline,
  "journal-4": IoWalletOutline,
  "journal-5": IoNavigateOutline,
  "journal-6": IoClipboardOutline,
};

// --- Main Page Component ---
export default function Home() {
  // === State ===
  const [sliderOrder, setSliderOrder] = useState(INITIAL_ORDER);
  const [selectedJournalId, setSelectedJournalId] = useState(
    getFirstId(initialData.journals)
  );
  const [selectedPartnerId, setSelectedPartnerId] = useState(
    getFirstId(initialData.partners)
  );
  const [selectedGoodsId, setSelectedGoodsId] = useState(
    getFirstId(initialData.goods)
  );
  const [displayedJournals, setDisplayedJournals] = useState(
    initialData.journals
  );
  const [displayedPartners, setDisplayedPartners] = useState(
    initialData.partners
  );
  const [displayedGoods, setDisplayedGoods] = useState(initialData.goods);

  // NEW: State for accordion open/closed status, keyed by item ID

  // --- CHANGE: State for accordion open/closed status, keyed by SLIDER TYPE ---
  const [accordionTypeState, setAccordionTypeState] = useState({
    [SLIDER_TYPES.JOURNAL]: false, // Start closed
    [SLIDER_TYPES.PARTNER]: false, // Start closed
    [SLIDER_TYPES.GOODS]: false, // Start closed
  });

  // NEW: State for slider visibility
  const [visibility, setVisibility] = useState({
    [SLIDER_TYPES.JOURNAL]: true, // Start visible
    [SLIDER_TYPES.PARTNER]: true, // Start visible
    [SLIDER_TYPES.GOODS]: false, // Start hidden
  });

  const [lockedItem, setLockedItem] = useState(null);

  // === Derived State ===
  const getLockedSliderType = () => lockedItem?.type || null;
  const isSliderLocked = (sliderId) => getLockedSliderType() === sliderId; // Is this *type* of slider locked?
  const isSpecificItemLocked = (sliderId) =>
    lockedItem !== null && sliderId === sliderOrder[0]; // Is the first slider containing the locked item?

  // === Filtering Effect ===
  useEffect(() => {
    console.log("--- Recalculating Filters ---");
    console.log("Order:", sliderOrder.join(" -> "));
    console.log("Locked Item:", lockedItem);
    console.log("Current Selections:", {
      journal: selectedJournalId,
      partner: selectedPartnerId,
      goods: selectedGoodsId,
    });

    // Start with full data or data pre-filtered by locked item
    let filteredJournals = [...initialData.journals];
    let filteredPartners = [...initialData.partners];
    let filteredGoods = [...initialData.goods];
    let activeSelections = {
      journal: selectedJournalId,
      partner: selectedPartnerId,
      goods: selectedGoodsId,
    };

    // --- Step 1: Apply Lock Filter (if any) ---
    if (lockedItem) {
      activeSelections[lockedItem.type] = lockedItem.id; // Ensure selection matches lock

      if (lockedItem.type === SLIDER_TYPES.PARTNER) {
        const lockedPartnerObj = initialData.partners.find(
          (p) => p.id === lockedItem.id
        );
        if (lockedPartnerObj) {
          console.log(`Applying Lock: PARTNER ${lockedItem.id}`);
          filteredPartners = [lockedPartnerObj]; // Only the locked partner
          filteredJournals = initialData.journals.filter((j) =>
            lockedPartnerObj.journals.includes(j.id)
          );
          filteredGoods = initialData.goods.filter((g) =>
            lockedPartnerObj.goods.includes(g.id)
          );
          // Reset selections for downstream sliders if they aren't compatible
          if (
            selectedJournalId &&
            !filteredJournals.some((j) => j.id === selectedJournalId)
          ) {
            activeSelections.journal = getFirstId(filteredJournals);
            console.log(
              "  Resetting Journal selection due to lock:",
              activeSelections.journal
            );
          }
          if (
            selectedGoodsId &&
            !filteredGoods.some((g) => g.id === selectedGoodsId)
          ) {
            activeSelections.goods = getFirstId(filteredGoods);
            console.log(
              "  Resetting Goods selection due to lock:",
              activeSelections.goods
            );
          }
        } else {
          console.error("Locked partner not found!"); // Should not happen
          filteredPartners = [];
          filteredJournals = [];
          filteredGoods = [];
        }
      } else if (lockedItem.type === SLIDER_TYPES.GOODS) {
        const lockedGoodObj = initialData.goods.find(
          (g) => g.id === lockedItem.id
        );
        if (lockedGoodObj) {
          console.log(`Applying Lock: GOODS ${lockedItem.id}`);
          filteredGoods = [lockedGoodObj]; // Only the locked good
          // Assuming a good belongs to only one journal based on data model
          filteredJournals = initialData.journals.filter(
            (j) => j.id === lockedGoodObj.journal
          );
          filteredPartners = initialData.partners.filter(
            (p) =>
              Array.isArray(lockedGoodObj.ownedBy) &&
              lockedGoodObj.ownedBy.includes(p.id)
          );
          // Reset selections for downstream sliders
          if (
            selectedJournalId &&
            !filteredJournals.some((j) => j.id === selectedJournalId)
          ) {
            activeSelections.journal = getFirstId(filteredJournals);
            console.log(
              "  Resetting Journal selection due to lock:",
              activeSelections.journal
            );
          }
          if (
            selectedPartnerId &&
            !filteredPartners.some((p) => p.id === selectedPartnerId)
          ) {
            activeSelections.partner = getFirstId(filteredPartners);
            console.log(
              "  Resetting Partner selection due to lock:",
              activeSelections.partner
            );
          }
        } else {
          console.error("Locked good not found!");
          filteredGoods = [];
          filteredJournals = [];
          filteredPartners = [];
        }
      }
    }

    // --- Step 2: Apply Sequential Filters based on Order ---
    let currentJournal = filteredJournals.find(
      (j) => j.id === activeSelections.journal
    );
    let currentPartner = filteredPartners.find(
      (p) => p.id === activeSelections.partner
    );
    let currentGoods = filteredGoods.find(
      (g) => g.id === activeSelections.goods
    );

    for (let i = 0; i < sliderOrder.length - 1; i++) {
      const sourceSlider = sliderOrder[i];
      const targetSlider = sliderOrder[i + 1];

      // Skip filtering *from* a locked slider OR filtering *into* a locked slider
      if (isSliderLocked(sourceSlider) || isSliderLocked(targetSlider)) {
        console.log(
          `Skipping filter step ${
            i + 1
          }: ${sourceSlider} -> ${targetSlider} (involved locked type)`
        );
        continue;
      }

      console.log(
        `Filtering Step ${i + 1}: ${sourceSlider} -> ${targetSlider}`
      );

      // Apply filters based on current selections (which might have been updated by lock)
      // Use the `filteredJournals`, `filteredPartners`, `filteredGoods` lists

      if (
        sourceSlider === SLIDER_TYPES.JOURNAL &&
        targetSlider === SLIDER_TYPES.PARTNER
      ) {
        if (currentJournal) {
          filteredPartners = filteredPartners.filter((p) =>
            p.journals.includes(currentJournal.id)
          );
          console.log(
            `  Filtered Partners by Journal ${currentJournal.id}:`,
            filteredPartners.map((p) => p.id)
          );
        } else {
          filteredPartners = [];
        }
      } else if (
        sourceSlider === SLIDER_TYPES.PARTNER &&
        targetSlider === SLIDER_TYPES.GOODS
      ) {
        if (currentPartner) {
          filteredGoods = filteredGoods.filter((g) =>
            currentPartner.goods.includes(g.id)
          );
          // Additional check: Ensure good's journal matches selected journal if it came before partner
          const journalIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
          if (currentJournal && journalIndex !== -1 && journalIndex < i) {
            filteredGoods = filteredGoods.filter(
              (g) => g.journal === currentJournal.id
            );
          }
          console.log(
            `  Filtered Goods by Partner ${currentPartner.id}:`,
            filteredGoods.map((g) => g.id)
          );
        } else {
          filteredGoods = [];
        }
      } else if (
        sourceSlider === SLIDER_TYPES.JOURNAL &&
        targetSlider === SLIDER_TYPES.GOODS
      ) {
        if (currentJournal) {
          filteredGoods = filteredGoods.filter(
            (g) => g.journal === currentJournal.id
          );
          console.log(
            `  Filtered Goods by Journal ${currentJournal.id}:`,
            filteredGoods.map((g) => g.id)
          );
        } else {
          filteredGoods = [];
        }
      } else if (
        sourceSlider === SLIDER_TYPES.GOODS &&
        targetSlider === SLIDER_TYPES.PARTNER
      ) {
        if (currentGoods && Array.isArray(currentGoods.ownedBy)) {
          filteredPartners = filteredPartners.filter((p) =>
            currentGoods.ownedBy.includes(p.id)
          );
          // Additional check: Filter partners by journal if it came before goods
          const journalIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
          if (currentJournal && journalIndex !== -1 && journalIndex < i) {
            filteredPartners = filteredPartners.filter((p) =>
              p.journals.includes(currentJournal.id)
            );
          }
          console.log(
            `  Filtered Partners by Goods ${currentGoods.id}:`,
            filteredPartners.map((p) => p.id)
          );
        } else {
          filteredPartners = [];
        }
      }
      // Other specific mode logic might be simplified now due to the lock pre-filter

      // Update 'current' selections for the next iteration based on the *newly filtered* lists
      currentJournal = filteredJournals.find(
        (j) => j.id === activeSelections.journal
      );
      currentPartner = filteredPartners.find(
        (p) => p.id === activeSelections.partner
      );
      currentGoods = filteredGoods.find((g) => g.id === activeSelections.goods);
    }

    // --- Step 3: Final Update and Selection Reset Check ---
    console.log("Final Filtered Data:", {
      journals: filteredJournals.length,
      partners: filteredPartners.length,
      goods: filteredGoods.length,
    });
    setDisplayedJournals(filteredJournals);
    setDisplayedPartners(filteredPartners);
    setDisplayedGoods(filteredGoods);

    // Reset selections IF the selected item is no longer valid in the FINAL filtered list
    // Respect locked item - its selection should not be reset
    if (
      lockedItem?.type !== SLIDER_TYPES.JOURNAL &&
      selectedJournalId &&
      !filteredJournals.some((j) => j.id === selectedJournalId)
    ) {
      const newSelection = getFirstId(filteredJournals);
      console.log(`Resetting Journal selection to ${newSelection}`);
      setSelectedJournalId(newSelection);
    }
    if (
      lockedItem?.type !== SLIDER_TYPES.PARTNER &&
      selectedPartnerId &&
      !filteredPartners.some((p) => p.id === selectedPartnerId)
    ) {
      const newSelection = getFirstId(filteredPartners);
      console.log(`Resetting Partner selection to ${newSelection}`);
      setSelectedPartnerId(newSelection);
    }
    if (
      lockedItem?.type !== SLIDER_TYPES.GOODS &&
      selectedGoodsId &&
      !filteredGoods.some((g) => g.id === selectedGoodsId)
    ) {
      const newSelection = getFirstId(filteredGoods);
      console.log(`Resetting Goods selection to ${newSelection}`);
      setSelectedGoodsId(newSelection);
    }

    // DEPENDENCY ARRAY: Add lockedItem
  }, [
    sliderOrder,
    selectedJournalId,
    selectedPartnerId,
    selectedGoodsId,
    lockedItem,
  ]);

  // === Event Handlers ===
  const handleSwipe = useCallback(
    (sourceSliderId, selectedItemId) => {
      // Do not update state if the swiped slider is the locked one
      if (isSliderLocked(sourceSliderId)) {
        console.log(`Swipe ignored on locked slider: ${sourceSliderId}`);
        return;
      }

      console.log(
        `Swipe handled on ${sourceSliderId}, selected: ${selectedItemId}`
      );
      if (sourceSliderId === SLIDER_TYPES.JOURNAL)
        setSelectedJournalId(selectedItemId);
      else if (sourceSliderId === SLIDER_TYPES.PARTNER)
        setSelectedPartnerId(selectedItemId);
      else if (sourceSliderId === SLIDER_TYPES.GOODS)
        setSelectedGoodsId(selectedItemId);
      // useEffect handles filtering
    },
    [isSliderLocked]
  ); // Add dependency

  // --- CHANGE: Accordion Toggle Handler - now operates on SLIDER TYPE ---
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
        return; // Safety check for valid type
      setAccordionTypeState((prev) => ({
        ...prev,
        [sliderType]: !prev[sliderType], // Toggle the state for this specific TYPE
      }));
      console.log(
        `Toggled accordion for type ${sliderType} to ${!accordionTypeState[
          sliderType
        ]}`
      );
    },
    [accordionTypeState]
  ); // Dependency updated

  const moveSlider = (sliderId, direction) => {
    // Capture selections *before* changing order
    const currentSelections = {
      journal: selectedJournalId,
      partner: selectedPartnerId,
      goods: selectedGoodsId,
    };

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
      console.log("Order changed:", newOrder);

      // Determine if the new order should trigger a lock
      const firstSliderType = newOrder[0];
      let newLockedItem = null;

      if (firstSliderType === SLIDER_TYPES.PARTNER) {
        newLockedItem = {
          type: SLIDER_TYPES.PARTNER,
          id: currentSelections.partner,
        };
        console.log("Locking Partner:", newLockedItem.id);
        // Keep partner selection, reset others (useEffect will refine based on lock)
        setSelectedJournalId(null); // Trigger reset check in useEffect
        setSelectedGoodsId(null);
        setSelectedPartnerId(newLockedItem.id); // Ensure locked ID is selected
      } else if (firstSliderType === SLIDER_TYPES.GOODS) {
        newLockedItem = {
          type: SLIDER_TYPES.GOODS,
          id: currentSelections.goods,
        };
        console.log("Locking Goods:", newLockedItem.id);
        // Keep goods selection, reset others
        setSelectedJournalId(null);
        setSelectedPartnerId(null);
        setSelectedGoodsId(newLockedItem.id); // Ensure locked ID is selected
      } else {
        // No lock (e.g., Journal is first), reset all selections
        console.log("Unlocking / No Lock. Resetting selections.");
        setSelectedJournalId(getFirstId(initialData.journals));
        setSelectedPartnerId(getFirstId(initialData.partners));
        setSelectedGoodsId(getFirstId(initialData.goods));
      }

      // Set the lock state AFTER order state is updated
      // Use a timeout to ensure state updates related to order happen first? Maybe not needed.
      setLockedItem(newLockedItem);

      return newOrder;
    });
  };

  // Helper to get props
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

  const toggleVisibility = (sliderId) => {
    setVisibility((prev) => ({
      ...prev,
      [sliderId]: !prev[sliderId],
    }));
    console.log(
      `Toggled visibility for ${sliderId} to ${!visibility[sliderId]}`
    );
  };

  // === Render ===
  return (
    <div className={styles.pageContainer}>
      <h1 className={styles.title}>Welcome</h1>

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
        {lockedItem ? ` (Locked: ${lockedItem.type} ${lockedItem.id})` : ""}
      </p>

      <LayoutGroup>
        <div className={styles.slidersArea}>
          <AnimatePresence>
            {sliderOrder.map((sliderId, index) => {
              // --- MOVE HOOK CALLS BEFORE CONDITIONAL RETURN ---
              const config = SLIDER_CONFIG[sliderId];
              const { Component, title } = config;
              const { data, activeItemId } = getSliderProps(sliderId);
              const isLockedForSwiper = isSliderLocked(sliderId);
              const isContainingLockedItem = isSpecificItemLocked(sliderId);
              // Get accordion state for the currently active item in *this* slider
              // Default to false if no state exists for this item ID yet
              const isAccordionOpenForType = accordionTypeState[sliderId];

              // *** CALL useCallback UNCONDITIONALLY here ***
              const onSlideChangeCallback = useCallback(
                (id) => handleSwipe(sliderId, id),
                [handleSwipe, sliderId] // Dependencies remain the same
              );
              // --- END HOOK CALLS ---

              // Calculate if first/last for button visibility
              const isFirst = index === 0;
              const isLast = index === sliderOrder.length - 1;

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
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    opacity: { duration: 0.3, ease: "easeInOut" },
                    height: { duration: 0.3, ease: "easeInOut" },
                    layout: { duration: 0.5, ease: "easeInOut" },
                  }}
                  style={{ order: index }}
                  className={styles.sliderWrapper}
                >
                  {/* Controls */}
                  <div className={styles.controls}>
                    {/* Conditionally render "Up" button */}
                    {!isFirst && (
                      <button
                        onClick={() => moveSlider(sliderId, "up")}
                        // disabled={isFirst} // <-- REMOVE disabled prop
                        className={styles.moveButton}
                      >
                        ▲ Up
                      </button>
                    )}
                    {/* Conditionally render "Down" button */}
                    {!isLast && (
                      <button
                        onClick={() => moveSlider(sliderId, "down")}
                        // disabled={isLast} // <-- REMOVE disabled prop
                        className={styles.moveButton}
                      >
                        ▼ Down
                      </button>
                    )}
                  </div>
                  {/* --- END CONTROLS MODIFICATION --- */}
                  {/* Component */}
                  <Component
                    sliderId={sliderId}
                    title={title}
                    data={data}
                    onSlideChange={onSlideChangeCallback} // Pass the hook result
                    locked={isLockedForSwiper}
                    activeItemId={activeItemId}
                    orderIndex={index}
                    isItemLocked={isContainingLockedItem}
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
    </div>
  );
}
