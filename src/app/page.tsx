// src/app/page.tsx
"use client";

import { useRef, useCallback, useMemo } from "react";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import styles from "./page.module.css";
import { SLIDER_TYPES, INITIAL_ORDER } from "@/lib/constants";
import "swiper/css";
import { useAppStore } from "@/store/appStore";
import { useAuthStoreInitializer } from "@/hooks/useAuthStoreInitializer";
import { PartnerSliderController } from "@/features/partners/PartnerSliderController";
import { GoodsSliderController } from "@/features/goods/GoodsSliderController";
import {
  JournalSliderController,
  type JournalSliderControllerRef,
} from "@/features/journals/JournalSliderController";
import { DocumentController } from "@/features/documents/DocumentController";
import {
  UsersController,
  type UsersControllerRef,
} from "@/features/users/UsersController";
import { ProjectSliderController } from "@/features/projects/ProjectSliderController";
import StickyHeaderControls from "@/components/layout/StickyHeaderControls";
import UserAuthDisplay from "@/components/layout/UserAuthDisplay";
import { useJournalPartnerGoodLinking } from "@/features/linking/useJournalPartnerGoodLinking";
import { useJournalManager } from "@/features/journals/useJournalManager";
import { useDocumentManager } from "@/features/documents/useDocumentManager";
import { useGoodManager } from "@/features/goods/useGoodManager";
import LinkGoodToPartnersViaJournalModal from "@/features/linking/components/LinkGoodToPartnersViaJournalModal";
import UnlinkGoodFromPartnersViaJournalModal from "@/features/linking/components/UnlinkGoodFromPartnersViaJournalModal";
import type { AccountNodeData } from "@/lib/types";
import DocumentCreationToolbar from "@/features/documents/components/DocumentCreationToolbar";

export default function Home() {
  useAuthStoreInitializer();

  const usersControllerRef = useRef<UsersControllerRef>(null);
  const journalControllerRef = useRef<JournalSliderControllerRef>(null);

  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const moveSlider = useAppStore((state) => state.moveSlider);
  const toggleSliderVisibility = useAppStore(
    (state) => state.toggleSliderVisibility
  );

  const docManager = useDocumentManager();
  const goodManager = useGoodManager();

  const {
    isCreating,
    mode,
    lockedPartnerIds,
    lockedGoodIds,
    toggleEntityForDocument,
  } = docManager;

  const journalManager = useJournalManager();
  const jpqlLinking = useJournalPartnerGoodLinking();

  const openJournalSelectorForLinking = useCallback(
    (callback: (node: AccountNodeData) => void) => {
      journalControllerRef.current?.openJournalSelector(callback);
    },
    []
  );

  const openJournalSelectorForGPGContext = useCallback(() => {
    journalControllerRef.current?.openJournalSelectorForGPG();
  }, []);

  const visibleSliderOrder = useMemo(
    () => sliderOrder.filter((id) => visibility[id]),
    [sliderOrder, visibility]
  );

  // ✅ NEW: Logic to determine if document creation should be enabled.
  // This adheres to the new rule: creation is enabled only when a single, terminal journal is selected.
  const isCreationEnabled = useMemo(() => {
    // The useJournalManager hook already provides the necessary derived state:
    // - `selectedJournalId` is non-null only if there's a single selection.
    // - `isTerminal` is true only if that single selection has no children.
    return (
      journalManager.isTerminal && journalManager.selectedJournalId !== null
    );
  }, [journalManager.isTerminal, journalManager.selectedJournalId]);

  const sliderConfigs = {
    [SLIDER_TYPES.JOURNAL]: { title: "Journal" },
    [SLIDER_TYPES.PARTNER]: { title: "Partner" },
    [SLIDER_TYPES.GOODS]: { title: "Goods" },
    [SLIDER_TYPES.PROJECT]: { title: "Project" },
    [SLIDER_TYPES.DOCUMENT]: { title: "Document" },
  };

  return (
    <div className={styles.pageContainer}>
      <UsersController ref={usersControllerRef} />
      <h1 className={styles.title}>ERP Application Interface</h1>
      <UserAuthDisplay
        onOpenCreateUserModal={() => usersControllerRef.current?.open()}
      />
      <StickyHeaderControls
        visibility={visibility}
        onToggleVisibility={toggleSliderVisibility}
        allSliderIds={INITIAL_ORDER}
        visibleSliderOrder={visibleSliderOrder}
        sliderConfigs={sliderConfigs}
      />
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
                      ref={journalControllerRef}
                      {...layoutControlProps}
                    />
                  )}

                  {sliderId === SLIDER_TYPES.PARTNER && (
                    <PartnerSliderController
                      {...layoutControlProps}
                      onOpenJournalSelector={openJournalSelectorForLinking}
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
                        openJournalSelectorForLinking
                      }
                      onOpenJournalSelectorForGPGContext={
                        openJournalSelectorForGPGContext
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
                      // ✅ PASS THE NEW PROP: The DocumentController will now know when to show its create button.
                      isCreationEnabled={isCreationEnabled}
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>

      {/* --- Other Modals --- */}
      <AnimatePresence>
        {jpqlLinking.isLinkModalOpen && (
          <LinkGoodToPartnersViaJournalModal
            isOpen={jpqlLinking.isLinkModalOpen}
            onClose={jpqlLinking.closeLinkModal}
            onSubmitLinks={jpqlLinking.submitLinks}
            goodToLink={jpqlLinking.goodForJpgLinking}
            targetJournal={jpqlLinking.targetJournalForJpgLinking}
            availablePartners={jpqlLinking.partnersForJpgModal}
            isSubmitting={
              jpqlLinking.isSubmittingLinkJPGL ||
              jpqlLinking.isLoadingPartnersForJpgModal
            }
          />
        )}
        {jpqlLinking.isUnlinkModalOpen && (
          <UnlinkGoodFromPartnersViaJournalModal
            isOpen={jpqlLinking.isUnlinkModalOpen}
            onClose={jpqlLinking.closeUnlinkModal}
            onConfirmUnlink={jpqlLinking.submitUnlink}
            goodToUnlink={jpqlLinking.goodForUnlinkingContext}
            contextJournal={jpqlLinking.journalForUnlinkingContext}
            existingLinks={jpqlLinking.existingJpgLinksForModal}
            isSubmitting={
              jpqlLinking.isSubmittingUnlinkJPGL ||
              jpqlLinking.isLoadingJpgLinksForModal
            }
            isLoadingLinks={jpqlLinking.isLoadingJpgLinksForModal}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCreating && (
          <DocumentCreationToolbar
            onCancel={docManager.handleCancelCreation}
            onFinish={() =>
              docManager.handlePrepareFinalization(goodManager.goodsForSlider)
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}
