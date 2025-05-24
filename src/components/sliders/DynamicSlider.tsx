// src/components/sliders/DynamicSlider.tsx
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import { IoTrashBinOutline, IoAddCircleOutline } from "react-icons/io5";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./DynamicSlider.module.css";
import { SLIDER_TYPES, JOURNAL_ICONS } from "@/lib/constants"; // Ensure JOURNAL_ICONS is relevant or remove if not used for all dynamic sliders

interface DynamicSliderItem {
  // Or whatever your item type is
  id: string;
  name: string; // Or label
  code?: string; // Or referenceCode
  // ... any other fields displayed in the item
  unit_code?: string;
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
  onOpenModal?: () => void;

  // Props primarily for Partner Slider
  isLocked?: boolean;

  // +++ Make these props optional, as they are specific to Goods slider usage +++
  isDocumentCreationMode?: boolean;
  selectedGoodsForDoc?: Array<
    DynamicSliderItem & {
      quantity?: number;
      price?: number /* other doc details */;
    }
  >;
  onToggleGoodForDoc?: (item: DynamicSliderItem) => void;
  onUpdateGoodDetailForDoc?: (
    itemId: string,
    detail: { quantity?: number; price?: number }
  ) => void;
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
  error,
  onOpenModal,
  isLocked,
  // Destructure the optional props
  isDocumentCreationMode,
  selectedGoodsForDoc,
  onToggleGoodForDoc,
  onUpdateGoodDetailForDoc,
}) => {
  const initialSlideIndex = Math.max(
    0,
    data.findIndex((item) => item?.id === activeItemId)
  );

  const handleSwiperChange = (swiper) => {
    if (isLocked) return;

    const currentRealIndex = swiper.activeIndex;
    if (data && data.length > currentRealIndex && data[currentRealIndex]) {
      onSlideChange(data[currentRealIndex].id);
    } else {
      console.warn(
        `DynamicSlider (${sliderId}): Swipe Change - Invalid index (${currentRealIndex}) or data. Len: ${data?.length}`
      );
    }
  };

  // currentItemForAccordion should be derived from non-loading, non-error data
  let currentItemForAccordion;
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

  const swiperKey = `${sliderId}-len${data.length}-active${activeItemId}-locked${isLocked}-load${isLoading}-err${isError}`;

  const currentGoodInDocument =
    isDocumentCreationMode &&
    sliderId === SLIDER_TYPES.GOODS &&
    activeItemId &&
    !isLoading &&
    !isError
      ? selectedGoodsForDoc.find((g) => g.id === activeItemId)
      : null;

  return (
    <>
      <h2 className={styles.sliderTitle}>{title}</h2>

      {isLoading && (
        <div className={styles.loadingState}>Loading {title}...</div>
      )}
      {isError && (
        <div className={styles.errorState}>Error loading {title}.</div>
      )}

      {!isLoading && !isError && data.length === 0 && (
        <div className={styles.noData}>
          No {title.toLowerCase()} match criteria.
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
            // const IconComponent = sliderId === SLIDER_TYPES.JOURNAL && JOURNAL_ICONS[item.id] ? JOURNAL_ICONS[item.id] : null; // JOURNAL_ICONS might not be relevant for all dynamic sliders
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
                  {" "}
                  {/* Removed IconComponent logic for generic slider */}
                  <span className={styles.slideName}>
                    {item.name || item.id || "Unnamed Item"}
                  </span>
                  {/* Display 'code' or 'unit_code' if they exist on item and are relevant for this slider type */}
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

      {/* Accordion: Only show if not loading, not error, and item exists */}
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
                    {/* Common item details */}
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
                    {currentItemForAccordion.notes && (
                      <p>
                        <strong>Notes:</strong> {currentItemForAccordion.notes}
                      </p>
                    )}
                    {/* Partner specific details */}
                    {sliderId === SLIDER_TYPES.PARTNER && (
                      <>
                        {currentItemForAccordion.partnerType && (
                          <p>
                            <strong>Type:</strong>{" "}
                            {currentItemForAccordion.partnerType}
                          </p>
                        )}
                        {currentItemForAccordion.taxId && (
                          <p>
                            <strong>Tax ID:</strong>{" "}
                            {currentItemForAccordion.taxId}
                          </p>
                        )}
                        {currentItemForAccordion.registrationNumber && (
                          <p>
                            <strong>Reg No:</strong>{" "}
                            {currentItemForAccordion.registrationNumber}
                          </p>
                        )}
                      </>
                    )}
                    {/* Goods specific details */}
                    {currentItemForAccordion.description && (
                      <p>
                        {" "}
                        <strong>Description:</strong>{" "}
                        {currentItemForAccordion.description}{" "}
                      </p>
                    )}

                    {/* Document creation specific UI for Goods slider */}
                    {isDocumentCreationMode &&
                      sliderId === SLIDER_TYPES.GOODS && (
                        <div className={styles.documentGoodDetails}>
                          {/* ... (form for quantity, price as before) ... */}
                          <h4>
                            {" "}
                            Document Specifics for{" "}
                            {currentItemForAccordion.name}:{" "}
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
                                  {" "}
                                  Quantity:{" "}
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
                                  {" "}
                                  Price per unit:{" "}
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
                                  {" "}
                                  Total Amount:{" "}
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
