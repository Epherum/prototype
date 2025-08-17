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
  isAccordionOpen?: boolean;
  onToggleAccordion?: () => void;
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
  placeholderMessage?: string | null;
  // New props for document creation
  showDocumentItemInputs?: boolean;
  documentItems?: Array<{ goodId: string; quantity: number; unitPrice: number; goodLabel: string }>;
  onUpdateDocumentItem?: (goodId: string, updates: { quantity?: number; unitPrice?: number }) => void;
  // Document creation mode props
  isCreating?: boolean;
  creationMode?: string;
  // Filter color coding
  currentFilter?: string;
}

const DynamicSlider: React.FC<DynamicSliderProps> = ({
  sliderId,
  title,
  data = [],
  onSlideChange,
  activeItemId,
  isAccordionOpen = false,
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
  showDocumentItemInputs = false,
  documentItems = [],
  onUpdateDocumentItem,
  isCreating = false,
  creationMode,
  currentFilter,
}) => {
  const initialSlideIndex = Math.max(
    0,
    data.findIndex((item) => item?.id === activeItemId)
  );

  // Helper function to get filter dot CSS class and visibility
  const getFilterDot = () => {
    if (!currentFilter) return null;
    
    switch (currentFilter) {
      case 'affected':
        return <span className={`${styles.filterIndicatorDot} ${styles.filterDotAffected}`} />;
      case 'unaffected':
        return <span className={`${styles.filterIndicatorDot} ${styles.filterDotUnaffected}`} />;
      case 'inProcess':
        return <span className={`${styles.filterIndicatorDot} ${styles.filterDotInProcess}`} />;
      default:
        return null;
    }
  };

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
              className={`${styles.stateOverlay} ${isCreating ? styles.creationState : ''}`}
              variants={sliderContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {isCreating ? (
                <div className={styles.creationContent}>
                  <div className={styles.creationIcon}>+</div>
                  <div className={styles.creationText}>
                    <div className={styles.creationTitle}>Document Creation Mode</div>
                    <div className={styles.creationSubtitle}>
                      {creationMode === 'SINGLE_ITEM' && 'Building single document'}
                      {creationMode === 'PARTNER_LOCKED' && 'Partner locked - multi-item document'}
                      {creationMode === 'GOODS_LOCKED' && 'Good locked - multi-partner documents'}
                      {creationMode === 'MULTIPLE_PARTNERS' && 'Creating documents for multiple partners'}
                      {creationMode === 'MULTIPLE_GOODS' && 'Creating documents for multiple goods'}
                      {!creationMode && 'Preparing document creation'}
                    </div>
                  </div>
                </div>
              ) : (
                placeholderMessage ||
                `No ${title.toLowerCase()} match criteria.`
              )}
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
                        <span className={styles.slideName} style={{ display: 'flex', alignItems: 'center' }}>
                          {getFilterDot()}
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
        (currentItemForAccordion || showDocumentItemInputs) &&
        onToggleAccordion && (
          <div className={styles.accordionContainer}>
            <button
              onClick={onToggleAccordion}
              className={styles.detailsButton}
              aria-expanded={isAccordionOpen}
            >
{showDocumentItemInputs ? "Selected Items" : "Details"}{" "}
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
                    {showDocumentItemInputs && documentItems.length > 0 ? (
                      // Show document creation inputs for all selected items
                      <>
                        <h4 style={{ marginBottom: '16px', color: '#fff' }}>Selected Items for Document:</h4>
                        {documentItems.map((item) => (
                          <div key={item.goodId} style={{ 
                            marginBottom: '20px', 
                            padding: '12px', 
                            border: '1px solid #444', 
                            borderRadius: '6px',
                            backgroundColor: '#2a2a2a'
                          }}>
                            <h5 style={{ marginBottom: '8px', color: '#fff' }}>{item.goodLabel}</h5>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#fff' }}>
                                  Quantity:
                                </label>
                                <input
                                  type="number"
                                  value={item.quantity === 0 ? '' : item.quantity}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || value === '0') {
                                      onUpdateDocumentItem?.(item.goodId, { quantity: 0 });
                                    } else {
                                      const numValue = parseInt(value);
                                      if (!isNaN(numValue) && numValue > 0) {
                                        onUpdateDocumentItem?.(item.goodId, { quantity: numValue });
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (isNaN(value) || value <= 0) {
                                      onUpdateDocumentItem?.(item.goodId, { quantity: 1 });
                                    }
                                  }}
                                  placeholder="1"
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    border: '1px solid #555',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    backgroundColor: '#1a1a1a',
                                    color: '#fff'
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#fff' }}>
                                  Unit Price:
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.unitPrice === 0 ? '' : item.unitPrice}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      onUpdateDocumentItem?.(item.goodId, { unitPrice: 0 });
                                    } else {
                                      const numValue = parseFloat(value);
                                      if (!isNaN(numValue) && numValue >= 0) {
                                        onUpdateDocumentItem?.(item.goodId, { unitPrice: numValue });
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (isNaN(value) || value < 0) {
                                      onUpdateDocumentItem?.(item.goodId, { unitPrice: 0 });
                                    }
                                  }}
                                  placeholder="0.00"
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    border: '1px solid #555',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    backgroundColor: '#1a1a1a',
                                    color: '#fff'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : currentItemForAccordion ? (
                      // Show normal details for the current item
                      Object.entries(currentItemForAccordion).map(
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
                      )
                    ) : (
                      // Fallback when showing document inputs but no items selected yet
                      <p style={{ color: '#ccc', fontStyle: 'italic' }}>
                        Select items to configure pricing and quantities for the document.
                      </p>
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
