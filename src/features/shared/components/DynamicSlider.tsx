//src/features/shared/components/DynamicSlider.tsx
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import {
  IoTrashBinOutline,
  IoAddCircleOutline,
  IoFilterCircleOutline,
  IoCloseCircleOutline,
} from "react-icons/io5"; // Added icons
import { motion, AnimatePresence } from "framer-motion";
import styles from "./DynamicSlider.module.css";
import { SLIDER_TYPES } from "@/lib/constants";

interface DynamicSliderItem {
  id: string;
  name: string;
  code?: string;
  unit_code?: string;
  // Allow any other properties that might come from different data sources
  [key: string]: any;
}

// Type for GPG Context Journal Info passed from page.tsx
interface GPGContextJournalInfo {
  id: string;
  name: string | undefined; // Name might be undefined if still fetching
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
  onOpenModal?: () => void; // For entity options menu

  // Props primarily for Partner Slider
  isLocked?: boolean;

  // Props for Goods slider in Document Creation mode
  isDocumentCreationMode?: boolean;
  selectedGoodsForDoc?: Array<
    DynamicSliderItem & { quantity?: number; price?: number }
  >;
  onToggleGoodForDoc?: (item: DynamicSliderItem) => void;
  onUpdateGoodDetailForDoc?: (
    itemId: string,
    detail: { quantity?: number; price?: number }
  ) => void;

  // +++ New Props for GPG Context Journal Filtering (for GPG Slider 1) +++
  showContextJournalFilterButton?: boolean; // True if GPG S1 and no context journal selected
  onOpenContextJournalFilterModal?: () => void; // Callback to open the journal selector modal
  gpgContextJournalInfo?: GPGContextJournalInfo | null; // Info about the selected GPG context journal

  placeholderMessage?: string; // New prop
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
  // error, // error prop not explicitly used in JSX, but good to have for debugging
  // onOpenModal, // This is handled by page.tsx controls, not directly by slider content typically
  isLocked,
  isDocumentCreationMode,
  selectedGoodsForDoc = [], // Default to empty array
  onToggleGoodForDoc,
  onUpdateGoodDetailForDoc,
  // +++ Destructure GPG props +++
  showContextJournalFilterButton,
  onOpenContextJournalFilterModal,
  gpgContextJournalInfo,
  placeholderMessage, // Default placeholder message
}) => {
  const initialSlideIndex = Math.max(
    0,
    data.findIndex((item) => item?.id === activeItemId)
  );

  const handleSwiperChange = (swiper: any) => {
    // Added type for swiper
    if (isLocked) return;
    const currentRealIndex = swiper.activeIndex;
    if (data && data.length > currentRealIndex && data[currentRealIndex]) {
      onSlideChange(data[currentRealIndex].id);
    }
  };

  let currentItemForAccordion: DynamicSliderItem | undefined;
  if (!isLoading && !isError && data.length > 0) {
    currentItemForAccordion = data.find((item) => item?.id === activeItemId);
    if (
      !currentItemForAccordion &&
      initialSlideIndex < data.length &&
      data[initialSlideIndex]
    ) {
      currentItemForAccordion = data[initialSlideIndex];
    }
  }

  const swiperKey = `${sliderId}-len${data.length}-active${activeItemId}-locked${isLocked}-load${isLoading}-err${isError}-gpgCtx${gpgContextJournalInfo?.id}`;

  const currentGoodInDocument =
    isDocumentCreationMode &&
    sliderId === SLIDER_TYPES.GOODS &&
    activeItemId &&
    !isLoading &&
    !isError &&
    selectedGoodsForDoc // Ensure selectedGoodsForDoc is defined
      ? selectedGoodsForDoc.find((g) => g.id === activeItemId)
      : null;

  return (
    <>
      <h2 className={styles.sliderTitle}>{title}</h2>

      {showContextJournalFilterButton && onOpenContextJournalFilterModal && (
        <button
          onClick={onOpenContextJournalFilterModal}
          className={styles.gpgFilterButton} // Uses the class
          title="Filter goods by a specific journal context for G-P-G view"
        >
          <IoFilterCircleOutline /> Filter by Journal for G-P{" "}
          {/* Updated text slightly */}
        </button>
      )}
      {gpgContextJournalInfo && (
        <div className={styles.gpgContextDisplay}>
          {" "}
          {/* Uses the class */}
          <span>
            Filtered by:{" "}
            <strong>
              {gpgContextJournalInfo.name ||
                `Journal ID: ${gpgContextJournalInfo.id}`}
            </strong>
          </span>
          <button
            onClick={gpgContextJournalInfo.onClear}
            title="Clear G-P journal filter"
            className={styles.gpgClearButton} // Uses the class
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
          }`}
          allowTouchMove={!isLocked}
        >
          {data.map((item) => {
            if (!item) return null;
            const isSelectedForDocument =
              isDocumentCreationMode &&
              sliderId === SLIDER_TYPES.GOODS &&
              selectedGoodsForDoc.some((g) => g.id === item.id);

            return (
              <SwiperSlide
                key={item.id}
                className={`${styles.slide} ${
                  isSelectedForDocument ? styles.slideSelectedForDocument : ""
                }`}
              >
                <div className={styles.slideTextContent}>
                  <span className={styles.slideName}>
                    {item.name || item.id || "Unnamed Item"}
                  </span>
                  {(item.code || item.unit_code) && (
                    <span className={styles.slideSubText}>
                      {item.code || item.unit_code}
                    </span>
                  )}
                </div>
                {isSelectedForDocument && (
                  <div className={styles.selectedGoodIndicator}>
                    ✓ In Document
                  </div>
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
              Details
              {isDocumentCreationMode &&
                sliderId === SLIDER_TYPES.GOODS &&
                currentGoodInDocument &&
                " (Editing for Doc)"}
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
                    {/* Displaying other known common fields dynamically for flexibility */}
                    {Object.entries(currentItemForAccordion).map(
                      ([key, value]) => {
                        if (
                          [
                            "id",
                            "name",
                            "children",
                            "code",
                            "unit_code",
                          ].includes(key) ||
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

                    {isDocumentCreationMode &&
                      sliderId === SLIDER_TYPES.GOODS &&
                      onToggleGoodForDoc &&
                      onUpdateGoodDetailForDoc && (
                        <div className={styles.documentGoodDetails}>
                          <h4>
                            Document Specifics for{" "}
                            {currentItemForAccordion.name}:
                          </h4>
                          <button
                            onClick={() =>
                              onToggleGoodForDoc(currentItemForAccordion)
                            }
                            className={`${styles.modalActionButton} ${
                              currentGoodInDocument
                                ? styles.removeButton
                                : styles.addButton
                            }`}
                          >
                            {currentGoodInDocument ? (
                              <IoTrashBinOutline />
                            ) : (
                              <IoAddCircleOutline />
                            )}
                            {currentGoodInDocument
                              ? "Remove from Document"
                              : "Add to Document"}
                          </button>
                          {currentGoodInDocument && (
                            <>
                              <div className={styles.formGroup}>
                                <label
                                  htmlFor={`qty-${currentItemForAccordion.id}`}
                                >
                                  Quantity:
                                </label>
                                <input
                                  type="number"
                                  id={`qty-${currentItemForAccordion.id}`}
                                  value={currentGoodInDocument.quantity ?? ""}
                                  onChange={(e) =>
                                    onUpdateGoodDetailForDoc(
                                      currentItemForAccordion.id,
                                      {
                                        quantity:
                                          parseFloat(e.target.value) || 0,
                                      }
                                    )
                                  }
                                  min="0"
                                  className={styles.formInputSmall}
                                />
                              </div>
                              <div className={styles.formGroup}>
                                <label
                                  htmlFor={`price-${currentItemForAccordion.id}`}
                                >
                                  Price per unit:
                                </label>
                                <input
                                  type="number"
                                  id={`price-${currentItemForAccordion.id}`}
                                  value={currentGoodInDocument.price ?? ""}
                                  onChange={(e) =>
                                    onUpdateGoodDetailForDoc(
                                      currentItemForAccordion.id,
                                      { price: parseFloat(e.target.value) || 0 }
                                    )
                                  }
                                  min="0"
                                  step="0.01"
                                  className={styles.formInputSmall}
                                />
                              </div>
                              <div className={styles.formGroup}>
                                <label
                                  htmlFor={`amount-${currentItemForAccordion.id}`}
                                >
                                  Total Amount:
                                </label>
                                <input
                                  type="number"
                                  id={`amount-${currentItemForAccordion.id}`}
                                  value={
                                    currentGoodInDocument.quantity != null &&
                                    currentGoodInDocument.price != null
                                      ? currentGoodInDocument.quantity *
                                        currentGoodInDocument.price
                                      : ""
                                  }
                                  readOnly
                                  disabled
                                  className={styles.formInputSmall}
                                />
                              </div>
                            </>
                          )}
                        </div>
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
