//src/features/shared/components/DynamicSlider.tsx
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import { IoFilterCircleOutline, IoCloseCircleOutline, IoListOutline, IoSearchOutline } from "react-icons/io5";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useCallback, useEffect } from "react";
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
  activeFilters?: string[]; // Multi-select filters
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
  activeFilters = [],
}) => {
  // Quick Jump Menu state
  const [isJumpMenuOpen, setIsJumpMenuOpen] = useState(false);
  const [jumpSearchTerm, setJumpSearchTerm] = useState("");
  
  // Press & Hold Fast Scroll state
  const [isFastScrollMode, setIsFastScrollMode] = useState(false);
  const [fastScrollPosition, setFastScrollPosition] = useState(0);
  const fastScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fastScrollModeRef = useRef(false);
  const swiperRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialSlideIndex = Math.max(
    0,
    data.findIndex((item) => item?.id === activeItemId)
  );

  // Helper function to determine which filter an entity matches
  const getEntityFilter = (entity: DynamicSliderItem): string | null => {
    // Use backend-provided matchedFilters if available
    const matchedFilters = (entity as any).matchedFilters;
    if (matchedFilters && matchedFilters.length > 0) {
      // Return the first matched filter for color coding
      // If entity matches multiple filters, prioritize: inProcess > affected > unaffected
      if (matchedFilters.includes('inProcess')) return 'inProcess';
      if (matchedFilters.includes('affected')) return 'affected';
      if (matchedFilters.includes('unaffected')) return 'unaffected';
      return matchedFilters[0];
    }
    
    // Fallback to legacy behavior for backward compatibility
    if (!activeFilters || activeFilters.length === 0) {
      return currentFilter || null;
    }
    
    return activeFilters[0] || null;
  };

  // Helper function to get filter dot CSS class and visibility for an entity
  const getFilterDot = (entity: DynamicSliderItem) => {
    const entityFilter = getEntityFilter(entity);
    if (!entityFilter) return null;
    
    switch (entityFilter) {
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

  // Quick Jump Menu functions
  const filteredDataForJump = data.filter(item => 
    item.label?.toLowerCase().includes(jumpSearchTerm.toLowerCase()) ||
    item.code?.toLowerCase().includes(jumpSearchTerm.toLowerCase())
  );

  const handleJumpToItem = useCallback((itemId: string) => {
    const itemIndex = data.findIndex(item => item.id === itemId);
    if (itemIndex !== -1 && swiperRef.current?.swiper) {
      swiperRef.current.swiper.slideTo(itemIndex);
      onSlideChange(itemId);
    }
    setIsJumpMenuOpen(false);
    setJumpSearchTerm("");
  }, [data, onSlideChange]);

  // Press & Hold Fast Scroll functions
  const startFastScroll = useCallback(() => {
    if (isLocked || data.length < 2) return;
    setIsFastScrollMode(true);
    fastScrollModeRef.current = true;
    const currentIndex = data.findIndex(item => item.id === activeItemId);
    setFastScrollPosition(currentIndex !== -1 ? currentIndex : 0);
  }, [isLocked, data, activeItemId]);

  const endFastScroll = useCallback(() => {
    setIsFastScrollMode(false);
    fastScrollModeRef.current = false;
    if (fastScrollTimerRef.current) {
      clearTimeout(fastScrollTimerRef.current);
      fastScrollTimerRef.current = null;
    }
  }, []);

  const handleFastScrollMove = useCallback((clientX: number) => {
    if (!isFastScrollMode || !containerRef.current || data.length < 2) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, relativeX / rect.width));
    const newIndex = Math.floor(percentage * (data.length - 1));
    
    // Always update the position for visual feedback, even if it's the same index
    setFastScrollPosition(newIndex);
    
    // Debounce the actual slide change to avoid rapid API calls
    if (fastScrollTimerRef.current) {
      clearTimeout(fastScrollTimerRef.current);
    }
    
    fastScrollTimerRef.current = setTimeout(() => {
      if (swiperRef.current?.swiper && data[newIndex]) {
        swiperRef.current.swiper.slideTo(newIndex);
        onSlideChange(data[newIndex].id);
      }
    }, 50); // Reduced debounce time for more responsive feedback
  }, [isFastScrollMode, data, onSlideChange]);

  // Touch event handlers for fast scroll
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isLocked) return;
    const touch = e.touches[0];
    const startTime = Date.now();
    
    // Start a timer to detect long press (500ms)
    const longPressTimer = setTimeout(() => {
      startFastScroll();
      if ('vibrate' in navigator) {
        navigator.vibrate(50); // Haptic feedback if available
      }
    }, 500);
    
    const cleanup = () => {
      clearTimeout(longPressTimer);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchmove', onTouchMove);
    };
    
    const onTouchEnd = () => {
      const endTime = Date.now();
      if (endTime - startTime < 500) {
        clearTimeout(longPressTimer);
      }
      endFastScroll();
      cleanup();
    };
    
    const onTouchMove = (moveEvent: TouchEvent) => {
      if (fastScrollModeRef.current) {
        moveEvent.preventDefault();
        handleFastScrollMove(moveEvent.touches[0].clientX);
      } else {
        // Clear the timer if we're not in fast scroll mode yet but moving
        clearTimeout(longPressTimer);
      }
    };
    
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
  }, [isLocked, startFastScroll, endFastScroll, isFastScrollMode, handleFastScrollMove]);

  // Mouse event handlers for fast scroll (desktop support)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLocked) return;
    e.preventDefault();
    const startTime = Date.now();
    
    const longPressTimer = setTimeout(() => {
      startFastScroll();
    }, 500);
    
    const cleanup = () => {
      clearTimeout(longPressTimer);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
    };
    
    const onMouseUp = () => {
      const endTime = Date.now();
      if (endTime - startTime < 500) {
        clearTimeout(longPressTimer);
      }
      endFastScroll();
      cleanup();
    };
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (fastScrollModeRef.current) {
        moveEvent.preventDefault();
        handleFastScrollMove(moveEvent.clientX);
      }
    };
    
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
  }, [isLocked, startFastScroll, endFastScroll, isFastScrollMode, handleFastScrollMove]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (fastScrollTimerRef.current) {
        clearTimeout(fastScrollTimerRef.current);
      }
    };
  }, []);

  const currentItemForAccordion = data.find(
    (item) => item?.id === activeItemId
  );

  const swiperKey = `${sliderId}-len${data.length}-active${activeItemId}-locked${isLocked}-multi${isMultiSelect}`;

  return (
    <>
      <div className={styles.sliderHeader}>
        <h2 className={styles.sliderTitle}>{title}</h2>
        {data.length >= 2 && !isLocked && (
          <button
            onClick={() => setIsJumpMenuOpen(true)}
            className={styles.quickJumpButton}
            title="Quick jump to item"
          >
            <IoListOutline />
          </button>
        )}
      </div>

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

      <div 
        ref={containerRef}
        className={`${styles.contentWrapper} ${isFastScrollMode ? styles.fastScrollMode : ''}`}
        onTouchStart={handleTouchStart}
        onMouseDown={handleMouseDown}
      >
        {isFastScrollMode && (
          <div className={styles.fastScrollOverlay}>
            <div className={styles.fastScrollIndicator}>
              {fastScrollPosition + 1} / {data.length}
            </div>
            <div className={styles.fastScrollBar}>
              <div 
                className={styles.fastScrollProgress}
                style={{ width: `${((fastScrollPosition + 1) / data.length) * 100}%` }}
              />
            </div>
            <div className={styles.fastScrollCurrentItem}>
              {data[fastScrollPosition]?.label || 'Unknown'}
            </div>
          </div>
        )}
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
                ref={swiperRef}
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
                allowTouchMove={!isLocked && !isFastScrollMode}
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
                          {getFilterDot(item)}
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

      {/* Quick Jump Menu Modal */}
      <AnimatePresence>
        {isJumpMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.jumpMenuOverlay}
            onClick={() => setIsJumpMenuOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={styles.jumpMenuModal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.jumpMenuHeader}>
                <h3>Jump to {title}</h3>
                <button
                  onClick={() => setIsJumpMenuOpen(false)}
                  className={styles.jumpMenuClose}
                >
                  ×
                </button>
              </div>
              
              <div className={styles.jumpMenuSearch}>
                <IoSearchOutline className={styles.jumpMenuSearchIcon} />
                <input
                  type="text"
                  placeholder={`Search ${title.toLowerCase()}...`}
                  value={jumpSearchTerm}
                  onChange={(e) => setJumpSearchTerm(e.target.value)}
                  className={styles.jumpMenuSearchInput}
                  autoFocus
                />
              </div>

              <div className={styles.jumpMenuList}>
                {filteredDataForJump.length === 0 ? (
                  <div className={styles.jumpMenuNoResults}>
                    No items match your search
                  </div>
                ) : (
                  filteredDataForJump.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleJumpToItem(item.id)}
                      className={`${styles.jumpMenuItem} ${
                        item.id === activeItemId ? styles.jumpMenuItemActive : ''
                      }`}
                    >
                      <div className={styles.jumpMenuItemContent}>
                        <span className={styles.jumpMenuItemLabel}>
                          {getFilterDot(item)}
                          {item.label}
                        </span>
                        {item.code && (
                          <span className={styles.jumpMenuItemCode}>
                            {item.code}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DynamicSlider;
