//src/features/shared/components/DynamicSlider.tsx
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import { IoFilterCircleOutline, IoCloseCircleOutline } from "react-icons/io5";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./DynamicSlider.module.css";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

// Define animation variants for the slider content area.
const sliderContentVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
  exit: { opacity: 0, y: -15, transition: { duration: 0.25, ease: "easeIn" } },
};

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
    if (isLocked) return;
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

      <div className={styles.contentWrapper}>
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.div
              key="loading"
              className={styles.stateOverlay}
              variants={sliderContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              Loading {title}...
            </motion.div>
          ) : isError ? (
            <motion.div
              key="error"
              className={`${styles.stateOverlay} ${styles.errorState}`}
              variants={sliderContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              Error loading {title}.
            </motion.div>
          ) : data.length === 0 ? (
            <motion.div
              key="no-data"
              className={styles.stateOverlay}
              variants={sliderContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {placeholderMessage ||
                `No ${title.toLowerCase()} match criteria.`}
            </motion.div>
          ) : (
            <motion.div
              key="data"
              variants={sliderContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {!isLocked && isMultiSelect && (
                <div className={styles.lockedState}>
                  Select items to include in the document.
                </div>
              )}
              {isLocked && !isMultiSelect && (
                <div className={styles.lockedState}>
                  {title} is locked for document creation.
                </div>
              )}
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
                        {item.journalNames && (
                          <span className={styles.slideJournalInfo}>
                            Journals: {item.journalNames}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
                  transition={{
                    duration: 0.3,
                    ease: [0.04, 0.62, 0.23, 0.98],
                  }}
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
