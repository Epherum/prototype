// src/features/journals/components/ApprovalCenter.tsx

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FiCheck, FiClock, FiUser, FiFileText, FiBox, FiFolderPlus, FiTarget, FiHome, FiLoader, FiEye, FiLink, FiX } from "react-icons/fi";
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import styles from "./ApprovalCenter.module.css";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import { useAppStore } from "@/store/appStore";
import clientApprovalService, { type InProcessItem } from "@/services/clientApprovalService";
import { partnerKeys, goodKeys } from "@/lib/queryKeys";

export interface ApprovalCenterProps {
  isOpen: boolean;
  selectedJournals: string[];
  onClose: () => void;
}

interface EntityFilter {
  type: 'partner' | 'good' | 'link' | 'document' | 'project';
  label: string;
  icon: React.ReactNode;
  active: boolean;
}

// Using InProcessItem type from the client service

const ApprovalCenter: React.FC<ApprovalCenterProps> = ({
  isOpen,
  selectedJournals,
  onClose,
}) => {
  const [activeEntityFilters, setActiveEntityFilters] = useState<string[]>([]);
  const [useSelectedJournals, setUseSelectedJournals] = useState<boolean>(false);
  const [selectedEntity, setSelectedEntity] = useState<InProcessItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const user = useAppStore((state) => state.user);
  const effectiveRestrictedJournalId = useAppStore((state) => state.effectiveRestrictedJournalId);
  const queryClient = useQueryClient();

  // Entity filter options with icons
  const entityFilters: EntityFilter[] = useMemo(() => [
    { type: 'partner', label: 'Partner', icon: <FiUser />, active: activeEntityFilters.includes('partner') },
    { type: 'good', label: 'Good', icon: <FiBox />, active: activeEntityFilters.includes('good') },
    { type: 'link', label: 'Link', icon: <FiLink />, active: activeEntityFilters.includes('link') },
    { type: 'document', label: 'Document', icon: <FiFileText />, active: activeEntityFilters.includes('document') },
    { type: 'project', label: 'Project', icon: <FiFolderPlus />, active: activeEntityFilters.includes('project') },
  ], [activeEntityFilters]);

  // Determine which journal IDs to use based on toggle state
  const effectiveJournalIds = useMemo(() => {
    if (useSelectedJournals) {
      return selectedJournals; // Use the current journal selections
    } else {
      // Don't pass journalIds when not using selected journals
      // Let the approval service handle the restricted journal logic internally
      return []; // Empty array - approval service will use restrictedJournalId
    }
  }, [useSelectedJournals, selectedJournals, effectiveRestrictedJournalId]);

  // Fetch all pending items for badge counts (unfiltered by entity type)
  const { data: allPendingItems } = useQuery({
    queryKey: clientApprovalService.approvalKeys.inProcessFiltered({ 
      entityTypes: [], // No entity filter to get all types
      journalIds: effectiveJournalIds,
    }),
    queryFn: () => {
      return clientApprovalService.getInProcessItems({
        entityTypes: [], // No entity filter to get all types
        journalIds: effectiveJournalIds,
      });
    },
    enabled: isOpen,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch pending items for approval (filtered by selected entity types)
  const { data: pendingItems, isLoading: queryIsLoading, error } = useQuery({
    queryKey: clientApprovalService.approvalKeys.inProcessFiltered({ 
      entityTypes: activeEntityFilters, 
      journalIds: effectiveJournalIds,
    }),
    queryFn: () => {
      console.log("🔍 ApprovalCenter DEBUG: Calling getInProcessItems", {
        entityTypes: activeEntityFilters,
        journalIds: effectiveJournalIds,
        useSelectedJournals,
        effectiveRestrictedJournalId
      });
      return clientApprovalService.getInProcessItems({
        entityTypes: activeEntityFilters,
        journalIds: effectiveJournalIds,
      });
    },
    enabled: isOpen,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Add minimum loading time to make loading state more visible
  const [isMinLoadingComplete, setIsMinLoadingComplete] = useState(false);
  const isLoading = queryIsLoading || !isMinLoadingComplete;

  // Reset minimum loading state when query starts
  React.useEffect(() => {
    if (queryIsLoading) {
      setIsMinLoadingComplete(false);
      const timer = setTimeout(() => {
        setIsMinLoadingComplete(true);
      }, 500); // Minimum 500ms loading state
      return () => clearTimeout(timer);
    }
  }, [queryIsLoading]);

  // Debug log
  console.log("🔍 ApprovalCenter DEBUG: Query result", {
    allPendingItems,
    pendingItems,
    queryIsLoading,
    isMinLoadingComplete,
    isLoading,
    error,
    effectiveJournalIds,
    activeEntityFilters,
  });

  const toggleEntityFilter = (entityType: string) => {
    setActiveEntityFilters(prev => 
      prev.includes(entityType)
        ? prev.filter(type => type !== entityType)
        : [...prev, entityType]
    );
  };

  const handleApprove = async (entityType: string, entityId: string) => {
    try {
      await clientApprovalService.approveEntity({
        entityType,
        entityId,
        comments: `Approved by ${user?.name || 'User'}`,
      });

      // Invalidate and refetch the pending items
      queryClient.invalidateQueries({
        queryKey: clientApprovalService.approvalKeys.inProcess()
      });
      
      // Also invalidate partner and goods queries based on entity type
      if (entityType === 'partner') {
        queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      } else if (entityType === 'good') {
        queryClient.invalidateQueries({ queryKey: goodKeys.all });
      }
      
    } catch (error) {
      console.error('Error approving entity:', error);
      alert(`Error approving entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const openEntityModal = (entity: InProcessItem) => {
    setSelectedEntity(entity);
    setIsModalOpen(true);
  };

  const closeEntityModal = () => {
    setSelectedEntity(null);
    setIsModalOpen(false);
  };

  const getStatusBadge = (entity: InProcessItem) => {
    const { creationJournalLevel, currentPendingLevel } = entity;
    
    if (currentPendingLevel === 0) {
      return <span className={styles.statusBadgePendingRoot}>PENDING ROOT</span>;
    } else if (currentPendingLevel === creationJournalLevel) {
      return <span className={styles.statusBadgePendingFinal}>PENDING L{currentPendingLevel}</span>;
    } else {
      return <span className={styles.statusBadgePendingLevel}>PENDING L{currentPendingLevel}</span>;
    }
  };


  const renderLinkEntity = (entity: InProcessItem) => {
    const linkParts = entity.name.split(' ↔ ');
    const [journal, partner, good] = linkParts;
    
    return (
      <div className={styles.linkEntityDisplay}>
        <div className={styles.linkHeader}>
          <FiLink className={styles.linkIcon} />
          <span className={styles.linkTitle}>Journal-Partner-Good Link</span>
          {getStatusBadge(entity)}
        </div>
        <div className={styles.linkComponents}>
          <div className={styles.linkComponent}>
            <span className={styles.componentLabel}>Journal</span>
            <span className={styles.componentValue}>{journal}</span>
          </div>
          <div className={styles.linkArrow}>↔</div>
          <div className={styles.linkComponent}>
            <span className={styles.componentLabel}>Partner</span>
            <span className={styles.componentValue}>{partner}</span>
          </div>
          <div className={styles.linkArrow}>↔</div>
          <div className={styles.linkComponent}>
            <span className={styles.componentLabel}>Good</span>
            <span className={styles.componentValue}>{good}</span>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className={styles.approvalCenterContainer}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.approvalCenterHeader}>
        <div className={styles.headerLeft}>
          <h3 className={styles.approvalCenterTitle}>
            <FiClock className={styles.titleIcon} />
            Pending Center
          </h3>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close Pending Center"
          >
            ×
          </button>
        </div>
        
        {/* Journal Scope Toggle - Sliding Switch */}
        <div className={styles.journalScopeToggle}>
          <div className={styles.slidingToggleContainer}>
            <motion.div 
              className={styles.slidingToggleTrack}
              onClick={() => setUseSelectedJournals(!useSelectedJournals)}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div
                className={styles.slidingToggleIndicator}
                animate={{
                  x: useSelectedJournals ? "100%" : "0%"
                }}
                transition={{
                  type: "tween",
                  ease: [0.25, 0.1, 0.25, 1],
                  duration: 0.3
                }}
              />
              <div className={styles.slidingToggleLabels}>
                <div className={`${styles.toggleLabel} ${!useSelectedJournals ? styles.toggleLabelActive : ''}`}>
                  <FiHome className={styles.toggleIcon} />
                  <span>Root Level</span>
                </div>
                <div className={`${styles.toggleLabel} ${useSelectedJournals ? styles.toggleLabelActive : ''}`}>
                  <FiTarget className={styles.toggleIcon} />
                  <span>Selected</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        
        <div className={styles.entityFilterRow}>
          <Swiper
            modules={[FreeMode]}
            spaceBetween={12}
            slidesPerView="auto"
            freeMode={true}
            resistanceRatio={0.85}
            className={styles.filterSwiper}
          >
            {entityFilters.map((filter) => (
              <SwiperSlide key={filter.type} className={styles.filterSlide}>
                <motion.button
                  className={`${styles.entityFilterButton} ${filter.active ? styles.entityFilterButtonActive : ''}`}
                  onClick={() => toggleEntityFilter(filter.type)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {filter.icon}
                  {filter.label}
                  {allPendingItems?.data.filter((item: InProcessItem) => item.type === filter.type).length > 0 && (
                    <span className={styles.filterBadge}>
                      {allPendingItems.data.filter((item: InProcessItem) => item.type === filter.type).length}
                    </span>
                  )}
                </motion.button>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>

      <div className={styles.approvalCenterContent}>
        <div className={styles.journalScopeInfo}>
          <strong>Scope:</strong> {
            useSelectedJournals
              ? (selectedJournals.length > 0 
                  ? `Selected Journals (${selectedJournals.join(', ')})` 
                  : 'Selected Journals (none selected)')
              : (effectiveJournalIds.length > 0
                  ? `Restricted Level (${effectiveJournalIds.join(', ')})`
                  : 'Root Level (all journals)')
          }
        </div>
        
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              className={styles.loadingState}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={styles.loadingSpinner}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <FiLoader />
              </motion.div>
              Loading pending approvals...
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              className={styles.errorState}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Error loading pending approvals: {error instanceof Error ? error.message : 'Unknown error'}
            </motion.div>
          ) : pendingItems?.data.length === 0 ? (
            <motion.div
              key="empty"
              className={styles.emptyState}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              No pending approvals found.
            </motion.div>
          ) : (
            <motion.div
              key="data"
              className={styles.pendingItemsList}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {pendingItems?.data.map((entity: InProcessItem) => (
                <motion.div
                  key={`${entity.type}-${entity.id}`}
                  className={`${styles.pendingEntityCard} ${entity.type === 'link' ? styles.linkEntityCard : ''}`}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  whileHover={{ scale: 1.02 }}
                >
                  {entity.type === 'link' ? (
                    <>
                      {renderLinkEntity(entity)}
                      <div className={styles.entityActions}>
                        {entity.canApprove ? (
                          <motion.button
                            className={styles.approveButton}
                            onClick={() => handleApprove(entity.type, entity.id)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <FiCheck />
                            APPROVE
                          </motion.button>
                        ) : (
                          <span className={styles.viewOnlyLabel}>VIEW ONLY</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.entityInfo}>
                        <div className={styles.entityHeader}>
                          <span className={styles.entityName}>{entity.name}</span>
                          {getStatusBadge(entity)}
                        </div>
                        <div className={styles.entityMeta}>
                          <span className={styles.entityType}>{entity.type.toUpperCase()}</span>
                          <span className={styles.entityDate}>
                            Created: {new Date(entity.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      <div className={styles.entityActions}>
                        <motion.button
                          className={styles.viewDetailsButton}
                          onClick={() => openEntityModal(entity)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <FiEye />
                          VIEW DETAILS
                        </motion.button>
                        {entity.canApprove ? (
                          <motion.button
                            className={styles.approveButton}
                            onClick={() => handleApprove(entity.type, entity.id)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <FiCheck />
                            APPROVE
                          </motion.button>
                        ) : (
                          <span className={styles.viewOnlyLabel}>VIEW ONLY</span>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Entity Details Modal */}
      <AnimatePresence>
        {isModalOpen && selectedEntity && (
          <motion.div
            className={baseStyles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeEntityModal}
          >
            <motion.div
              className={baseStyles.modalContent}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className={baseStyles.modalCloseButton}
                onClick={closeEntityModal}
                aria-label="Close modal"
              >
                <FiX />
              </button>

              <h2 className={baseStyles.modalTitle}>
                {selectedEntity.type.toUpperCase()} Details
              </h2>

              <div className={baseStyles.modalBody}>
                <div className={styles.entityDetailGrid}>
                  <div className={styles.entityDetailItem}>
                    <label>Name:</label>
                    <span>{selectedEntity.name}</span>
                  </div>
                  
                  <div className={styles.entityDetailItem}>
                    <label>Type:</label>
                    <span>{selectedEntity.type.toUpperCase()}</span>
                  </div>
                  
                  <div className={styles.entityDetailItem}>
                    <label>Status:</label>
                    <span>{getStatusBadge(selectedEntity)}</span>
                  </div>
                  
                  <div className={styles.entityDetailItem}>
                    <label>Created:</label>
                    <span>{new Date(selectedEntity.createdAt).toLocaleString()}</span>
                  </div>
                  
                  <div className={styles.entityDetailItem}>
                    <label>Creation Level:</label>
                    <span>Level {selectedEntity.creationJournalLevel}</span>
                  </div>
                  
                  <div className={styles.entityDetailItem}>
                    <label>Current Pending Level:</label>
                    <span>Level {selectedEntity.currentPendingLevel}</span>
                  </div>
                  
                  <div className={styles.entityDetailItem}>
                    <label>Can Approve:</label>
                    <span className={selectedEntity.canApprove ? styles.canApproveYes : styles.canApproveNo}>
                      {selectedEntity.canApprove ? 'Yes' : 'No'}
                    </span>
                  </div>
                  
                  
                </div>
              </div>

              <div className={baseStyles.modalActions}>
                {selectedEntity.canApprove && (
                  <button
                    className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`}
                    onClick={() => {
                      handleApprove(selectedEntity.type, selectedEntity.id);
                      closeEntityModal();
                    }}
                  >
                    <FiCheck />
                    Approve
                  </button>
                )}
                <button
                  className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
                  onClick={closeEntityModal}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ApprovalCenter;