// src/components/options/GoodsOptionsMenu.tsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import commonOptionStyles from "./PartnerOptionsMenu.module.css"; // Reuse styles if they are generic enough
// Or create GoodsOptionsMenu.module.css if specific styles are needed
import {
  IoAddCircleOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoLinkOutline,
  IoGitCompareOutline, // For 3-way link (linking)
  IoUnlinkOutline, // For unlinking
} from "react-icons/io5";

interface GoodsOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  selectedGoodsId: string | null; // Keep this as it's context for all actions
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;

  // 2-Way Good-Journal
  onLinkToJournals?: () => void;
  onUnlinkFromJournals?: () => void;

  // 3-Way Good-Journal-Partner LINKING (Modal to select partners)
  onOpenLinkGoodToPartnersModal?: () => void;
  canOpenLinkGoodToPartnersModal?: boolean;

  // 3-Way Good-Journal-Partner UNLINKING (Modal to select existing JPGLs to remove)
  onOpenUnlinkGoodFromPartnersModal?: () => void;
  canOpenUnlinkGoodFromPartnersModal?: boolean;
}

const menuVariants = {
  // Can be shared or customized
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
  // Can be shared
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const GoodsOptionsMenu: React.FC<GoodsOptionsMenuProps> = ({
  isOpen,
  onClose,
  anchorEl,
  selectedGoodsId, // selectedGoodsId is still relevant context
  onAdd,
  onEdit,
  onDelete,
  onLinkToJournals,
  onUnlinkFromJournals,
  onOpenLinkGoodToPartnersModal, // Use new prop name
  canOpenLinkGoodToPartnersModal, // Use new prop name
  onOpenUnlinkGoodFromPartnersModal, // Use new prop name
  canOpenUnlinkGoodFromPartnersModal, // Use new prop name
}) => {
  const menuStyle: React.CSSProperties | undefined = anchorEl
    ? {
        position: "absolute",
        top: anchorEl.getBoundingClientRect().bottom + window.scrollY + 8,
        left: anchorEl.getBoundingClientRect().left + window.scrollX,
      }
    : undefined;

  return (
    <AnimatePresence>
      {isOpen && anchorEl && (
        <>
          <motion.div
            key="goods-options-overlay"
            className={commonOptionStyles.optionsOverlay}
            onClick={onClose}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          />
          <motion.div
            key="goods-options-menu"
            className={commonOptionStyles.optionsMenu}
            style={menuStyle}
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Standard CRUD */}
            <button
              onClick={() => {
                onAdd();
                onClose();
              }}
              className={commonOptionStyles.optionButton}
            >
              <IoAddCircleOutline /> Add New Good/Service
            </button>
            <button
              onClick={() => {
                if (selectedGoodsId) onEdit();
                onClose();
              }}
              disabled={!selectedGoodsId}
              className={commonOptionStyles.optionButton}
            >
              <IoPencilOutline /> Edit Selected
            </button>
            <button
              onClick={() => {
                if (selectedGoodsId) onDelete();
                onClose();
              }}
              disabled={!selectedGoodsId}
              className={`${commonOptionStyles.optionButton} ${commonOptionStyles.deleteButton}`}
            >
              <IoTrashOutline /> Delete Selected
            </button>
            <div className={commonOptionStyles.menuDivider} />

            {/* 2-Way Journal-Good Links */}
            {onLinkToJournals && (
              <button
                onClick={() => {
                  onLinkToJournals();
                  onClose();
                }}
                className={commonOptionStyles.optionButton}
              >
                <IoLinkOutline /> Link to Journals
              </button>
            )}
            {onUnlinkFromJournals && (
              <button
                onClick={() => {
                  onUnlinkFromJournals();
                  onClose();
                }}
                className={commonOptionStyles.optionButton}
              >
                <IoUnlinkOutline /> Unlink from Journals
              </button>
            )}
            <div className={commonOptionStyles.menuDivider} />

            {/* --- 3-Way Good-Journal-Partner LINKING (Modal to select partners) --- */}
            {onOpenLinkGoodToPartnersModal && (
              <button
                onClick={() => {
                  // selectedGoodsId is implicitly used by the handler in page.tsx
                  if (canOpenLinkGoodToPartnersModal) {
                    onOpenLinkGoodToPartnersModal();
                  }
                  onClose();
                }}
                disabled={!canOpenLinkGoodToPartnersModal || !selectedGoodsId}
                className={commonOptionStyles.optionButton}
                title={
                  !canOpenLinkGoodToPartnersModal
                    ? "Option available when Good is 2nd after a selected Journal"
                    : "Link this Good to Partner(s) via active Journal"
                }
              >
                <IoGitCompareOutline /> Link to P(s) via Journal
              </button>
            )}

            {/* --- 3-Way Good-Journal-Partner UNLINKING (Modal to select existing JPGLs) --- */}
            {onOpenUnlinkGoodFromPartnersModal && (
              <button
                onClick={() => {
                  // selectedGoodsId is implicitly used by the handler in page.tsx
                  if (canOpenUnlinkGoodFromPartnersModal) {
                    onOpenUnlinkGoodFromPartnersModal();
                  }
                  onClose();
                }}
                disabled={
                  !canOpenUnlinkGoodFromPartnersModal || !selectedGoodsId
                }
                className={commonOptionStyles.optionButton}
                title={
                  !canOpenUnlinkGoodFromPartnersModal
                    ? "Option available when Good is filtered by Journal"
                    : "Unlink this Good from Partner(s) via active Journal"
                }
              >
                <IoUnlinkOutline /> Unlink from P(s) via Journal
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GoodsOptionsMenu;
