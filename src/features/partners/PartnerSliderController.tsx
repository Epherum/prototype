//src/features/partners/PartnerSliderController.tsx
"use client";

import React, { useMemo, useCallback } from "react";
import {
  IoOptionsOutline,
  IoAddCircleOutline,
  IoTrashBinOutline,
} from "react-icons/io5";
import styles from "@/app/page.module.css";
import { useAppStore } from "@/store/appStore";
import { usePartnerManager } from "./usePartnerManager";
import { usePartnerJournalLinking } from "@/features/linking/usePartnerJournalLinking";
import { useJournalPartnerGoodLinking } from "@/features/linking/useJournalPartnerGoodLinking";
import { fetchJournalLinksForPartner } from "@/services/clientJournalPartnerLinkService";
// Import the new shared hook
import { useSharedDocumentManager } from "@/features/documents/documentController";

import DynamicSlider from "@/features/shared/components/DynamicSlider";
import PartnerOptionsMenu from "@/features/partners/components/PartnerOptionsMenu";
import AddEditPartnerModal from "@/features/partners/components/AddEditPartnerModal";
import LinkPartnerToJournalsModal from "@/features/linking/components/LinkPartnerToJournalsModal";
import UnlinkPartnerFromJournalsModal from "@/features/linking/components/UnlinkPartnerFromJournalsModal";
import { SLIDER_TYPES } from "@/lib/constants";
import type {
  AccountNodeData,
  CreateJournalPartnerGoodLinkClientData,
  Partner,
} from "@/lib/types";

interface LayoutControlProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoveDisabled: boolean;
}

export interface PartnerSliderControllerProps extends LayoutControlProps {
  onOpenJournalSelector: (
    onSelectCallback: (journalNode: AccountNodeData) => void
  ) => void;
  fullJournalHierarchy: AccountNodeData[];
  onStartDocumentCreation: () => void;
}

export const PartnerSliderController: React.FC<
  PartnerSliderControllerProps
> = ({
  onOpenJournalSelector,
  fullJournalHierarchy,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  isMoveDisabled,
  onStartDocumentCreation,
}) => {
  const partnerManager = usePartnerManager();
  const partnerJournalLinking = usePartnerJournalLinking();
  const jpqlLinking = useJournalPartnerGoodLinking();
  // Use the shared hook, which gets its value from the context in DocumentController
  const documentCreation = useSharedDocumentManager();

  const isTerminalJournalActive = useAppStore(
    (state) => !!state.selections.journal.level3Ids.length
  );

  const handleStartDoc = () => {
    const selectedPartnerObject = (partnerManager.partnersForSlider || []).find(
      (p: Partner) => p.id === partnerManager.selectedPartnerId
    );
    if (selectedPartnerObject) {
      documentCreation.handleStartDocumentCreation(
        selectedPartnerObject,
        onStartDocumentCreation
      );
    } else {
      alert("Cannot start document: Selected partner data not found.");
    }
  };

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.controlsLeftGroup}>
          <button
            onClick={partnerManager.handleOpenPartnerOptionsMenu}
            className={`${styles.controlButton} ${styles.editButton}`}
            aria-label="Options for Partner"
            disabled={documentCreation.isDocumentCreationMode}
          >
            <IoOptionsOutline />
          </button>
          {isTerminalJournalActive &&
            !documentCreation.isDocumentCreationMode &&
            partnerManager.selectedPartnerId && (
              <button
                onClick={handleStartDoc}
                className={`${styles.controlButton} ${styles.createDocumentButton}`}
                title="Create Document with this Partner"
              >
                <IoAddCircleOutline /> Doc
              </button>
            )}
          {documentCreation.isDocumentCreationMode &&
            documentCreation.lockedPartnerId ===
              partnerManager.selectedPartnerId && (
              <button
                onClick={documentCreation.handleCancelDocumentCreation}
                className={`${styles.controlButton} ${styles.cancelDocumentButton}`}
                title="Cancel Document Creation"
              >
                <IoTrashBinOutline /> Cancel Doc
              </button>
            )}
        </div>
        <div className={styles.moveButtonGroup}>
          {canMoveUp && (
            <button
              onClick={onMoveUp}
              className={styles.controlButton}
              disabled={isMoveDisabled}
            >
              ▲ Up
            </button>
          )}
          {canMoveDown && (
            <button
              onClick={onMoveDown}
              className={styles.controlButton}
              disabled={isMoveDisabled}
            >
              ▼ Down
            </button>
          )}
        </div>
      </div>
      <DynamicSlider
        sliderId={SLIDER_TYPES.PARTNER}
        title="Partner"
        data={(partnerManager.partnersForSlider || []).map((p) => ({
          ...p,
          id: String(p.id),
          name: p.name,
          code: String(p.registrationNumber || p.id),
        }))}
        isLoading={
          partnerManager.partnerQuery.isLoading ||
          partnerManager.partnerQuery.isFetching
        }
        isError={partnerManager.partnerQuery.isError}
        error={partnerManager.partnerQuery.error}
        activeItemId={partnerManager.selectedPartnerId}
        onSlideChange={partnerManager.setSelectedPartnerId}
        isAccordionOpen={false}
        onToggleAccordion={() => {}}
        isLocked={documentCreation.isDocumentCreationMode}
        isDocumentCreationMode={documentCreation.isDocumentCreationMode}
      />
      {/* Modals are unchanged */}
    </>
  );
};
