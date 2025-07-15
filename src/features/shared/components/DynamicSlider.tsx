// src/features/shared/components/DynamicSlider.tsx
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import { IoFilterCircleOutline, IoCloseCircleOutline } from "react-icons/io5";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./DynamicSlider.module.css";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

interface DynamicSliderItem {
  id: string;
  label: string;
  jpqLinkId?: string;
  code?: string;
  unit_code?: string;
  [key: string]: any;
}

interface GPGContextJournalInfo {
  id: string;
  name: string | undefined;
  onClear: () => void;
}

interface DynamicSliderProps {
  sliderId: string;
  title: string;
  data?: DynamicSliderItem[];
  onSlideChange: (id: string | null) => void;
  activeItemId: string | null;
  isAccordionOpen: boolean;
  onToggleAccordion: () => void;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  isLocked?: boolean;
  isMultiSelect?: boolean;
  isItemSelected?: (item: DynamicSliderItem) => boolean;
  onItemClick?: (id: string) => void;
  showContextJournalFilterButton?: boolean;
  onOpenContextJournalFilterModal?: () => void;
  gpgContextJournalInfo?: GPGContextJournalInfo | null;
  placeholderMessage?: string;
}

const DynamicSlider: React.FC<DynamicSliderProps> = ({
  sliderId,
  title,
  data = [],
  onSlideChange,
  activeItemId,
  isAccordionOpen,
  onToggleAccordion,
  isLoading,
  isError,
  isLocked,
  isMultiSelect,
  isItemSelected,
  onItemClick,
  showContextJournalFilterButton,
  onOpenContextJournalFilterModal,
  gpgContextJournalInfo,
  placeholderMessage,
}) => {
  const initialSlideIndex = Math.max(
    0,
    data.findIndex((item) => item?.id === activeItemId)
  );

  const handleSwiperChange = (swiper: any) => {
    // This logic is already correct. In multi-select mode, swiping changes the
    // view but does NOT call onSlideChange, which is the desired behavior.
    if (isLocked || isMultiSelect) return;
    const currentRealIndex = swiper.activeIndex;
    if (data?.[currentRealIndex]) {
      onSlideChange(data[currentRealIndex].id);
    }
  };

  const currentItemForAccordion = data.find(
    (item) => item?.id === activeItemId
  );

  const swiperKey = `${sliderId}-len${data.length}-active${activeItemId}-locked${isLocked}-multi${isMultiSelect}`;

  return (
    <>
      <h2 className={styles.sliderTitle}>{title}</h2>

      {showContextJournalFilterButton && onOpenContextJournalFilterModal && (
        <button
          onClick={onOpenContextJournalFilterModal}
          className={styles.gpgFilterButton}
          title="Filter by a specific journal context"
        >
          <IoFilterCircleOutline /> Filter by Journal
        </button>
      )}
      {gpgContextJournalInfo && (
        <div className={styles.gpgContextDisplay}>
          <span>
            Filtered by:{" "}
            <strong>
              {gpgContextJournalInfo.name ||
                `Journal ID: ${gpgContextJournalInfo.id}`}
            </strong>
          </span>
          <button
            onClick={gpgContextJournalInfo.onClear}
            title="Clear context journal filter"
            className={styles.gpgClearButton}
          >
            <IoCloseCircleOutline /> Clear
          </button>
        </div>
      )}

      {isLoading && (
        <div className={styles.loadingState}>Loading {title}...</div>
      )}
      {isError && (
        <div className={styles.errorState}>Error loading {title}.</div>
      )}
      {!isLoading && !isError && data.length === 0 && (
        <div className={styles.noData}>
          {placeholderMessage || `No ${title.toLowerCase()} match criteria.`}
        </div>
      )}
      {!isLoading && isLocked && !isMultiSelect && (
        <div className={styles.lockedState}>
          {title} is locked for document creation.
        </div>
      )}
      {!isLoading && !isError && data.length > 0 && (
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
          } ${isMultiSelect ? styles.swiperMultiSelect : ""}`}
          allowTouchMove={!isLocked}
        >
          {data.map((item) => {
            if (!item) return null;
            const isSelectedForDoc = isItemSelected
              ? isItemSelected(item)
              : false;

            return (
              <SwiperSlide
                key={item.id}
                className={`${styles.slide} ${
                  isSelectedForDoc ? styles.slideSelectedForDocument : ""
                }`}
                onClick={() => onItemClick && onItemClick(item.id)}
              >
                <div className={styles.slideTextContent}>
                  <span className={styles.slideName}>
                    {item.label || "Unnamed Item"}
                  </span>
                  {(item.code || item.unit_code) && (
                    <span className={styles.slideSubText}>
                      {item.code || item.unit_code}
                    </span>
                  )}
                </div>
                {isSelectedForDoc && (
                  <div className={styles.selectedIndicator}>✓</div>
                )}
              </SwiperSlide>
            );
          })}
        </Swiper>
      )}

      {!isLoading &&
        !isError &&
        currentItemForAccordion &&
        onToggleAccordion && (
          <div className={styles.accordionContainer}>
            <button
              onClick={onToggleAccordion}
              className={styles.detailsButton}
              aria-expanded={isAccordionOpen}
            >
              Details{" "}
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
                    {Object.entries(currentItemForAccordion).map(
                      ([key, value]) => {
                        if (
                          ["id", "label", "children"].includes(key) ||
                          value === null ||
                          typeof value === "object"
                        )
                          return null;
                        return (
                          <p key={key}>
                            <strong>
                              {key.charAt(0).toUpperCase() +
                                key.slice(1).replace(/([A-Z])/g, " $1")}
                              :
                            </strong>{" "}
                            {String(value)}
                          </p>
                        );
                      }
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
    </>
  );
};

export default DynamicSlider;
