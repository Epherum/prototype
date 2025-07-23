//src/components/layout/SliderLayoutManager.tsx
"use client";

import React, { useMemo, forwardRef } from "react";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import styles from "@/app/page.module.css";
import { SLIDER_TYPES } from "@/lib/constants";

// Import Hooks
import { useAppStore } from "@/store/appStore";
import { useJournalManager } from "@/features/journals/useJournalManager";
import { useDocumentManager } from "@/features/documents/useDocumentManager";
import { useJournalPartnerGoodLinking } from "@/features/linking/useJournalPartnerGoodLinking";
import { usePartnerManager } from "@/features/partners/usePartnerManager";
import { useGoodManager } from "@/features/goods/useGoodManager";

// Import Slider Controllers
import {
  JournalSliderController,
  type JournalSliderControllerRef,
} from "@/features/journals/JournalSliderController";
import { PartnerSliderController } from "@/features/partners/PartnerSliderController";
import { GoodsSliderController } from "@/features/goods/GoodsSliderController";
import { DocumentSliderController } from "@/features/documents/DocumentSliderController";
import { ProjectSliderController } from "@/features/projects/ProjectSliderController";

// Types
import type { AccountNodeData } from "@/lib/types";

// Props for linking modals that remain in page.tsx
interface SliderLayoutManagerProps {
  onOpenJournalSelectorForLinking: (
    callback: (node: AccountNodeData) => void
  ) => void;
  onOpenJournalSelectorForGPGContext: () => void;
}

export const SliderLayoutManager = forwardRef<
  JournalSliderControllerRef,
  SliderLayoutManagerProps
>(
  (
    { onOpenJournalSelectorForLinking, onOpenJournalSelectorForGPGContext },
    ref
  ) => {
    // State from Zustand store
    const { sliderOrder, visibility } = useAppStore((state) => state.ui);
    const moveSlider = useAppStore((state) => state.moveSlider);

    // Manager hooks to get state needed by controllers
    const journalManager = useJournalManager();
    const docManager = useDocumentManager();
    const partnerManager = usePartnerManager();
    const goodManager = useGoodManager();
    const jpqlLinking = useJournalPartnerGoodLinking();

    const {
      isCreating,
      mode,
      lockedPartnerIds,
      lockedGoodIds,
      toggleEntityForDocument,
    } = docManager;

    const visibleSliderOrder = useMemo(
      () => sliderOrder.filter((id) => visibility[id]),
      [sliderOrder, visibility]
    );

    // ✅ FIX: Corrected the logic to use the new authoritative state.
    // The `isTerminal` flag has been removed. The single source of truth for a
    // valid, single selection is now whether `selectedJournalId` has a value.
    const isCreationEnabled = useMemo(
      () => journalManager.selectedJournalId !== null,
      [journalManager.selectedJournalId]
    );

    return (
      <LayoutGroup id="main-sliders-layout-group">
        <div
          className={`${styles.slidersArea} ${
            isCreating ? styles.slidersAreaWithToolbar : ""
          }`}
        >
          <AnimatePresence initial={false}>
            {sliderOrder.map((sliderId) => {
              if (!visibility[sliderId]) return null;

              const currentVisibleIndex = visibleSliderOrder.indexOf(sliderId);
              const layoutControlProps = {
                canMoveUp: currentVisibleIndex > 0,
                canMoveDown:
                  currentVisibleIndex < visibleSliderOrder.length - 1,
                onMoveUp: () => moveSlider(sliderId, "up"),
                onMoveDown: () => moveSlider(sliderId, "down"),
                isMoveDisabled: isCreating,
              };

              return (
                <motion.div
                  key={sliderId}
                  layoutId={sliderId}
                  layout
                  style={{ order: currentVisibleIndex }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{
                    duration: 0.3,
                    layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
                  }}
                  className={styles.sliderWrapper}
                >
                  {sliderId === SLIDER_TYPES.JOURNAL && (
                    <JournalSliderController
                      ref={ref}
                      {...layoutControlProps}
                    />
                  )}

                  {sliderId === SLIDER_TYPES.PARTNER && (
                    <PartnerSliderController
                      {...layoutControlProps}
                      isLocked={
                        isCreating &&
                        (mode === "LOCK_PARTNER" || mode === "SINGLE_ITEM")
                      }
                      isMultiSelect={
                        isCreating &&
                        (mode === "INTERSECT_FROM_GOOD" ||
                          mode === "INTERSECT_FROM_PARTNER" ||
                          mode === "LOCK_GOOD")
                      }
                      selectedPartnerIdsForDoc={lockedPartnerIds}
                      onTogglePartnerForDoc={(id) =>
                        toggleEntityForDocument("partner", id)
                      }
                      onOpenJournalSelector={onOpenJournalSelectorForLinking}
                      fullJournalHierarchy={journalManager.hierarchyData}
                    />
                  )}

                  {sliderId === SLIDER_TYPES.GOODS && (
                    <GoodsSliderController
                      {...layoutControlProps}
                      onOpenJournalSelectorForLinking={
                        onOpenJournalSelectorForLinking
                      }
                      onOpenJournalSelectorForGPGContext={
                        onOpenJournalSelectorForGPGContext
                      }
                      onOpenLinkGoodToPartnersModal={jpqlLinking.openLinkModal}
                      onOpenUnlinkGoodFromPartnersModal={
                        jpqlLinking.openUnlinkModal
                      }
                      isLocked={
                        isCreating &&
                        (mode === "LOCK_GOOD" || mode === "SINGLE_ITEM")
                      }
                      isMultiSelect={
                        isCreating &&
                        (mode === "LOCK_PARTNER" ||
                          mode === "INTERSECT_FROM_PARTNER" ||
                          mode === "INTERSECT_FROM_GOOD")
                      }
                      selectedGoodIdsForDoc={lockedGoodIds}
                      onToggleGoodForDoc={(id) =>
                        toggleEntityForDocument("good", id)
                      }
                      fullJournalHierarchy={journalManager.hierarchyData}
                    />
                  )}

                  {sliderId === SLIDER_TYPES.PROJECT && (
                    <ProjectSliderController {...layoutControlProps} />
                  )}

                  {sliderId === SLIDER_TYPES.DOCUMENT && (
                    <DocumentSliderController
                      manager={docManager}
                      {...layoutControlProps}
                      isCreationEnabled={isCreationEnabled}
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    );
  }
);

SliderLayoutManager.displayName = "SliderLayoutManager";
