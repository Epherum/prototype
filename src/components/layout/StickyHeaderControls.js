// src/components/layout/StickyHeaderControls.js
"use client"; // If it uses client-side hooks like useRef for Swiper

import { useRef } from "react"; // Only if you pass visibilitySwiperRef down
import { motion, LayoutGroup } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules"; // Keep if Swiper needs it, even if nav buttons hidden
import "swiper/css";
// No need for "swiper/css/navigation" if visual nav buttons are not used for this Swiper.

import styles from "./StickyHeaderControls.module.css"; // Its own CSS module

// Assuming INITIAL_ORDER and SLIDER_CONFIG_REF are passed as props or imported if static
// For now, let's assume SLIDER_CONFIG_REF and INITIAL_ORDER are passed down or managed
// in a way that this component receives the necessary info.
// Alternatively, if INITIAL_ORDER is truly static, it can be imported from constants.

export default function StickyHeaderControls({
  visibility,
  onToggleVisibility,
  sliderOrder, // Used for numbering visible toggles
  initialSliderOrder, // The full, static order for rendering toggles
  sliderConfigs, // To get titles for the toggles: { [SLIDER_TYPES.JOURNAL]: { title: "Journal" }, ... }
  onVisibilitySwiper, // Callback to pass the swiper instance up
}) {
  // const visibilitySwiperRef = useRef(null); // Manage ref locally if not passed down

  return (
    <div className={styles.stickyHeaderContainer}>
      <LayoutGroup id="visibility-toggles-layout">
        <div className={styles.visibilitySwiperContainer}>
          <Swiper
            modules={[Navigation]} // Navigation module might still be needed for API, even if buttons are hidden
            spaceBetween={10}
            slidesPerView={"auto"}
            centeredSlides={false}
            loop={false}
            className={styles.visibilitySwiper}
            onSwiper={onVisibilitySwiper} // Pass instance up
            // onSwiper={(swiper) => { visibilitySwiperRef.current = swiper; }} // Or manage locally
            observer={true}
            observeParents={true}
          >
            {initialSliderOrder.map((sliderId) => {
              const config = sliderConfigs[sliderId];
              if (!config) return null;
              const title = config.title || sliderId;
              const isCurrentlyVisible = visibility[sliderId];
              let visibleIndex = -1;
              if (isCurrentlyVisible) {
                const visibleOrder = sliderOrder.filter((id) => visibility[id]);
                visibleIndex = visibleOrder.indexOf(sliderId);
              }
              return (
                <SwiperSlide
                  key={sliderId}
                  className={styles.visibilitySwiperSlide}
                >
                  <motion.div
                    layout
                    layoutId={`visibility-${sliderId}`} // Ensure this ID is unique if LayoutGroup is used elsewhere with similar IDs
                    className={styles.visibilitySlideContent}
                    initial={false}
                    animate={{
                      opacity: isCurrentlyVisible ? 1 : 0.4,
                      scale: isCurrentlyVisible ? 1 : 0.95,
                    }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <button
                      onClick={() => onToggleVisibility(sliderId)}
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
  );
}
