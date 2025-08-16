//src/components/layout/StickyHeaderControls.tsx
"use client";

import { motion, LayoutGroup } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { useState } from "react";
import "swiper/css";
import styles from "./StickyHeaderControls.module.css";
import type { SliderType, SliderVisibility } from "@/store/appStore"; // Import types from store

// Define the shape of the config object for clarity
interface SliderConfig {
  title: string;
}
type SliderConfigs = Record<SliderType, SliderConfig>;

interface StickyHeaderControlsProps {
  visibility: SliderVisibility;
  onToggleVisibility: (sliderId: SliderType) => void;
  // This is the full, unchanging order of all sliders defined in constants.
  allSliderIds: SliderType[];
  // The current, dynamic order of visible sliders to derive numbering.
  visibleSliderOrder: SliderType[];
  sliderConfigs: SliderConfigs;
  // This prop is no longer needed since we aren't passing a Swiper instance up
  // onVisibilitySwiper?: (swiper: any) => void;
}

export default function StickyHeaderControls({
  visibility,
  onToggleVisibility,
  allSliderIds,
  visibleSliderOrder,
  sliderConfigs,
}: StickyHeaderControlsProps) {
  const [expandedButton, setExpandedButton] = useState<SliderType | null>(null);

  const handleButtonClick = (sliderId: SliderType) => {
    // If clicking the same button that's expanded, collapse it and toggle visibility
    if (expandedButton === sliderId) {
      setExpandedButton(null);
      onToggleVisibility(sliderId);
    } else {
      // If the title is too long and would be truncated, expand it
      const title = sliderConfigs[sliderId]?.title || sliderId;
      if (title.length > 10) { // Threshold for when text might be truncated
        setExpandedButton(sliderId);
      } else {
        // If title is short enough, just toggle visibility
        onToggleVisibility(sliderId);
      }
    }
  };

  return (
    <div className={styles.stickyHeaderContainer}>
      <LayoutGroup id="visibility-toggles-layout">
        <div className={styles.visibilitySwiperContainer}>
          <Swiper
            modules={[Navigation]}
            spaceBetween={10}
            slidesPerView={"auto"}
            className={styles.visibilitySwiper}
            observer={true}
            observeParents={true}
          >
            {/* We map over the static list of ALL possible sliders */}
            {allSliderIds.map((sliderId) => {
              const config = sliderConfigs[sliderId];
              if (!config) return null;

              const title = config.title || sliderId;
              const isCurrentlyVisible = visibility[sliderId];
              const isExpanded = expandedButton === sliderId;

              // Find the index in the *visible* order array to get the number
              const visibleIndex = visibleSliderOrder.indexOf(sliderId);

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
                    <motion.button
                      onClick={() => handleButtonClick(sliderId)}
                      className={`${styles.visibilityButton} ${
                        isCurrentlyVisible
                          ? styles.visibilityActive
                          : styles.visibilityInactive
                      } ${isExpanded ? styles.expanded : ""}`}
                      aria-pressed={isCurrentlyVisible}
                      animate={{
                        maxWidth: isExpanded ? "300px" : "120px",
                      }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      {/* Display number only if it's visible */}
                      {isCurrentlyVisible && visibleIndex !== -1
                        ? `${visibleIndex + 1}: `
                        : ""}
                      {title}
                    </motion.button>
                  </motion.div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      </LayoutGroup>
    </div>
  );
}
