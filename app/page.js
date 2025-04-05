"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import styles from "./page.module.css";
import initialData from "./data.json";

// Swiper Imports
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

// Helper
const getFirstId = (arr) => (arr && arr.length > 0 ? arr[0].id : null);

// --- DynamicSlider Component (Minor adjustments for locked state display) ---
function DynamicSlider({
  sliderId,
  title,
  data = [], // Default to empty array
  onSlideChange,
  locked,
  activeItemId,
  orderIndex,
  isItemLocked, // NEW: flag if this slider contains the locked item
}) {
  const swiperRef = useRef(null);

  useEffect(() => {
    // Programmatically move swiper
    if (swiperRef.current && data.length > 0) {
      const activeIndex = data.findIndex((item) => item.id === activeItemId);
      const targetIndex = activeIndex !== -1 ? activeIndex : 0; // Go to 0 if not found
      if (swiperRef.current.activeIndex !== targetIndex) {
        swiperRef.current.slideTo(targetIndex, 0);
      }
      swiperRef.current.update(); // Update swiper state
    } else if (swiperRef.current) {
      swiperRef.current.update(); // Update even if empty
    }
  }, [activeItemId, data]);

  const handleSwiperChange = (swiper) => {
    if (!locked && data.length > swiper.activeIndex) {
      // Only call back if not locked
      onSlideChange(data[swiper.activeIndex].id);
    }
  };

  const lockedItemName =
    isItemLocked && data.length === 1 ? `: ${data[0].name}` : "";

  return (
    <div className={styles.sliderContent}>
      {/* Indicate Lock Status in Title */}
      <h2>
        {title} ({orderIndex + 1}){" "}
        {isItemLocked ? `[LOCKED${lockedItemName}]` : ""}
      </h2>
      {data.length > 0 ? (
        <Swiper
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
          modules={[Navigation, Pagination]}
          spaceBetween={30}
          slidesPerView={1}
          navigation={!locked}
          pagination={!locked ? { clickable: true } : false}
          allowTouchMove={!locked}
          onSlideChange={handleSwiperChange}
          className={`${styles.swiperInstance} ${
            locked ? styles.lockedSwiper : ""
          }`}
          initialSlide={Math.max(
            0,
            data.findIndex((item) => item.id === activeItemId)
          )}
          observer={true}
          observeParents={true}
          key={data.map((d) => d.id).join("-")} // Force re-render if data keys change significantly
        >
          {data.map((item) => (
            <SwiperSlide key={item.id} className={styles.slide}>
              {item.name}
              <small style={{ fontSize: "0.7em", color: "#888" }}>
                {" "}
                ({item.id})
              </small>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <div className={styles.noData}>No items match criteria.</div>
      )}
    </div>
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

  // NEW: State to track the ID and type of the locked item
  const [lockedItem, setLockedItem] = useState(null); // { type: 'partner' | 'goods', id: string } | null

  // NEW: State for slider visibility
  const [visibility, setVisibility] = useState({
    [SLIDER_TYPES.JOURNAL]: true, // Start visible
    [SLIDER_TYPES.PARTNER]: true, // Start visible
    [SLIDER_TYPES.GOODS]: false, // Start hidden
  });

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

              // *** CALL useCallback UNCONDITIONALLY here ***
              const onSlideChangeCallback = useCallback(
                (id) => handleSwipe(sliderId, id),
                [handleSwipe, sliderId] // Dependencies remain the same
              );
              // --- END HOOK CALLS ---

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
                    <button
                      onClick={() => moveSlider(sliderId, "up")}
                      disabled={index === 0}
                      className={styles.moveButton}
                    >
                      {" "}
                      ▲ Up{" "}
                    </button>
                    <button
                      onClick={() => moveSlider(sliderId, "down")}
                      disabled={index === sliderOrder.length - 1}
                      className={styles.moveButton}
                    >
                      {" "}
                      ▼ Down{" "}
                    </button>
                  </div>
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
