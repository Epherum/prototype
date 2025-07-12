"use client";

// React & Next.js Core
import { useRef, useCallback, useMemo } from "react";

// Third-party Libraries
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";

// Styles & Constants
import styles from "./page.module.css";
import { SLIDER_TYPES, INITIAL_ORDER } from "@/lib/constants";
import "swiper/css";

// Store & State Initialization
import { useAppStore } from "@/store/appStore";
import { useAuthStoreInitializer } from "@/hooks/useAuthStoreInitializer";

// Feature Controllers
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

// Layout Components
import StickyHeaderControls from "@/components/layout/StickyHeaderControls";
import UserAuthDisplay from "@/components/layout/UserAuthDisplay";

// Cross-cutting Hooks & Manager Hooks
import { useJournalPartnerGoodLinking } from "@/features/linking/useJournalPartnerGoodLinking";
import { useJournalManager } from "@/features/journals/useJournalManager";
import { useDocumentManager } from "@/features/documents/useDocumentManager";

// Global Modals
import LinkGoodToPartnersViaJournalModal from "@/features/linking/components/LinkGoodToPartnersViaJournalModal";
import UnlinkGoodFromPartnersViaJournalModal from "@/features/linking/components/UnlinkGoodFromPartnersViaJournalModal";

// Types
import type { AccountNodeData } from "@/lib/types";

export default function Home() {
  useAuthStoreInitializer();

  const documentControllerRef = useRef(null);
  const usersControllerRef = useRef<UsersControllerRef>(null);
  const journalControllerRef = useRef<JournalSliderControllerRef>(null);

  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const moveSlider = useAppStore((state) => state.moveSlider);
  const toggleSliderVisibility = useAppStore(
    (state) => state.toggleSliderVisibility
  );

  const docManager = useDocumentManager();
  const isDocumentCreationMode = docManager.isCreating;

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
            isDocumentCreationMode ? styles.slidersAreaWithToolbar : ""
          }`}
        >
          <AnimatePresence initial={false}>
            {sliderOrder.map((sliderId) => {
              if (!visibility[sliderId]) return null;

              const currentVisibleIndex = visibleSliderOrder.indexOf(sliderId);
              const isMoveDisabledForThisSlider = isDocumentCreationMode;

              const layoutControlProps = {
                canMoveUp: currentVisibleIndex > 0,
                canMoveDown:
                  currentVisibleIndex < visibleSliderOrder.length - 1,
                onMoveUp: () => moveSlider(sliderId, "up"),
                onMoveDown: () => moveSlider(sliderId, "down"),
                isMoveDisabled: isMoveDisabledForThisSlider,
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
                    />
                  )}

                  {sliderId === SLIDER_TYPES.GOODS && (
                    <GoodsSliderController
                      {...layoutControlProps}
                      onToggleGoodForDocument={docManager.handleAddOrRemoveGood}
                      isGoodInDocument={docManager.isGoodInDocument}
                      documentLines={docManager.lines}
                      onUpdateLineForDocument={docManager.handleUpdateLine}
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
                    />
                  )}

                  {sliderId === SLIDER_TYPES.PROJECT && (
                    <ProjectSliderController {...layoutControlProps} />
                  )}

                  {sliderId === SLIDER_TYPES.DOCUMENT && (
                    <DocumentController
                      ref={documentControllerRef}
                      {...layoutControlProps}
                      manager={docManager} // <<< --- FIX: Pass the single manager instance
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>
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
    </div>
  );
}
