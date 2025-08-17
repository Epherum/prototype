// src/features/partners/PartnerSliderController.tsx
"use client";

import React, { useMemo, useCallback } from "react";
import { IoOptionsOutline } from "react-icons/io5";
import styles from "@/app/page.module.css";
import { useAppStore } from "@/store/appStore";
import { usePartnerManager } from "./usePartnerManager";
import { usePartnerJournalLinking } from "@/features/linking/usePartnerJournalLinking";
import { useJournalPartnerGoodLinking } from "@/features/linking/useJournalPartnerGoodLinking";
import { getJournalPartnerLinks } from "@/services/clientJournalPartnerLinkService";
import DynamicSlider from "@/features/shared/components/DynamicSlider";
import PartnerOptionsMenu from "./components/PartnerOptionsMenu";
import AddEditPartnerModal from "./components/AddEditPartnerModal";
import LinkPartnerToJournalsModal from "@/features/linking/components/LinkPartnerToJournalsModal";
import UnlinkPartnerFromJournalsModal from "@/features/linking/components/UnlinkPartnerFromJournalsModal";
import { SLIDER_TYPES } from "@/lib/constants";

// ✅ ADDED: New, specific type imports.
import { PartnerClient } from "@/lib/types/models.client";
import { CreateJournalPartnerGoodLinkPayload } from "@/lib/schemas/journalPartnerGoodLink.schema";
import { AccountNodeData } from "@/lib/types/ui"; // Assuming AccountNodeData is a UI-specific type now.

export interface PartnerSliderControllerProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoveDisabled: boolean;
  onOpenJournalSelector: (cb: (node: AccountNodeData) => void) => void;
  fullJournalHierarchy: AccountNodeData[];
  isLocked: boolean;
  isMultiSelect: boolean;
  selectedPartnerIdsForDoc: string[];
  onTogglePartnerForDoc: (partnerId: string) => void;
}

export const PartnerSliderController: React.FC<
  PartnerSliderControllerProps
> = ({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  isMoveDisabled,
  onOpenJournalSelector,
  fullJournalHierarchy,
  isLocked,
  isMultiSelect,
  selectedPartnerIdsForDoc,
  onTogglePartnerForDoc,
}) => {
  const partnerManager = usePartnerManager();
  const partnerJournalLinking = usePartnerJournalLinking();
  const jpqlLinking = useJournalPartnerGoodLinking();
  const { isCreating, mode } = useAppStore((state) => state.ui.documentCreationState);
  const isDetailsAccordionOpen = useAppStore(
    (state) => !!state.accordionState[SLIDER_TYPES.PARTNER]
  );
  const toggleAccordion = useAppStore((state) => state.toggleAccordion);
  const sliderOrder = useAppStore((state) => state.sliderOrder);
  const visibility = useAppStore((state) => state.visibility);
  const { gpgContextJournalId, good: selectedGoodId, journal: journalSelection } = useAppStore(
    // Corrected selection name
    (state) => state.selections
  );

  const handleItemClick = (id: string) => {
    if (isMultiSelect) {
      onTogglePartnerForDoc(id);
    } else {
      partnerManager.setSelectedPartnerId(id);
    }
  };

  const isGPStartOrder = useMemo(() => {
    const visibleSliders = sliderOrder.filter((id) => visibility[id]);
    return (
      visibleSliders[0] === SLIDER_TYPES.GOODS &&
      visibleSliders[1] === SLIDER_TYPES.PARTNER
    );
  }, [sliderOrder, visibility]);

  // Check if journal slider comes before partner slider for filter color coding
  const shouldShowFilterColors = useMemo(() => {
    const visibleSliders = sliderOrder.filter((id) => visibility[id]);
    const journalIndex = visibleSliders.indexOf(SLIDER_TYPES.JOURNAL);
    const partnerIndex = visibleSliders.indexOf(SLIDER_TYPES.PARTNER);
    return journalIndex !== -1 && partnerIndex !== -1 && journalIndex < partnerIndex;
  }, [sliderOrder, visibility]);

  const canCreateGPGLink = useMemo(
    () =>
      isGPStartOrder &&
      !!gpgContextJournalId &&
      !!selectedGoodId &&
      !!partnerManager.selectedPartnerId,
    [
      isGPStartOrder,
      gpgContextJournalId,
      selectedGoodId,
      partnerManager.selectedPartnerId,
    ]
  );

  const handleCreateGPGLink = useCallback(() => {
    if (!canCreateGPGLink) return;

    // ✅ CHANGED: Constructing the payload from the Zod-inferred type.
    const linkData: CreateJournalPartnerGoodLinkPayload = {
      journalId: gpgContextJournalId!,
      partnerId: partnerManager.selectedPartnerId!,
      goodId: selectedGoodId!,
    };
    jpqlLinking.createSimpleJPGL(linkData);
  }, [
    canCreateGPGLink,
    gpgContextJournalId,
    selectedGoodId,
    partnerManager.selectedPartnerId,
    jpqlLinking,
  ]);

  // ✅ CHANGED: The `partnersForSlider` from the manager is already PartnerClient[]
  // so no mapping is needed if the types are compatible. We ensure the `id` is a string.
  const sliderData = useMemo(
    () =>
      partnerManager.partnersForSlider.map((p: any) => ({
        id: p.id, // ID is already a string
        label: p.name,
        code: p.registrationNumber,
        // Include all partner fields for the details accordion
        ...p,
        // Add formatted journal information for display with ID and name
        journalNames: p.journalPartnerLinks?.map((link: any) => 
          link.journal ? `${link.journal.id} - ${link.journal.name}` : null
        ).filter(Boolean).join(", ") || "No journals",
      })),
    [partnerManager.partnersForSlider]
  );

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.controlsLeftGroup}>
          <div className={styles.optionsButtonContainer}>
            <button
              onClick={partnerManager.handleOpenPartnerOptionsMenu}
              className={`${styles.controlButton} ${styles.editButton}`}
              aria-label="Options for Partner"
              disabled={isCreating}
            >
              <IoOptionsOutline />
            </button>
            <PartnerOptionsMenu
              isOpen={partnerManager.isPartnerOptionsMenuOpen}
              onClose={partnerManager.handleClosePartnerOptionsMenu}
              anchorEl={partnerManager.partnerOptionsMenuAnchorEl}
              selectedPartnerId={partnerManager.selectedPartnerId}
              onAdd={partnerManager.handleOpenAddPartnerModal}
              onEdit={partnerManager.handleOpenEditPartnerModal}
              onDelete={partnerManager.handleDeleteCurrentPartner}
              onLinkToJournals={partnerJournalLinking.openLinkModal}
              onUnlinkFromJournals={partnerJournalLinking.openUnlinkModal}
              onCreateGPGLink={
                canCreateGPGLink ? handleCreateGPGLink : undefined
              }
            />
          </div>
          <div className={styles.countDisplay}>
            {partnerManager.partnerQuery.isLoading ? (
              "Loading..."
            ) : partnerManager.partnerQuery.isError ? (
              "Error"
            ) : (
              `${partnerManager.partnerQuery.data?.totalCount || 0} partners`
            )}
          </div>
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
        data={sliderData} // ✅ Use the memoized, correctly typed data
        isLoading={
          partnerManager.partnerQuery.isLoading ||
          partnerManager.partnerQuery.isFetching
        }
        isError={partnerManager.partnerQuery.isError}
        error={partnerManager.partnerQuery.error}
        activeItemId={partnerManager.selectedPartnerId}
        onSlideChange={partnerManager.setSelectedPartnerId}
        onItemClick={handleItemClick}
        isItemSelected={(item) => selectedPartnerIdsForDoc.includes(item.id)}
        isLocked={isLocked}
        isMultiSelect={isMultiSelect}
        placeholderMessage={
          isCreating
            ? "Document creation in progress."
            : "No partners match criteria."
        }
        isAccordionOpen={isDetailsAccordionOpen}
        onToggleAccordion={() => toggleAccordion(SLIDER_TYPES.PARTNER)}
        currentFilter={shouldShowFilterColors ? journalSelection.rootFilter[0] : undefined}
      />

      <AddEditPartnerModal
        isOpen={partnerManager.isAddEditPartnerModalOpen}
        onClose={partnerManager.handleCloseAddEditPartnerModal}
        onSubmit={partnerManager.handleAddOrUpdatePartnerSubmit}
        initialData={partnerManager.editingPartnerData}
        isSubmitting={
          partnerManager.createPartnerMutation.isPending ||
          partnerManager.updatePartnerMutation.isPending
        }
        onOpenJournalSelector={onOpenJournalSelector}
      />

      {/* Linking Modals */}
      {partnerJournalLinking.isLinkModalOpen &&
        partnerJournalLinking.partnerForLinking && (
          <LinkPartnerToJournalsModal
            isOpen={partnerJournalLinking.isLinkModalOpen}
            onClose={partnerJournalLinking.closeLinkModal}
            onSubmitLinks={partnerJournalLinking.submitLinks}
            partnerToLink={partnerJournalLinking.partnerForLinking}
            isSubmitting={partnerJournalLinking.isSubmittingLinks}
            onOpenJournalSelector={onOpenJournalSelector}
            fullJournalHierarchy={fullJournalHierarchy}
          />
        )}
      {partnerJournalLinking.isUnlinkModalOpen &&
        partnerJournalLinking.partnerForUnlinking && (
          <UnlinkPartnerFromJournalsModal
            isOpen={partnerJournalLinking.isUnlinkModalOpen}
            onClose={partnerJournalLinking.closeUnlinkModal}
            partner={partnerJournalLinking.partnerForUnlinking}
            onUnlink={partnerJournalLinking.submitUnlink}
            fetchLinksFn={() =>
              getJournalPartnerLinks({
                partnerId: partnerJournalLinking.partnerForUnlinking!.id
              })
            }
            isUnlinking={partnerJournalLinking.isSubmittingUnlink}
          />
        )}
    </>
  );
};
