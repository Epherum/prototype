//src/features/partners/components/PartnerOptionsMenu.tsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "@/features/shared/components/OptionsMenu.module.css"; // Reuse styles if they are generic enough
import {
  IoAddCircleOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoLinkOutline,
  IoGitNetworkOutline,
  IoGridOutline,
} from "react-icons/io5";

interface PartnerOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  selectedPartnerId: string | null;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLinkToJournals: () => void; // New prop
  onUnlinkFromJournals: () => void; // +++ NEW PROP
  // +++ New Prop for GPG Link Creation +++
  onCreateGPGLink?: () => void; // Callback to trigger GPG link creation
  // +++ New Prop for Journal-Partner-Good Link Management +++
  onManageGoodLinks?: () => void; // Callback to open the new link management modal
}

const menuVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" }, // Smoother ease for enter
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: { duration: 0.1, ease: "easeIn" }, // Quicker ease for exit
  },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const PartnerOptionsMenu: React.FC<PartnerOptionsMenuProps> = ({
  isOpen,
  onClose,
  anchorEl,
  selectedPartnerId,
  onAdd,
  onEdit,
  onDelete,
  onLinkToJournals,
  onUnlinkFromJournals, // +++ DESTRUCTURE
  onCreateGPGLink,
  onManageGoodLinks,
}) => {
  return (
    <AnimatePresence>
      {isOpen && anchorEl && (
        <>
          <motion.div
            key="goods-options-overlay"
            className={styles.optionsOverlay}
            onClick={onClose}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          />
          <motion.div
            key="options-menu"
            className={styles.optionsMenu}
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onAdd();
                onClose();
              }}
              className={styles.optionButton}
            >
              <IoAddCircleOutline /> Add New Partner
            </button>
            <button
              onClick={() => {
                if (selectedPartnerId) {
                  onEdit();
                }
                onClose();
              }}
              disabled={!selectedPartnerId}
              className={styles.optionButton}
            >
              <IoPencilOutline /> Edit Selected
            </button>
            <button
              onClick={() => {
                if (selectedPartnerId) {
                  onDelete();
                }
                onClose();
              }}
              disabled={!selectedPartnerId}
              className={`${styles.optionButton} ${styles.deleteButton}`}
            >
              <IoTrashOutline /> Delete Selected
            </button>
            <div className={styles.menuDivider} />
            <button
              onClick={() => {
                onLinkToJournals();
                onClose();
              }}
              disabled={!selectedPartnerId}
              className={styles.optionButton}
            >
              <IoLinkOutline /> Link to a Journal (2-way)
            </button>
            <button
              onClick={() => {
                onUnlinkFromJournals();
                onClose();
              }}
              disabled={!selectedPartnerId}
              className={styles.optionButton}
            >
              <IoLinkOutline /> Unlink from Journals (2-way)
            </button>

            {/* +++ GPG Link Creation Button +++ */}
            {onCreateGPGLink &&
              selectedPartnerId && ( // Only show if callback provided and partner selected
                <>
                  <div className={styles.menuDivider} />
                  <button
                    onClick={() => {
                      onCreateGPGLink();
                      onClose();
                    }}
                    className={styles.optionButton}
                    title="Link this Partner to the Good selected in the first slider, via the G-P-G context journal."
                  >
                    <IoGitNetworkOutline /> Link to Current Good (G-P-G)
                  </button>
                </>
              )}
            {/* +++ End GPG Link Button +++ */}

            {/* +++ New Journal-Partner-Good Link Management Button +++ */}
            {onManageGoodLinks && selectedPartnerId && (
              <button
                onClick={() => {
                  onManageGoodLinks();
                  onClose();
                }}
                className={styles.optionButton}
                title="Manage links between this partner and goods in selected journal contexts"
              >
                <IoGridOutline /> Manage Good Links
              </button>
            )}
            {/* +++ End Journal-Partner-Good Link Management Button +++ */}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
export default PartnerOptionsMenu;
