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
import { SliderLayoutManager } from "@/components/layout/SliderLayoutManager";
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
    // The useJournalManager hook now provides isTerminal:
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
      <SliderLayoutManager
        ref={journalControllerRef}
        onOpenJournalSelectorForLinking={openJournalSelectorForLinking}
        onOpenJournalSelectorForGPGContext={openJournalSelectorForGPGContext}
      />

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
