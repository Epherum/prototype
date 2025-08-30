// src/features/journals/components/ApprovalCenter.tsx

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FiCheck, FiClock, FiUser, FiFileText, FiBox, FiFolderPlus, FiTarget, FiHome } from "react-icons/fi";
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import styles from "./ApprovalCenter.module.css";
import { useAppStore } from "@/store/appStore";
import clientApprovalService, { type InProcessItem } from "@/services/clientApprovalService";

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
  const user = useAppStore((state) => state.user);
  const effectiveRestrictedJournalId = useAppStore((state) => state.effectiveRestrictedJournalId);
  const queryClient = useQueryClient();

  // Entity filter options with icons
  const entityFilters: EntityFilter[] = useMemo(() => [
    { type: 'partner', label: 'Partner', icon: <FiUser />, active: activeEntityFilters.includes('partner') },
    { type: 'good', label: 'Good', icon: <FiBox />, active: activeEntityFilters.includes('good') },
    { type: 'link', label: 'Link', icon: <FiCheck />, active: activeEntityFilters.includes('link') },
    { type: 'document', label: 'Document', icon: <FiFileText />, active: activeEntityFilters.includes('document') },
    { type: 'project', label: 'Project', icon: <FiFolderPlus />, active: activeEntityFilters.includes('project') },
  ], [activeEntityFilters]);

  // Determine which journal IDs to use based on toggle state
  const effectiveJournalIds = useMemo(() => {
    if (useSelectedJournals) {
      return selectedJournals; // Use the current journal selections
    } else {
      // Use restricted journal or empty array for root level
      if (effectiveRestrictedJournalId && effectiveRestrictedJournalId !== '__ROOT__') {
        return [effectiveRestrictedJournalId];
      } else {
        return []; // Root level - no journal restriction
      }
    }
  }, [useSelectedJournals, selectedJournals, effectiveRestrictedJournalId]);

  // Fetch pending items for approval
  const { data: pendingItems, isLoading, error } = useQuery({
    queryKey: clientApprovalService.approvalKeys.inProcessFiltered({ 
      entityTypes: activeEntityFilters, 
      journalIds: effectiveJournalIds,
    }),
    queryFn: () => clientApprovalService.getInProcessItems({
      entityTypes: activeEntityFilters,
      journalIds: effectiveJournalIds,
    }),
    enabled: isOpen,
    refetchInterval: 30000, // Refresh every 30 seconds
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
      
    } catch (error) {
      console.error('Error approving entity:', error);
      alert(`Error approving entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

  const getProgressIndicator = (entity: InProcessItem) => {
    const { creationJournalLevel, currentPendingLevel } = entity;
    const dots = [];
    
    for (let i = 0; i <= creationJournalLevel; i++) {
      dots.push(
        <span 
          key={i} 
          className={i <= currentPendingLevel ? styles.progressDotFilled : styles.progressDot}
        >
          ●
        </span>
      );
    }
    
    return <div className={styles.progressIndicator}>{dots}</div>;
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
        
        {/* Journal Scope Toggle */}
        <div className={styles.journalScopeToggle}>
          <motion.button
            className={`${styles.scopeToggleButton} ${useSelectedJournals ? styles.scopeToggleActive : ''}`}
            onClick={() => setUseSelectedJournals(!useSelectedJournals)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={useSelectedJournals ? "Using selected journals" : "Using root/restricted level"}
          >
            {useSelectedJournals ? (
              <>
                <FiTarget className={styles.toggleIcon} />
                Selected Journals
              </>
            ) : (
              <>
                <FiHome className={styles.toggleIcon} />
                Root Level
              </>
            )}
          </motion.button>
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
                  {pendingItems?.data.filter((item: InProcessItem) => item.type === filter.type).length > 0 && (
                    <span className={styles.filterBadge}>
                      {pendingItems.data.filter((item: InProcessItem) => item.type === filter.type).length}
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
                  className={styles.pendingEntityCard}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  whileHover={{ scale: 1.02 }}
                >
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
                    {getProgressIndicator(entity)}
                  </div>
                  
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
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ApprovalCenter;