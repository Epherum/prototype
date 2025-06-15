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
import { DocumentController } from "@/features/documents/documentController";
import {
  UsersController,
  type UsersControllerRef,
} from "@/features/users/UsersController";

// Layout Components
import StickyHeaderControls from "@/components/layout/StickyHeaderControls";
import UserAuthDisplay from "@/components/layout/UserAuthDisplay";

// Cross-cutting Hooks
import { useJournalPartnerGoodLinking } from "@/features/linking/useJournalPartnerGoodLinking";

// Manager Hooks
import { useJournalManager } from "@/features/journals/useJournalManager";

// Global Modals
import LinkGoodToPartnersViaJournalModal from "@/features/linking/components/LinkGoodToPartnersViaJournalModal";
import UnlinkGoodFromPartnersViaJournalModal from "@/features/linking/components/UnlinkGoodFromPartnersViaJournalModal";

// Types
import type { AccountNodeData } from "@/lib/types";

export default function Home() {
  useAuthStoreInitializer();

  // --- REFS FOR CONTROLLERS ---
  const usersControllerRef = useRef<UsersControllerRef>(null);
  const journalControllerRef = useRef<JournalSliderControllerRef>(null);

  // --- APP STATE ---
  const sliderOrder = useAppStore((state) => state.ui.sliderOrder);
  const visibility = useAppStore((state) => state.ui.visibility);
  const moveSlider = useAppStore((state) => state.moveSlider);
  const toggleSliderVisibility = useAppStore(
    (state) => state.toggleSliderVisibility
  );
  const isDocumentCreationMode = useAppStore(
    (state) => state.ui.isCreatingDocument
  );

  // --- MANAGER HOOKS ---
  // This is the SINGLE, authoritative instance of the journal manager hook.
  const journalManager = useJournalManager();
  const jpqlLinking = useJournalPartnerGoodLinking();

  // --- CALLBACKS for cross-feature communication ---
  const openJournalSelectorForLinking = useCallback(
    (callback: (node: AccountNodeData) => void) => {
      journalControllerRef.current?.openJournalSelector(callback);
    },
    []
  );

  const openJournalSelectorForGPGContext = useCallback(() => {
    journalControllerRef.current?.openJournalSelectorForGPG();
  }, []);

  // --- DERIVED STATE ---
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
    // Pass the single journalManager instance to the DocumentController
    <DocumentController journalManager={journalManager}>
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
    </DocumentController>
  );
}
