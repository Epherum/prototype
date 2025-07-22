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

// Import Slider Controllers
import {
  JournalSliderController,
  type JournalSliderControllerRef,
} from "@/features/journals/JournalSliderController";
import { PartnerSliderController } from "@/features/partners/PartnerSliderController";
import { GoodsSliderController } from "@/features/goods/GoodsSliderController";
import { DocumentController } from "@/features/documents/DocumentController";
import { ProjectSliderController } from "@/features/projects/ProjectSliderController"; // Keep for future use

// Props for linking modals that remain in page.tsx
interface SliderLayoutManagerProps {
  onOpenJournalSelectorForLinking: (callback: (node: any) => void) => void;
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
    const { sliderOrder, visibility, documentCreationState } = useAppStore(
      (state) => state.ui
    );
    const moveSlider = useAppStore((state) => state.moveSlider);

    // Manager hooks to get state needed by controllers
    const journalManager = useJournalManager();
    const docManager = useDocumentManager();
    const jpqlLinking = useJournalPartnerGoodLinking(); // For linking modal triggers

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

    const isCreationEnabled = useMemo(
      () =>
        journalManager.isTerminal && journalManager.selectedJournalId !== null,
      [journalManager.isTerminal, journalManager.selectedJournalId]
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
                      onOpenJournalSelector={onOpenJournalSelectorForLinking}
                      fullJournalHierarchy={journalManager.hierarchyData}
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
                      fullJournalHierarchy={journalManager.hierarchyData}
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
                    />
                  )}

                  {sliderId === SLIDER_TYPES.PROJECT && (
                    <ProjectSliderController {...layoutControlProps} />
                  )}

                  {sliderId === SLIDER_TYPES.DOCUMENT && (
                    <DocumentController
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
