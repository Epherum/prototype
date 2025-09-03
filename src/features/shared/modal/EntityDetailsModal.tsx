// src/features/shared/modal/EntityDetailsModal.tsx

import React from "react";
import { motion } from "framer-motion";
import { FiX, FiUser, FiBox, FiFileText, FiClock, FiCalendar, FiHash } from "react-icons/fi";
import styles from "./EntityDetailsModal.module.css";
import { InProcessItem } from "@/services/clientApprovalService";

interface EntityDetailsModalProps {
  entity: InProcessItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const EntityDetailsModal: React.FC<EntityDetailsModalProps> = ({
  entity,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !entity) return null;

  const getEntityIcon = () => {
    switch (entity.type) {
      case 'partner': return <FiUser className={styles.entityIcon} />;
      case 'good': return <FiBox className={styles.entityIcon} />;
      case 'document': return <FiFileText className={styles.entityIcon} />;
      default: return null;
    }
  };

  const getEntityTypeLabel = () => {
    switch (entity.type) {
      case 'partner': return 'Partner';
      case 'good': return 'Good & Service';
      case 'document': return 'Document';
      default: return entity.type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {getEntityIcon()}
            <div>
              <h2 className={styles.title}>{entity.name}</h2>
              <span className={styles.subtitle}>{getEntityTypeLabel()}</span>
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <FiHash />
              Basic Information
            </h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <label>ID</label>
                <span>{entity.id}</span>
              </div>
              <div className={styles.infoItem}>
                <label>Type</label>
                <span className={styles.typeBadge}>{entity.type.toUpperCase()}</span>
              </div>
              <div className={styles.infoItem}>
                <label>Status</label>
                <span className={styles.statusBadge}>{entity.approvalStatus}</span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <FiClock />
              Approval Information
            </h3>
            <div className={styles.approvalInfo}>
              <div className={styles.levelDisplay}>
                <div className={styles.levelItem}>
                  <label>Creation Level</label>
                  <span className={styles.levelBadge}>{entity.creationJournalLevel}</span>
                </div>
                <div className={styles.levelArrow}>→</div>
                <div className={styles.levelItem}>
                  <label>Current Pending Level</label>
                  <span className={styles.levelBadge}>{entity.currentPendingLevel}</span>
                </div>
              </div>
              
              <div className={styles.progressBar}>
                <div className={styles.progressTrack}>
                  {Array.from({ length: entity.creationJournalLevel + 1 }, (_, i) => (
                    <div
                      key={i}
                      className={`${styles.progressStep} ${
                        i < entity.currentPendingLevel ? styles.progressStepCompleted : 
                        i === entity.currentPendingLevel ? styles.progressStepCurrent : 
                        styles.progressStepPending
                      }`}
                    >
                      <span className={styles.stepNumber}>{i}</span>
                      <span className={styles.stepLabel}>
                        {i === 0 ? 'Root' : `Level ${i}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.approvalMeta}>
                <div className={styles.infoItem}>
                  <label>Can Approve</label>
                  <span className={entity.canApprove ? styles.canApprove : styles.cannotApprove}>
                    {entity.canApprove ? 'YES' : 'NO'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <FiCalendar />
              Timeline
            </h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <label>Created At</label>
                <span>{formatDate(entity.createdAt)}</span>
              </div>
              <div className={styles.infoItem}>
                <label>Created By</label>
                <span>{entity.createdById}</span>
              </div>
            </div>
          </div>

          {(entity.journalName || entity.partnerName || entity.goodName || entity.refDoc) && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Additional Details</h3>
              <div className={styles.infoGrid}>
                {entity.journalName && (
                  <div className={styles.infoItem}>
                    <label>Journal</label>
                    <span>{entity.journalName}</span>
                  </div>
                )}
                {entity.partnerName && (
                  <div className={styles.infoItem}>
                    <label>Partner</label>
                    <span>{entity.partnerName}</span>
                  </div>
                )}
                {entity.goodName && (
                  <div className={styles.infoItem}>
                    <label>Good/Service</label>
                    <span>{entity.goodName}</span>
                  </div>
                )}
                {entity.refDoc && (
                  <div className={styles.infoItem}>
                    <label>Document Reference</label>
                    <span>{entity.refDoc}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default EntityDetailsModal;