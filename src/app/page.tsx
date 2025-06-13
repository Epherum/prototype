//src/app/page.tsx
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

// Layout Components
import StickyHeaderControls from "@/components/layout/StickyHeaderControls";
import UserAuthDisplay from "@/components/layout/UserAuthDisplay";

// Cross-cutting Hooks
import { useDocumentCreation } from "@/hooks/useDocumentCreation";
import { useJournalPartnerGoodLinking } from "@/features/linking/useJournalPartnerGoodLinking";
import { useUserManagement } from "@/hooks/useUserManagement";

// Manager Hooks (Only for props passed to controllers)
import { useJournalManager } from "@/features/journals/useJournalManager";

// Global Modals
import DocumentConfirmationModal from "@/components/modals/DocumentConfirmationModal";
import CreateUserModal from "@/components/modals/CreateUserModal";
import LinkGoodToPartnersViaJournalModal from "@/features/linking/components/LinkGoodToPartnersViaJournalModal";
import UnlinkGoodFromPartnersViaJournalModal from "@/features/linking/components/UnlinkGoodFromPartnersViaJournalModal";

// Types
import type { AccountNodeData } from "@/lib/types";

export default function Home() {
  useAuthStoreInitializer();

  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const moveSlider = useAppStore((state) => state.moveSlider);
  const toggleSliderVisibility = useAppStore(
    (state) => state.toggleSliderVisibility
  );

  const journalControllerRef = useRef<JournalSliderControllerRef>(null);

  const documentCreation = useDocumentCreation();
  const userManagement = useUserManagement();
  const jpqlLinking = useJournalPartnerGoodLinking();
  const journalManager = useJournalManager();

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
    [SLIDER_TYPES.PROJECT]: { title: "Project (Future)" },
    [SLIDER_TYPES.DOCUMENT]: { title: "Document (Future)" },
  };

  return (
    <div className={styles.pageContainer}>
      <h1 className={styles.title}>ERP Application Interface</h1>
      <UserAuthDisplay
        onOpenCreateUserModal={userManagement.openCreateUserModal}
      />
      <StickyHeaderControls
        visibility={visibility}
        onToggleVisibility={toggleSliderVisibility}
        allSliderIds={INITIAL_ORDER}
        visibleSliderOrder={visibleSliderOrder}
        sliderConfigs={sliderConfigs}
      />
      <LayoutGroup id="main-sliders-layout-group">
        <div className={styles.slidersArea}>
          <AnimatePresence initial={false}>
            {sliderOrder.map((sliderId) => {
              if (!visibility[sliderId]) return null;

              const motionOrderIndex = sliderOrder.indexOf(sliderId);
              const currentVisibleIndex = visibleSliderOrder.indexOf(sliderId);
              const canMoveUp = currentVisibleIndex > 0;
              const canMoveDown =
                currentVisibleIndex < visibleSliderOrder.length - 1;

              const layoutControlProps = {
                canMoveUp,
                canMoveDown,
                onMoveUp: () => moveSlider(sliderId, "up"),
                onMoveDown: () => moveSlider(sliderId, "down"),
                isMoveDisabled: documentCreation.isDocumentCreationMode,
              };

              return (
                <motion.div
                  key={sliderId}
                  layoutId={sliderId}
                  layout
                  style={{ order: motionOrderIndex }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{
                    duration: 0.3,
                    layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
                  }}
                  className={styles.sliderWrapper}
                >
                  {/* --- FINAL, CLEAN RENDER LOGIC --- */}
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
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>

      {/* --- GLOBAL MODALS & OVERLAYS --- */}
      {documentCreation.isDocumentCreationMode && (
        <div className={styles.finishDocumentContainer}>
          <button
            onClick={documentCreation.handleFinishDocument}
            className={`${styles.modalButtonPrimary} ${styles.finishDocumentButton}`}
          >
            Finish Document & Review
          </button>
        </div>
      )}

      <AnimatePresence>
        {documentCreation.isConfirmationModalOpen && (
          <DocumentConfirmationModal
            isOpen={documentCreation.isConfirmationModalOpen}
            onClose={documentCreation.closeConfirmationModal}
            onValidate={documentCreation.handleValidateDocument}
            partner={documentCreation.lockedPartnerDetails}
            goods={documentCreation.selectedGoodsForDocument}
          />
        )}

        {userManagement.isCreateUserModalOpen && (
          <CreateUserModal
            isOpen={userManagement.isCreateUserModalOpen}
            onClose={userManagement.closeCreateUserModal}
          />
        )}

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
