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
import {
  GoodsSliderController,
  type GoodsSliderControllerRef,
} from "@/features/goods/GoodsSliderController";
import {
  JournalSliderController,
  type JournalSliderControllerRef,
} from "@/features/journals/JournalSliderController";
// Import the new top-level DocumentController, which now wraps everything.
import { DocumentController } from "@/features/documents/documentController";

// Layout Components
import StickyHeaderControls from "@/components/layout/StickyHeaderControls";
import UserAuthDisplay from "@/components/layout/UserAuthDisplay";

// Cross-cutting Hooks
import { useJournalPartnerGoodLinking } from "@/features/linking/useJournalPartnerGoodLinking";
import { useUserManagement } from "@/hooks/useUserManagement";

// Manager Hooks (Only for props passed to controllers)
import { useJournalManager } from "@/features/journals/useJournalManager";

// Global Modals (DocumentConfirmationModal is no longer needed here)
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
  // This is still useful for disabling the move buttons globally
  const isDocumentCreationMode = useAppStore(
    (state) => state.ui.isCreatingDocument
  );

  const journalControllerRef = useRef<JournalSliderControllerRef>(null);
  const goodsControllerRef = useRef<GoodsSliderControllerRef>(null);

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

  const handleStartDocumentCreation = useCallback(() => {
    goodsControllerRef.current?.openDetailsAccordion();
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
    // The new DocumentController wraps the entire page content.
    // This provides the shared context to all child components that need it.
    <DocumentController>
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

                const currentVisibleIndex =
                  visibleSliderOrder.indexOf(sliderId);
                const layoutControlProps = {
                  canMoveUp: currentVisibleIndex > 0,
                  canMoveDown:
                    currentVisibleIndex < visibleSliderOrder.length - 1,
                  onMoveUp: () => moveSlider(sliderId, "up"),
                  onMoveDown: () => moveSlider(sliderId, "down"),
                  isMoveDisabled: isDocumentCreationMode,
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
                        onStartDocumentCreation={handleStartDocumentCreation}
                      />
                    )}

                    {sliderId === SLIDER_TYPES.GOODS && (
                      <GoodsSliderController
                        ref={goodsControllerRef}
                        {...layoutControlProps}
                        onOpenJournalSelectorForLinking={
                          openJournalSelectorForLinking
                        }
                        onOpenJournalSelectorForGPGContext={
                          openJournalSelectorForGPGContext
                        }
                        fullJournalHierarchy={journalManager.hierarchyData}
                        onOpenLinkGoodToPartnersModal={
                          jpqlLinking.openLinkModal
                        }
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

        {/* The document UI (toolbar, modals) is now handled inside DocumentController.
            page.tsx is clean and only responsible for layout and other global modals. */}
        <AnimatePresence>
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
    </DocumentController>
  );
}
