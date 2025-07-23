"use client";

import { useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion"; // <-- Import motion
import styles from "./page.module.css";
import { SLIDER_TYPES, INITIAL_ORDER } from "@/lib/constants";
import "swiper/css";
import { useAppStore } from "@/store/appStore";
import { useAuthStoreInitializer } from "@/hooks/useAuthStoreInitializer";
import { type JournalSliderControllerRef } from "@/features/journals/JournalSliderController";
import {
  UsersController,
  type UsersControllerRef,
} from "@/features/users/UsersController";
import { SliderLayoutManager } from "@/components/layout/SliderLayoutManager";
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

// Animation Variants for the initial page load
const pageContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1], // Decelerate curve for a professional feel
    },
  },
};

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

  const isCreationEnabled = useMemo(() => {
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
    <motion.div
      className={styles.pageContainer}
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <UsersController ref={usersControllerRef} />

      <motion.h1 variants={itemVariants} className={styles.title}>
        ERP Application Interface
      </motion.h1>

      <motion.div variants={itemVariants}>
        <UserAuthDisplay
          onOpenCreateUserModal={() => usersControllerRef.current?.open()}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <StickyHeaderControls
          visibility={visibility}
          onToggleVisibility={toggleSliderVisibility}
          allSliderIds={INITIAL_ORDER}
          visibleSliderOrder={visibleSliderOrder}
          sliderConfigs={sliderConfigs}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <SliderLayoutManager
          ref={journalControllerRef}
          onOpenJournalSelectorForLinking={openJournalSelectorForLinking}
          onOpenJournalSelectorForGPGContext={openJournalSelectorForGPGContext}
        />
      </motion.div>

      {/* --- Other Modals (animations handled by AnimatePresence) --- */}
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
    </motion.div>
  );
}
