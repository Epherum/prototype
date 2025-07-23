//src/features/goods/components/GoodsOptionsMenu.tsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "@/features/shared/components/OptionsMenu.module.css";
import {
  IoAddCircleOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoLinkOutline,
  IoGitNetworkOutline,
} from "react-icons/io5";

interface GoodsOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  selectedGoodsId: string | null;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLinkToJournals: () => void;
  onUnlinkFromJournals: () => void;
  canOpenLinkGoodToPartnersModal?: boolean;
  onOpenLinkGoodToPartnersModal?: () => void;
  canOpenUnlinkGoodFromPartnersModal?: boolean;
  onOpenUnlinkGoodFromPartnersModal?: () => void;
}

const menuVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: { duration: 0.1, ease: "easeIn" },
  },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const GoodsOptionsMenu: React.FC<GoodsOptionsMenuProps> = ({
  isOpen,
  onClose,
  anchorEl,
  selectedGoodsId,
  onAdd,
  onEdit,
  onDelete,
  onLinkToJournals,
  onUnlinkFromJournals,
  canOpenLinkGoodToPartnersModal,
  onOpenLinkGoodToPartnersModal,
  canOpenUnlinkGoodFromPartnersModal,
  onOpenUnlinkGoodFromPartnersModal,
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
              <IoAddCircleOutline /> Add New Good/Service
            </button>
            <button
              onClick={() => {
                if (selectedGoodsId) onEdit();
                onClose();
              }}
              disabled={!selectedGoodsId}
              className={styles.optionButton}
            >
              <IoPencilOutline /> Edit Selected
            </button>
            <button
              onClick={() => {
                if (selectedGoodsId) onDelete();
                onClose();
              }}
              disabled={!selectedGoodsId}
              className={`${styles.optionButton} ${styles.deleteButton}`}
            >
              <IoTrashOutline /> Delete Selected
            </button>
            <div className={styles.menuDivider} />
            <button
              onClick={() => {
                if (selectedGoodsId) onLinkToJournals();
                onClose();
              }}
              disabled={!selectedGoodsId}
              className={styles.optionButton}
            >
              <IoLinkOutline /> Link to Journals
            </button>
            <button
              onClick={() => {
                if (selectedGoodsId) onUnlinkFromJournals();
                onClose();
              }}
              disabled={!selectedGoodsId}
              className={styles.optionButton}
            >
              <IoLinkOutline /> Unlink from Journals
            </button>

            {(canOpenLinkGoodToPartnersModal ||
              canOpenUnlinkGoodFromPartnersModal) && (
              <div className={styles.menuDivider} />
            )}

            {onOpenLinkGoodToPartnersModal && (
              <button
                onClick={() => {
                  onOpenLinkGoodToPartnersModal();
                  onClose();
                }}
                disabled={!canOpenLinkGoodToPartnersModal}
                className={styles.optionButton}
                title="Link this Good to Partners, in the context of the selected Journal."
              >
                <IoGitNetworkOutline /> Link to Partners (3-way)
              </button>
            )}

            {onOpenUnlinkGoodFromPartnersModal && (
              <button
                onClick={() => {
                  onOpenUnlinkGoodFromPartnersModal();
                  onClose();
                }}
                disabled={!canOpenUnlinkGoodFromPartnersModal}
                className={styles.optionButton}
                title="Unlink this Good from Partners, in the context of the selected Journal."
              >
                <IoGitNetworkOutline /> Unlink from Partners (3-way)
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GoodsOptionsMenu;
