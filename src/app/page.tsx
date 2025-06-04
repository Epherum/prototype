// src/app/page.tsx
"use client";

// React & Next.js Core
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// Third-party Libraries
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IoOptionsOutline,
  IoAddCircleOutline,
  IoTrashBinOutline,
} from "react-icons/io5";

//Styles
import styles from "./page.module.css";

// Swiper Styles
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

import {
  fetchJournalsLinkedToPartner,
  fetchJournalsLinkedToGood, // Make sure this is imported
} from "@/services/clientJournalService";

// Libs (Helpers, Constants, Types)
import { findNodeById, getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES, ROOT_JOURNAL_ID, INITIAL_ORDER } from "@/lib/constants";
import type {
  AccountNodeData,
  CreateJournalPartnerGoodLinkClientData,
  Journal,
  Partner, // For GPG Link creation callback type hint
  Good, // For GPG Link creation callback type hint
} from "@/lib/types";

// Components
import StickyHeaderControls from "@/components/layout/StickyHeaderControls";
import JournalHierarchySlider from "@/components/sliders/JournalHierarchySlider";
import DynamicSlider from "@/components/sliders/DynamicSlider";
import JournalModal from "@/components/modals/JournalModal";
import AddJournalModal from "@/components/modals/AddJournalModal";
import DocumentConfirmationModal from "@/components/modals/DocumentConfirmationModal";
import PartnerOptionsMenu from "@/components/options/PartnerOptionsMenu";
import AddEditPartnerModal from "@/components/modals/AddEditPartnerModal";
import GoodsOptionsMenu from "@/components/options/GoodsOptionsMenu";
import AddEditGoodModal from "@/components/modals/AddEditGoodModal";
import LinkPartnerToJournalsModal from "@/components/modals/LinkPartnerToJournalsModal";
import UnlinkPartnerFromJournalsModal from "@/components/modals/UnlinkPartnerFromJournalsModal";
import LinkGoodToJournalsModal from "@/components/modals/LinkGoodToJournalsModal";
import UnlinkGoodFromJournalsModal from "@/components/modals/UnlinkGoodFromJournalsModal";
import LinkGoodToPartnersViaJournalModal from "@/components/modals/LinkGoodToPartnersViaJournalModal";
import UnlinkGoodFromPartnersViaJournalModal from "@/components/modals/UnlinkGoodFromPartnersViaJournalModal";

// Custom Hooks
import { useSliderManagement } from "@/hooks/useSliderManagement";
import { useDocumentCreation } from "@/hooks/useDocumentCreation";
import { usePartnerManager } from "@/hooks/usePartnerManager";
import { useGoodJournalLinking } from "@/hooks/useGoodJournalLinking";
import { useGoodManager } from "@/hooks/useGoodManager";
import { usePartnerJournalLinking } from "@/hooks/usePartnerJournalLinking";
import { useJournalPartnerGoodLinking } from "@/hooks/useJournalPartnerGoodLinking";
import { useJournalManager } from "@/hooks/useJournalManager";

// --- Main Page Component ---
export default function Home() {
  // --- Hooks ---
  // 1. Base Custom Hooks (few dependencies on local state here)
  const { sliderOrder, visibility, toggleVisibility, moveSlider } =
    useSliderManagement();

  // 2. Journal Manager - often a primary source of context
  const journalManager = useJournalManager({
    sliderOrder,
    visibility,
  });
  const {
    hierarchyData: journalManagerHierarchyData,
    currentHierarchy: journalManagerCurrentHierarchy,
    isHierarchyLoading: isJournalHierarchyLoading, // alias for clarity
    isHierarchyError: isJournalHierarchyError,
    hierarchyError: journalHierarchyError,
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    effectiveSelectedJournalIds,
    isTerminalJournalActive,
    journalRootFilterStatus,
    selectedFlatJournalId,
    isJournalSliderPrimary,
    // Destructure other needed values from journalManager if used directly before linking hooks
    // e.g., isJournalNavModalOpen, closeJournalNavModal, resetJournalSelections, setSelectedFlatJournalId
    // openJournalNavModal, addJournalContext, createJournal, deleteJournal, setJournalRootFilterStatus
  } = journalManager;

  const documentCreation = useDocumentCreation(); // INSTANTIATE THE HOOK

  // 3. Document Creation Hook (mostly independent or depends on later selections)
  const {
    isDocumentCreationMode,
    lockedPartnerId,
    selectedGoodsForDocument,
    isConfirmationModalOpen,
    handleStartDocumentCreation: hookHandleStartDocumentCreation,
    handleCancelDocumentCreation,
    handleToggleGoodForDocument,
    handleUpdateGoodDetailForDocument,
    handleFinishDocument: hookHandleFinishDocument,
    closeConfirmationModal,
    resetDocumentCreationState,
  } = documentCreation;

  // --- State Declarations (useState) ---
  const [isJournalModalOpenForLinking, setIsJournalModalOpenForLinking] =
    useState(false);
  const [
    onJournalSelectForLinkingCallback,
    setOnJournalSelectForLinkingCallback,
  ] = useState<((node: AccountNodeData) => void) | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    "project-placeholder"
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(
    "document-placeholder"
  );
  const [displayedProjects] = useState([
    { id: "project-placeholder", name: "Sample Project" },
  ]);
  const [displayedDocuments] = useState([
    { id: "document-placeholder", name: "Specification Doc" },
  ]);
  const [accordionTypeState, setAccordionTypeState] = useState({
    [SLIDER_TYPES.JOURNAL]: false,
    [SLIDER_TYPES.PARTNER]: false,
    [SLIDER_TYPES.GOODS]: false,
    [SLIDER_TYPES.PROJECT]: false,
    [SLIDER_TYPES.DOCUMENT]: false,
  });

  const [selectedContextJournalIdForGPG, setSelectedContextJournalIdForGPG] =
    useState<string | null>(null);
  const [isJournalModalOpenForGPGContext, setIsJournalModalOpenForGPGContext] =
    useState(false);

  // --- Derived State for G-P-G Configuration ---
  const isGPStartOrder = useMemo(() => {
    const visibleSliders = sliderOrder.filter((id) => visibility[id]);
    return (
      visibleSliders.length >= 2 &&
      visibleSliders[0] === SLIDER_TYPES.GOODS &&
      visibleSliders[1] === SLIDER_TYPES.PARTNER
      // No longer checking visibility[SLIDER_TYPES.GOODS] etc. here as visibleSliders already filters
    );
  }, [sliderOrder, visibility]);

  // --- Refs ---
  const visibilitySwiperRef = useRef<any>(null);
  const ROOT_JOURNAL_ID_FOR_MODAL = "__MODAL_ROOT_NODE__";

  // --- Derived State (useMemo for slider order conditions) ---
  const isJournalSecondAfterPartner = useMemo(
    () =>
      sliderOrder.indexOf(SLIDER_TYPES.PARTNER) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1,
    [sliderOrder]
  );

  const isJournalSecondAfterGood = useMemo(
    () =>
      sliderOrder.indexOf(SLIDER_TYPES.GOODS) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1,
    [sliderOrder]
  );

  // --- Manager Hooks & Dependent Queries ---

  // 1. Initialize both managers with null/default for cross-dependent props
  const goodManager = useGoodManager({
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds: journalManager.effectiveSelectedJournalIds,
    selectedPartnerId: null, // Will update after partnerManager is initialized
    selectedJournalIdForPjgFiltering:
      journalManager.isJournalSliderPrimary === false &&
      sliderOrder.indexOf(SLIDER_TYPES.PARTNER) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1
        ? journalManager.selectedFlatJournalId
        : null,
    journalRootFilterStatus: journalManager.journalRootFilterStatus,
    isJournalHierarchyLoading: journalManager.isHierarchyLoading,
    isPartnerQueryLoading: false, // Will update after partnerManager is initialized
    isFlatJournalsQueryLoading: false, // Will update after flatJournalsQuery is declared
    isGPContextActive: isGPStartOrder,
    gpgContextJournalId: selectedContextJournalIdForGPG,
  });

  const partnerManager = usePartnerManager({
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds: journalManager.effectiveSelectedJournalIds,
    selectedGoodsId: null, // Will update after goodManager is initialized
    selectedJournalIdForGjpFiltering:
      journalManager.isJournalSliderPrimary === false &&
      sliderOrder.indexOf(SLIDER_TYPES.GOODS) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1
        ? journalManager.selectedFlatJournalId
        : null,
    journalRootFilterStatus: journalManager.journalRootFilterStatus,
    isJournalHierarchyLoading: journalManager.isHierarchyLoading,
    isFlatJournalsQueryForGoodLoading: false, // Will update after flatJournalsQueryForGood is declared
    isGPGOrderActive: isGPStartOrder,
    gpgContextJournalId: selectedContextJournalIdForGPG,
  });

  // 2. Now declare the queries
  const flatJournalsQueryForGood = useQuery<Journal[], Error>({
    queryKey: ["flatJournalsFilteredByGood", goodManager.selectedGoodsId],
    queryFn: async () =>
      !goodManager.selectedGoodsId
        ? []
        : fetchJournalsLinkedToGood(goodManager.selectedGoodsId),
    enabled:
      visibility[SLIDER_TYPES.JOURNAL] &&
      sliderOrder.indexOf(SLIDER_TYPES.GOODS) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1 &&
      !!goodManager.selectedGoodsId,
  });

  const flatJournalsQuery = useQuery<Journal[], Error>({
    queryKey: [
      "flatJournalsFilteredByPartner",
      partnerManager.selectedPartnerId,
    ],
    queryFn: async () =>
      !partnerManager.selectedPartnerId
        ? []
        : fetchJournalsLinkedToPartner(partnerManager.selectedPartnerId),
    enabled:
      visibility[SLIDER_TYPES.JOURNAL] &&
      sliderOrder.indexOf(SLIDER_TYPES.PARTNER) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1 &&
      !!partnerManager.selectedPartnerId,
  });

  // --- Callbacks & Dependent Hooks ---

  // --- Callbacks for G-P-G Contextual Journal ---
  const handleOpenJournalModalForGPGContext = useCallback(() => {
    if (journalManager.isJournalNavModalOpen)
      journalManager.closeJournalNavModal();
    if (isJournalModalOpenForLinking) {
      setIsJournalModalOpenForLinking(false);
      setOnJournalSelectForLinkingCallback(null);
    }
    setIsJournalModalOpenForGPGContext(true);
  }, [
    journalManager.isJournalNavModalOpen,
    journalManager.closeJournalNavModal,
    isJournalModalOpenForLinking,
  ]);

  const handleGPGContextJournalSelected = useCallback(
    (node: AccountNodeData) => {
      if (node && !node.isConceptualRoot && node.id !== ROOT_JOURNAL_ID) {
        setSelectedContextJournalIdForGPG(node.id);
        if (isGPStartOrder) {
          partnerManager.setSelectedPartnerId(null);
        }
      } else {
        alert(
          "Please select a specific journal account for the G-P-G context."
        );
      }
      setIsJournalModalOpenForGPGContext(false);
    },
    [partnerManager, isGPStartOrder, ROOT_JOURNAL_ID] // Added ROOT_JOURNAL_ID from outer scope
  );

  const handleClearGPGContextJournal = useCallback(() => {
    setSelectedContextJournalIdForGPG(null);
    if (isGPStartOrder) {
      partnerManager.setSelectedPartnerId(null);
    }
  }, [partnerManager, isGPStartOrder]);

  const openJournalSelectorForLinking = useCallback(
    (onSelectCallback: (journalNode: AccountNodeData) => void) => {
      setOnJournalSelectForLinkingCallback(() => onSelectCallback);
      setIsJournalModalOpenForLinking(true);
      if (journalManager.isJournalNavModalOpen) {
        // FROM HOOK
        journalManager.closeJournalNavModal(); // FROM HOOK
      }
    },
    [journalManager.isJournalNavModalOpen, journalManager.closeJournalNavModal]
  );

  const goodJournalLinking = useGoodJournalLinking({
    selectedGoodsId: goodManager.selectedGoodsId,
    goodsData: goodManager.goodsQueryState.data,
    onOpenJournalSelector: openJournalSelectorForLinking,
  });

  const partnerJournalLinking = usePartnerJournalLinking({
    selectedPartnerId: partnerManager.selectedPartnerId,
    partnerData: partnerManager.partnersForSlider, // Use data from partnerManager
    onOpenJournalSelector: openJournalSelectorForLinking,
    // partnerQueryKeyParamsStructure: partnerManager.partnerQueryKeyParamsStructure, // If hook needed it for invalidation
  });

  // --- Linking Hooks (jpqlLinking will be used for GPG link creation) ---
  const jpqlLinking = useJournalPartnerGoodLinking({
    selectedGoodsId: goodManager.selectedGoodsId, // Good from GPG S1 or other contexts
    goodsData: goodManager.goodsQueryState.data, // Use the reactive data from goodManager
    effectiveSelectedJournalIds: journalManager.effectiveSelectedJournalIds,
    selectedJournalIdForPjgFiltering: journalManager.selectedFlatJournalId,
    currentHierarchy: journalManager.currentHierarchy,
    sliderOrder,
  });

  const canUnlinkGoodFromPartnersViaJournal = useMemo(() => {
    const journalSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const goodSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);
    const partnerSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);

    let journalContextAvailable = false;

    if (journalManager.isJournalSliderPrimary) {
      // Journal is primary (J-G-P or J-P-G)
      // A specific journal from the hierarchy must be effectively selected.
      journalContextAvailable =
        journalManager.effectiveSelectedJournalIds.length > 0;
    } else {
      // Journal is secondary. Check for P-J-G or G-J-P scenarios.
      const isPJG =
        partnerSliderIndex === 0 &&
        journalSliderIndex === 1 &&
        goodSliderIndex === 2;
      // For unlinking, G-J-P (Good first, then Journal, then Partner) might also be a valid scenario
      // where you want to unlink a Good from Partners relative to a specific flat Journal.
      const isGJP =
        goodSliderIndex === 0 &&
        journalSliderIndex === 1 &&
        partnerSliderIndex > 1; // partnerSliderIndex > 1 ensures Partner is after Journal

      if (isPJG || isGJP) {
        journalContextAvailable = !!journalManager.selectedFlatJournalId;
      }
    }

    return (
      visibility[SLIDER_TYPES.GOODS] && // Goods slider must be visible
      goodSliderIndex !== -1 && // Goods slider must exist in the order
      // goodSliderIndex > 0 && // This condition might be too restrictive if we consider J-G for unlinking
      journalContextAvailable && // A valid journal context must exist
      !!goodManager.selectedGoodsId // A good must be selected
    );
  }, [
    sliderOrder,
    visibility,
    journalManager.isJournalSliderPrimary,
    journalManager.effectiveSelectedJournalIds,
    journalManager.selectedFlatJournalId,
    goodManager.selectedGoodsId,
    // No need for journalSliderIndex, goodSliderIndex, partnerSliderIndex in deps
    // as they are derived from sliderOrder which is a dependency.
  ]);

  // --- Effects (useEffect) ---
  // useEffect for goodManager.selectedGoodsId auto-selection
  useEffect(() => {
    // Use goodManager.goodsQueryState which reflects the currently active data source
    if (
      !goodManager.goodsQueryState.isLoading &&
      !goodManager.goodsQueryState.isFetching &&
      !goodManager.goodsQueryState.isError &&
      goodManager.goodsQueryState.data
    ) {
      const fetchedGoods = goodManager.goodsQueryState.data;
      const currentSelectionInList =
        goodManager.selectedGoodsId &&
        fetchedGoods.some((g) => g.id === goodManager.selectedGoodsId);

      // This logic primarily applies when the goodManager is NOT serving GPG Slider 3,
      // as GPG Slider 3 is display-only for selection managed by this hook.
      // The useGoodManager internal useEffect already handles this distinction for setSelectedGoodsId.
      if (fetchedGoods.length > 0 && !currentSelectionInList) {
        // Only auto-select if not GPG Slider 3 (internal useEffect in useGoodManager handles this part better)
        // For safety, let's ensure the hook's own logic for selectedGoodsId is primary.
        // This useEffect in page.tsx can be simplified or removed if the hook is robust enough.
        // For now, let's ensure it uses the correct state object.
        // if (sliderOrder.indexOf(SLIDER_TYPES.GOODS) !== 2 || !isGPGOrder) {
        //   goodManager.setSelectedGoodsId(getFirstId(fetchedGoods));
        // }
      } else if (
        fetchedGoods.length === 0 &&
        goodManager.selectedGoodsId !== null
      ) {
        // if (sliderOrder.indexOf(SLIDER_TYPES.GOODS) !== 2 || !isGPGOrder) {
        //   goodManager.setSelectedGoodsId(null);
        // }
      }
    } else if (
      !goodManager.goodsQueryState.isLoading &&
      !goodManager.goodsQueryState.isFetching &&
      !goodManager.goodsQueryState.isError &&
      goodManager.selectedGoodsId !== null
    ) {
      // if (sliderOrder.indexOf(SLIDER_TYPES.GOODS) !== 2 || !isGPGOrder) {
      //   goodManager.setSelectedGoodsId(null);
      // }
    }
    // The primary responsibility for setting selectedGoodsId based on its data
    // should reside within useGoodManager's own useEffect.
    // This useEffect in page.tsx might become redundant or simplified to only react
    // if absolutely necessary for page-level coordination not handled by the hook.
    // For now, let's ensure it uses the correct state object.
  }, [
    goodManager.goodsQueryState.data, // Use .data from the state object
    goodManager.goodsQueryState.isLoading,
    goodManager.goodsQueryState.isFetching,
    goodManager.goodsQueryState.isError,
    goodManager.selectedGoodsId,
    // goodManager.setSelectedGoodsId, // setSelectedGoodsId is stable, not needed in deps if hook handles itself
    // sliderOrder, isGPGOrder // If the conditional logic inside is re-enabled
  ]);

  useEffect(() => {
    if (visibilitySwiperRef.current) visibilitySwiperRef.current?.update();
  }, [sliderOrder, visibility]);

  // Reset GPG context journal if slider order changes away from GPG
  useEffect(() => {
    if (!isGPStartOrder && selectedContextJournalIdForGPG !== null) {
      setSelectedContextJournalIdForGPG(null);
    }
  }, [isGPStartOrder, selectedContextJournalIdForGPG]);

  // Stable references (assuming hooks provide them via useCallback for setters/actions)
  const { resetJournalSelections } = journalManager;
  const { setSelectedPartnerId } = partnerManager;
  const { setSelectedGoodsId } = goodManager;
  // For selectedContextJournalIdForGPG, the setter is directly from useState, so it's stable.

  useEffect(() => {
    // Effect to reset selections when the main slider order changes
    console.log(
      "EFFECT: Slider order changed to:",
      sliderOrder.join("-"),
      ". Resetting dependent entity selections."
    );
    resetJournalSelections(); // Call stable function
    setSelectedPartnerId(null); // Call stable function
    setSelectedGoodsId(null); // Call stable function
  }, [
    sliderOrder,
    resetJournalSelections,
    setSelectedPartnerId,
    setSelectedGoodsId,
  ]); // List sliderOrder and the stable functions

  // Separate effect for GPG context reset based on isGPStartOrder change OR when sliderOrder itself changes
  useEffect(() => {
    if (!isGPStartOrder && selectedContextJournalIdForGPG !== null) {
      console.log(
        "EFFECT: GPStartOrder is false OR sliderOrder changed; clearing GP context journal if set."
      );
      setSelectedContextJournalIdForGPG(null);
    }
  }, [isGPStartOrder, sliderOrder, selectedContextJournalIdForGPG]); // Add setSelectedContextJournalIdForGPG if ESLint demands, but it's stable

  useEffect(() => {
    // PJG: Partner selected, reset flat journal for PJG if applicable
    if (isJournalSecondAfterPartner) {
      journalManager.setSelectedFlatJournalId(null); // NEW - If partner changes, selected PJG journal invalidates
    }
  }, [
    partnerManager.selectedPartnerId,
    isJournalSecondAfterPartner,
    journalManager.setSelectedFlatJournalId,
  ]);

  useEffect(() => {
    // Cascade reset based on flat journal selection
    if (isJournalSecondAfterPartner) {
      // P-J-G: Flat Journal selected/deselected
      goodManager.setSelectedGoodsId(null); // Reset goods
    } else if (isJournalSecondAfterGood) {
      // G-J-P: Flat Journal selected/deselected
      partnerManager.setSelectedPartnerId(null); // Reset partners
    }
  }, [
    journalManager.selectedFlatJournalId,
    isJournalSecondAfterPartner,
    isJournalSecondAfterGood,
    partnerManager.setSelectedPartnerId,
    goodManager.setSelectedGoodsId,
  ]); // NEW

  useEffect(() => {
    // GJP: Good selected, reset flat journal for GJP if applicable
    if (isJournalSecondAfterGood) {
      journalManager.setSelectedFlatJournalId(null); // NEW
    }
  }, [
    goodManager.selectedGoodsId,
    isJournalSecondAfterGood,
    journalManager.setSelectedFlatJournalId,
  ]);

  useEffect(() => {
    // Journal Primary: Root filter or hierarchical selection changed
    // This effect now listens to values from journalManager
    const journalSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
    if (journalSliderIndex === 0) {
      // If Journal is primary
      partnerManager.setSelectedPartnerId(null);
      goodManager.setSelectedGoodsId(null);
    }
  }, [
    journalManager.journalRootFilterStatus,
    journalManager.effectiveSelectedJournalIds,
    sliderOrder,
    partnerManager.setSelectedPartnerId,
    goodManager.setSelectedGoodsId,
  ]); // NEW

  // Reset GPG context journal if slider order changes away from GPG
  useEffect(() => {
    if (!isGPStartOrder) {
      if (selectedContextJournalIdForGPG !== null) {
        // only if it was set
        setSelectedContextJournalIdForGPG(null);
      }
    }
  }, [isGPStartOrder, selectedContextJournalIdForGPG]);

  // Reset selections in G-P context sliders if context journal is cleared OR GPStartOrder becomes false
  useEffect(() => {
    if (isGPStartOrder && selectedContextJournalIdForGPG === null) {
      partnerManager.setSelectedPartnerId(null);
    }
  }, [
    isGPStartOrder,
    selectedContextJournalIdForGPG,
    partnerManager.setSelectedPartnerId,
  ]);

  // G-P-G Link Creation Handler (conceptually still G-P via Journal link)
  const handleCreateGPGLink = useCallback(() => {
    if (!isGPStartOrder) {
      alert("Link creation requires Goods - Partner order.");
      return;
    }
    if (!selectedContextJournalIdForGPG) {
      alert("G-P Link: Context journal not selected.");
      return;
    }
    if (!goodManager.selectedGoodsId) {
      alert("G-P Link: Good from first slider not selected.");
      return;
    }
    if (!partnerManager.selectedPartnerId) {
      alert("G-P Link: Partner from second slider not selected.");
      return;
    }
    const linkData: CreateJournalPartnerGoodLinkClientData = {
      journalId: selectedContextJournalIdForGPG,
      partnerId: partnerManager.selectedPartnerId,
      goodId: goodManager.selectedGoodsId,
      // partnershipType: "GP_CONTEXT_LINK", // Optional: specific type
    };
    jpqlLinking.createSimpleJPGLHandler(linkData);
  }, [
    isGPStartOrder,
    selectedContextJournalIdForGPG,
    goodManager.selectedGoodsId,
    partnerManager.selectedPartnerId,
    jpqlLinking.createSimpleJPGLHandler,
  ]);

  // Journal CRUD
  const handleAddJournalSubmit = useCallback(
    (formDataFromModal: Omit<AccountNodeData, "children">) => {
      journalManager.createJournal(formDataFromModal); // NEW
      // Alerts for success/error can be handled by useEffects watching journalManager.createJournalMutation.isSuccess/isError if needed
      // For now, assuming alerts are handled by components or not at all from page.tsx for this.
      // Example: if (journalManager.createJournalMutation.isSuccess) { alert(...) } // but this is reactive, not on submit directly
    },
    [journalManager.createJournal, journalManager.addJournalContext] // NEW (addJournalContext is for reference if createJournal needs it internally, but it's passed to openAddJournalModal)
  );

  const handleDeleteJournalAccount = useCallback(
    (accountIdToDelete: string) => {
      if (
        window.confirm(
          `Are you sure you want to delete journal ${accountIdToDelete}? This cannot be undone.`
        )
      ) {
        journalManager.deleteJournal(accountIdToDelete); // NEW
      }
    },
    [journalManager.deleteJournal] // NEW
  );

  // Callback for Journal Root Filter Change
  const handleJournalRootFilterChange = useCallback(
    // Becomes simpler
    journalManager.setJournalRootFilterStatus,
    [journalManager.setJournalRootFilterStatus]
  );

  const handleOpenJournalModalForNavigation = useCallback(() => {
    setIsJournalModalOpenForLinking(false);
    setOnJournalSelectForLinkingCallback(null);
    journalManager.openJournalNavModal(); // NEW
  }, [journalManager.openJournalNavModal]); // NEW

  // This is the callback passed TO JournalModal, called by IT when a journal is chosen for linking
  const handleJournalNodeSelectedForLinking = useCallback(
    (selectedNode: AccountNodeData) => {
      if (onJournalSelectForLinkingCallback) {
        onJournalSelectForLinkingCallback(selectedNode);
      }
      // Modal remains open for multi-selection in linking mode.
    },
    [onJournalSelectForLinkingCallback]
  );

  const handleLinkGoodToActiveJournalAndPartner = useCallback(() => {
    // Determine the targetJournalId from effectiveSelectedJournalIds
    // This logic might need refinement based on your UI/UX for selecting THE journal.
    // For now, picking the first one if available.
    // CRITICAL: Ensure this journalId is appropriate (e.g., a terminal account if that's a rule)
    const targetJournalId =
      journalManager.effectiveSelectedJournalIds.length > 0
        ? journalManager.effectiveSelectedJournalIds[0]
        : null;

    if (!targetJournalId) {
      alert("No active journal selected or journal selection is ambiguous.");
      return;
    }
    if (!partnerManager.selectedPartnerId) {
      alert("No partner selected.");
      return;
    }
    if (!goodManager.selectedGoodsId) {
      // This shouldn't happen if called from GoodsOptionsMenu context, but good check.
      alert("No good selected.");
      return;
    }

    const linkDataForSimpleButton: import("@/lib/types").CreateJournalPartnerGoodLinkClientData =
      {
        // Use imported type
        journalId: targetJournalId,
        partnerId: partnerManager.selectedPartnerId,
        goodId: goodManager.selectedGoodsId,
        partnershipType: "STANDARD_TRANSACTION",
      };
    jpqlLinking.createSimpleJPGLHandler(linkDataForSimpleButton);
  }, [
    effectiveSelectedJournalIds,
    partnerManager.selectedPartnerId,
    goodManager.selectedGoodsId,
    jpqlLinking.createSimpleJPGLHandler,
  ]);

  const isJAndPSelectedForJPGL = useMemo(() => {
    return (
      journalManager.effectiveSelectedJournalIds.length > 0 &&
      !!partnerManager.selectedPartnerId // NEW
    );
  }, [
    journalManager.effectiveSelectedJournalIds,
    partnerManager.selectedPartnerId,
  ]); // NEW

  const canLinkGoodToPartnersViaJournal = useMemo(() => {
    const journalIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const goodsIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);

    return (
      visibility[SLIDER_TYPES.JOURNAL] &&
      visibility[SLIDER_TYPES.GOODS] &&
      journalIndex === 0 && // Journal is first
      goodsIndex === 1 && // Goods is second
      journalManager.effectiveSelectedJournalIds.length > 0 && // A journal context exists
      !!goodManager.selectedGoodsId // A good is selected
    );
  }, [
    sliderOrder,
    visibility,
    journalManager.effectiveSelectedJournalIds,
    goodManager.selectedGoodsId,
  ]);

  // Document Creation Wrappers
  const handleStartDocumentCreation = useCallback(() => {
    const callbackToOpenGoodsAccordion = () => {
      setAccordionTypeState((prev) => ({
        ...Object.keys(prev).reduce(
          (acc, key) => ({ ...acc, [key]: false }),
          {}
        ),
        [SLIDER_TYPES.GOODS]: true,
      }));
    };
    if (!partnerManager.selectedPartnerId) {
      alert("Please select a partner first.");
      return;
    }
    hookHandleStartDocumentCreation(
      partnerManager.selectedPartnerId,
      callbackToOpenGoodsAccordion
    );
  }, [partnerManager.selectedPartnerId, hookHandleStartDocumentCreation]);

  const handleFinishDocument = useCallback(() => {
    const success = hookHandleFinishDocument();
    if (!success && selectedGoodsForDocument.length === 0) {
      alert("Please select at least one good for the document.");
    } else if (!success && !lockedPartnerId) {
      alert("Error: No partner locked. Please restart.");
    }
  }, [hookHandleFinishDocument, selectedGoodsForDocument, lockedPartnerId]);

  const handleValidateDocument = useCallback(() => {
    const partnerDetails = partnerManager.partnerQuery.data?.find(
      (p) => p.id === lockedPartnerId
    );
    console.log("--- DOCUMENT VALIDATED (SIMULATED) ---");
    console.log(
      "Journal Context (L1, L2, L3):",
      selectedTopLevelJournalId,
      selectedLevel2JournalIds,
      selectedLevel3JournalIds
    );
    console.log("Partner:", partnerDetails);
    console.log("Goods for Document:", selectedGoodsForDocument);
    console.log("--------------------------");
    resetDocumentCreationState();
  }, [
    partnerManager.partnerQuery.data,
    lockedPartnerId,
    selectedGoodsForDocument,
    journalManager.selectedTopLevelJournalId,
    journalManager.selectedLevel2JournalIds,
    journalManager.selectedLevel3JournalIds,
    resetDocumentCreationState,
  ]);

  // General UI Callbacks
  const handleSwipe = useCallback(
    (sourceSliderId: string, selectedItemId: string | null) => {
      if (
        isDocumentCreationMode &&
        sourceSliderId === SLIDER_TYPES.PARTNER &&
        selectedItemId !== lockedPartnerId
      ) {
        partnerManager.setSelectedPartnerId(lockedPartnerId);
        return;
      }
      if (sourceSliderId === SLIDER_TYPES.PARTNER)
        partnerManager.setSelectedPartnerId(selectedItemId);
      else if (sourceSliderId === SLIDER_TYPES.GOODS)
        goodManager.setSelectedGoodsId(selectedItemId);
      else if (sourceSliderId === SLIDER_TYPES.PROJECT)
        setSelectedProjectId(selectedItemId as string);
      else if (sourceSliderId === SLIDER_TYPES.DOCUMENT)
        setSelectedDocumentId(selectedItemId as string);
    },
    [
      isDocumentCreationMode,
      lockedPartnerId,
      partnerManager.setSelectedPartnerId,
      goodManager.setSelectedGoodsId,
    ]
  ); // sliderOrder removed, useEffects handle cascades based on selections

  const toggleAccordion = useCallback((sliderType: string) => {
    if (!sliderType || !Object.values(SLIDER_TYPES).includes(sliderType as any))
      return;
    setAccordionTypeState((prev) => ({
      ...prev,
      [sliderType]: !prev[sliderType],
    }));
  }, []);

  // --- Slider Configuration (Ref) ---
  const SLIDER_CONFIG_REF = useRef({
    [SLIDER_TYPES.JOURNAL]: {
      Component: JournalHierarchySlider,
      title: "Journal",
    },
    [SLIDER_TYPES.PARTNER]: { Component: DynamicSlider, title: "Partner" },
    [SLIDER_TYPES.GOODS]: { Component: DynamicSlider, title: "Goods" },
    [SLIDER_TYPES.PROJECT]: {
      Component: DynamicSlider,
      title: "Project (Future)",
    },
    [SLIDER_TYPES.DOCUMENT]: {
      Component: DynamicSlider,
      title: "Document (Future)",
    },
  });

  // --- Function to Get Props for Sliders ---
  const getSliderProps = useCallback(
    (sliderId: string, sliderIndexInOrder: number) => {
      const visibleSliders = sliderOrder.filter((id) => visibility[id]);
      const myVisibleIndex = visibleSliders.indexOf(sliderId);

      switch (sliderId) {
        case SLIDER_TYPES.JOURNAL:
          if (!journalManager.isJournalSliderPrimary) {
            // Flat list mode
            const isPJ =
              visibleSliders.length > 1 && // Ensure there's a second item
              visibleSliders[0] === SLIDER_TYPES.PARTNER &&
              myVisibleIndex === 1;
            const isGJ =
              visibleSliders.length > 1 && // Ensure there's a second item
              visibleSliders[0] === SLIDER_TYPES.GOODS &&
              myVisibleIndex === 1;

            const isGPJ_Context = isGPStartOrder && myVisibleIndex === 2;

            let queryToUse:
              | typeof flatJournalsQuery
              | typeof flatJournalsQueryForGood
              | null = null;

            if (isPJ) queryToUse = flatJournalsQuery;
            else if (isGJ) queryToUse = flatJournalsQueryForGood;
            else if (isGPJ_Context) {
              return {
                _isFlatJournalMode: true,
                data: [],
                isLoading: false,
                isError: false,
                error: null,
                activeItemId: null,
                onSlideChange: () => {},
                placeholderMessage:
                  "Journal details are not shown in G-P-J sequence.",
                isAccordionOpen: accordionTypeState[SLIDER_TYPES.JOURNAL],
                onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.JOURNAL),
                onOpenModal: journalManager.openJournalNavModal,
              };
            }

            if (queryToUse) {
              return {
                _isFlatJournalMode: true,
                data: (queryToUse.data || []).map((j) => ({
                  id: String(j.id),
                  name: j.name,
                  code: String(j.id),
                })),
                isLoading: queryToUse.isLoading,
                isError: queryToUse.isError,
                error: queryToUse.error,
                activeItemId: journalManager.selectedFlatJournalId,
                onSlideChange: journalManager.setSelectedFlatJournalId,
                isAccordionOpen: accordionTypeState[SLIDER_TYPES.JOURNAL],
                onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.JOURNAL),
                onOpenModal: journalManager.openJournalNavModal,
              };
            }
            // Fallback for unhandled secondary journal:
            // This means it's not P-J, not G-J, and not G-P-J.
            // It could be a standalone secondary journal if other primary sliders are hidden,
            // or an unsupported sequence.
            console.warn(
              `getSliderProps: Journal is secondary but no defined data source. Order: ${sliderOrder.join(
                "-"
              )}, Visible Index: ${myVisibleIndex}`
            );
            return {
              _isFlatJournalMode: true,
              data: [],
              isLoading: false,
              isError: false,
              activeItemId: null,
              onSlideChange: () => {},
              placeholderMessage: "No data source for this journal view.",
              isAccordionOpen: accordionTypeState[SLIDER_TYPES.JOURNAL],
              onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.JOURNAL),
              onOpenModal: journalManager.openJournalNavModal,
            };
          } else if (journalManager.isJournalSliderPrimary) {
            // Hierarchical
            return {
              _isFlatJournalMode: false,
              hierarchyData: journalManager.currentHierarchy,
              fullHierarchyData: journalManager.hierarchyData,
              isLoading: journalManager.isHierarchyLoading,
              isError: journalManager.isHierarchyError,
              error: journalManager.hierarchyError,
              selectedTopLevelId: journalManager.selectedTopLevelJournalId,
              selectedLevel2Ids: journalManager.selectedLevel2JournalIds || [],
              selectedLevel3Ids: journalManager.selectedLevel3JournalIds || [],
              onSelectTopLevel: journalManager.handleSelectTopLevelJournal, // Pass reference directly
              onToggleLevel2Id: journalManager.handleToggleLevel2JournalId,
              onToggleLevel3Id: journalManager.handleToggleLevel3JournalId,
              onL2DoubleClick: journalManager.handleL2DoubleClick,
              onL3DoubleClick: journalManager.handleL3DoubleClick,
              onNavigateContextDown: journalManager.handleNavigateContextDown,
              rootJournalIdConst: ROOT_JOURNAL_ID,
              onOpenModal: journalManager.openJournalNavModal,
              isRootView:
                journalManager.selectedTopLevelJournalId === ROOT_JOURNAL_ID,
              currentFilterStatus: journalManager.journalRootFilterStatus,
              onFilterStatusChange: journalManager.setJournalRootFilterStatus,
            };
          }
        case SLIDER_TYPES.PARTNER:
          return {
            data: (partnerManager.partnersForSlider || []).map((p) => ({
              ...p,
              id: String(p.id),
              name: p.name,
              code: String(p.registrationNumber || p.id),
            })),
            isLoading: partnerManager.partnerQuery.isLoading,
            isError: partnerManager.partnerQuery.isError,
            error: partnerManager.partnerQuery.error,
            activeItemId: partnerManager.selectedPartnerId,
            onSlideChange: (id: string | null) =>
              partnerManager.setSelectedPartnerId(id), // Simpler direct call
            isAccordionOpen: accordionTypeState[SLIDER_TYPES.PARTNER],
            onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.PARTNER),
            isLocked:
              documentCreation.isDocumentCreationMode &&
              documentCreation.lockedPartnerId !== null,
            isDocumentCreationMode: documentCreation.isDocumentCreationMode,
            onOpenModal: partnerManager.handleOpenPartnerOptionsMenu,
          };

        case SLIDER_TYPES.GOODS:
          const isThisGoodsSliderFirstInGPContext =
            isGPStartOrder && myVisibleIndex === 0;
          let gpgContextJournalName: string | undefined = undefined;

          if (
            isThisGoodsSliderFirstInGPContext &&
            selectedContextJournalIdForGPG &&
            journalManager.hierarchyData.length > 0
          ) {
            const foundJournal = findNodeById(
              journalManager.hierarchyData,
              selectedContextJournalIdForGPG
            );
            gpgContextJournalName = foundJournal?.name;
          }

          return {
            data: (goodManager.goodsQueryState.data || []).map((g: any) => ({
              // Use goodManager.goodsQueryState directly
              ...g,
              id: String(g.id),
              name: g.label,
              code: g.referenceCode || String(g.id),
              unit_code: g.unitOfMeasure?.code || (g as any).unit || "N/A",
            })),
            isLoading: goodManager.goodsQueryState.isLoading,
            isError: goodManager.goodsQueryState.isError,
            error: goodManager.goodsQueryState.error,
            activeItemId: goodManager.selectedGoodsId,
            onSlideChange: (id: string | null) =>
              goodManager.setSelectedGoodsId(id),
            isAccordionOpen: accordionTypeState[SLIDER_TYPES.GOODS],
            onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.GOODS),
            isDocumentCreationMode: documentCreation.isDocumentCreationMode,
            selectedGoodsForDoc: documentCreation.selectedGoodsForDocument, // Pass directly
            onToggleGoodForDoc: documentCreation.handleToggleGoodForDocument,
            onUpdateGoodDetailForDoc:
              documentCreation.handleUpdateGoodDetailForDocument,
            onOpenModal: goodManager.handleOpenGoodsOptionsMenu,
            showContextJournalFilterButton:
              isThisGoodsSliderFirstInGPContext &&
              !selectedContextJournalIdForGPG,
            onOpenContextJournalFilterModal: isThisGoodsSliderFirstInGPContext
              ? handleOpenJournalModalForGPGContext
              : undefined,
            gpgContextJournalInfo:
              isThisGoodsSliderFirstInGPContext &&
              selectedContextJournalIdForGPG
                ? {
                    id: selectedContextJournalIdForGPG,
                    name: gpgContextJournalName,
                    onClear: handleClearGPGContextJournal,
                  }
                : undefined,
          };
        // ... (SLIDER_TYPES.PROJECT, SLIDER_TYPES.DOCUMENT, default cases)
        // Ensure they also return all common props DynamicSlider might expect, like isAccordionOpen, onToggleAccordion
        case SLIDER_TYPES.PROJECT:
          return {
            data: displayedProjects,
            activeItemId: selectedProjectId,
            onSlideChange: (id: string | null) =>
              setSelectedProjectId(id as string), // Simpler
            isAccordionOpen: accordionTypeState[SLIDER_TYPES.PROJECT],
            onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.PROJECT),
            isLoading: false,
            isError: false,
            error: null,
          };
        case SLIDER_TYPES.DOCUMENT:
          return {
            data: displayedDocuments,
            activeItemId: selectedDocumentId,
            onSlideChange: (id: string | null) =>
              setSelectedDocumentId(id as string), // Simpler
            isAccordionOpen: accordionTypeState[SLIDER_TYPES.DOCUMENT],
            onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.DOCUMENT),
            isLoading: false,
            isError: false,
            error: null,
          };
        default:
          console.warn(`getSliderProps: Unknown sliderId: ${sliderId}`);
          return {
            data: [],
            activeItemId: null,
            isAccordionOpen: false,
            onToggleAccordion: () => {},
            isLoading: false,
            isError: false,
            error: null,
          };
      }
    },
    [
      [
        sliderOrder,
        visibility,
        isGPStartOrder,
        selectedContextJournalIdForGPG, // This is key for the button's visibility
        journalManager.hierarchyData, // Used for gpgContextJournalName
        goodManager.goodsQueryState, // Data source
        goodManager.selectedGoodsId, // Active item
        goodManager.setSelectedGoodsId, // Handler
        goodManager.handleOpenGoodsOptionsMenu, // Handler
        accordionTypeState, // UI state
        toggleAccordion, // UI handler
        documentCreation.isDocumentCreationMode,
        documentCreation.selectedGoodsForDocument,
        documentCreation.handleToggleGoodForDocument,
        documentCreation.handleUpdateGoodDetailForDocument,
        handleOpenJournalModalForGPGContext,
        handleClearGPGContextJournal,
        // Added ROOT_JOURNAL_ID and flat queries from previous diff, check if still needed for THIS specific case
        // For *just* the GOODS case, they might not be, but they are for the whole getSliderProps
        ROOT_JOURNAL_ID,
        flatJournalsQuery,
        flatJournalsQueryForGood,
        journalManager.selectedFlatJournalId,
        journalManager.setSelectedFlatJournalId,
        journalManager.openJournalNavModal,
        journalManager.isJournalSliderPrimary,
        // journalManager props for hierarchical view
        journalManager.currentHierarchy,
        journalManager.isHierarchyLoading,
        journalManager.isHierarchyError,
        journalManager.hierarchyError,
        journalManager.selectedTopLevelJournalId,
        journalManager.selectedLevel2JournalIds,
        journalManager.selectedLevel3JournalIds,
        journalManager.handleSelectTopLevelJournal,
        journalManager.handleToggleLevel2JournalId,
        journalManager.handleToggleLevel3JournalId,
        journalManager.handleL2DoubleClick,
        journalManager.handleL3DoubleClick,
        journalManager.handleNavigateContextDown,
        journalManager.journalRootFilterStatus,
        journalManager.setJournalRootFilterStatus,
        // partnerManager props for PARTNER case
        partnerManager.partnersForSlider,
        partnerManager.partnerQuery,
        partnerManager.selectedPartnerId,
        partnerManager.setSelectedPartnerId,
        partnerManager.handleOpenPartnerOptionsMenu,
      ],
    ]
  );
  // --- Component JSX ---
  // For brevity, console logs are removed from render, but can be added for debugging
  // console.log("HOME RENDER - L1:",selectedTopLevelJournalId, "L2s:", selectedLevel2JournalIds, /* ... */);

  return (
    <div className={styles.pageContainer}>
      <h1 className={styles.title}>ERP Application Interface</h1>
      <StickyHeaderControls
        visibility={visibility}
        onToggleVisibility={toggleVisibility}
        sliderOrder={sliderOrder}
        initialSliderOrder={INITIAL_ORDER}
        sliderConfigs={SLIDER_CONFIG_REF.current}
        onVisibilitySwiper={(swiper) => {
          visibilitySwiperRef.current = swiper;
        }}
      />
      <LayoutGroup id="main-sliders-layout-group">
        <div className={styles.slidersArea}>
          <AnimatePresence initial={false}>
            {sliderOrder.map((sliderId, index) => {
              // Pass 'index' from map
              if (!visibility[sliderId]) return null;

              const baseConfig =
                SLIDER_CONFIG_REF.current[
                  sliderId as keyof typeof SLIDER_CONFIG_REF.current
                ];
              if (!baseConfig) return null;

              let currentSliderTitle = baseConfig.title;
              // Pass the index from the map function as the second argument
              const sliderSpecificProps = getSliderProps(sliderId, index);

              const isJournalFlatMode =
                sliderId === SLIDER_TYPES.JOURNAL &&
                (sliderSpecificProps as any)._isFlatJournalMode;

              const motionOrderIndex = sliderOrder.indexOf(sliderId);
              const visibleOrderedIds = sliderOrder.filter(
                (id) => visibility[id]
              );
              const currentVisibleIndex = visibleOrderedIds.indexOf(sliderId);
              const canMoveUp = currentVisibleIndex > 0;
              const canMoveDown =
                currentVisibleIndex < visibleOrderedIds.length - 1;
              const isPartnerSlider = sliderId === SLIDER_TYPES.PARTNER;

              return (
                <motion.div
                  key={sliderId}
                  // ... (all your motion.div props remain the same) ...
                  layoutId={sliderId}
                  layout
                  style={{ order: motionOrderIndex }}
                  initial={{ opacity: 0, height: 0, y: 20 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }}
                  transition={{
                    opacity: { duration: 0.3 },
                    height: { duration: 0.3 },
                    y: { duration: 0.3 },
                    layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
                  }}
                  className={styles.sliderWrapper}
                >
                  <div className={styles.controls}>
                    {/* Your button controls remain the same */}
                    <button
                      onClick={
                        (sliderSpecificProps as any).onOpenModal ||
                        (() =>
                          console.log(
                            `Options for ${currentSliderTitle} (no modal)`
                          ))
                      }
                      className={`${styles.controlButton} ${styles.editButton}`}
                      aria-label={`Options for ${currentSliderTitle}`}
                      title={`Options for ${currentSliderTitle}`}
                      disabled={
                        isDocumentCreationMode &&
                        isPartnerSlider &&
                        lockedPartnerId !== partnerManager.selectedPartnerId
                      }
                    >
                      <IoOptionsOutline />
                    </button>
                    {isPartnerSlider &&
                      isTerminalJournalActive &&
                      !isDocumentCreationMode &&
                      partnerManager.selectedPartnerId && (
                        <button
                          onClick={handleStartDocumentCreation}
                          className={`${styles.controlButton} ${styles.createDocumentButton}`}
                          title="Create Document with this Partner"
                        >
                          <IoAddCircleOutline /> Create Doc
                        </button>
                      )}
                    {isPartnerSlider &&
                      isDocumentCreationMode &&
                      lockedPartnerId === partnerManager.selectedPartnerId && (
                        <button
                          onClick={handleCancelDocumentCreation}
                          className={`${styles.controlButton} ${styles.cancelDocumentButton}`}
                          title="Cancel Document Creation"
                        >
                          <IoTrashBinOutline /> Cancel Doc
                        </button>
                      )}
                    <div className={styles.moveButtonGroup}>
                      {canMoveUp && (
                        <button
                          onClick={() => moveSlider(sliderId, "up")}
                          className={styles.controlButton}
                          aria-label={`Move ${currentSliderTitle} up`}
                          disabled={isDocumentCreationMode}
                        >
                          {" "}
                          ▲ Up{" "}
                        </button>
                      )}
                      {canMoveDown && (
                        <button
                          onClick={() => moveSlider(sliderId, "down")}
                          className={styles.controlButton}
                          aria-label={`Move ${currentSliderTitle} down`}
                          disabled={isDocumentCreationMode}
                        >
                          {" "}
                          ▼ Down{" "}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* --- START OF CONDITIONAL RENDERING --- */}
                  {/*
                    The `(sliderSpecificProps as any).propName` casts are used because
                    `sliderSpecificProps` is a union of different prop shapes.
                    Inside each conditional block, we know which shape it is, but TS
                    might still complain without the cast. This assumes `getSliderProps`
                    correctly provides these properties for the given case.
                  */}

                  {sliderId === SLIDER_TYPES.JOURNAL ? (
                    isJournalFlatMode ? (
                      <DynamicSlider
                        sliderId={sliderId}
                        title={currentSliderTitle} // Or a specific title like "Filtered Journals"
                        data={(sliderSpecificProps as any).data}
                        isLoading={(sliderSpecificProps as any).isLoading}
                        isError={(sliderSpecificProps as any).isError}
                        activeItemId={(sliderSpecificProps as any).activeItemId}
                        onSlideChange={
                          (sliderSpecificProps as any).onSlideChange
                        }
                        isAccordionOpen={
                          (sliderSpecificProps as any).isAccordionOpen
                        }
                        onToggleAccordion={
                          (sliderSpecificProps as any).onToggleAccordion
                        }
                        onOpenModal={(sliderSpecificProps as any).onOpenModal}
                      />
                    ) : (
                      <JournalHierarchySlider
                        sliderId={sliderId}
                        hierarchyData={
                          (sliderSpecificProps as any).hierarchyData
                        }
                        isLoading={(sliderSpecificProps as any).isLoading}
                        isError={(sliderSpecificProps as any).isError}
                        selectedTopLevelId={
                          (sliderSpecificProps as any).selectedTopLevelId
                        }
                        selectedLevel2Ids={
                          (sliderSpecificProps as any).selectedLevel2Ids
                        }
                        selectedLevel3Ids={
                          (sliderSpecificProps as any).selectedLevel3Ids
                        }
                        onSelectTopLevel={
                          (sliderSpecificProps as any).onSelectTopLevel
                        }
                        onToggleLevel2Id={
                          (sliderSpecificProps as any).onToggleLevel2Id
                        }
                        onToggleLevel3Id={
                          (sliderSpecificProps as any).onToggleLevel3Id
                        }
                        onL3DoubleClick={
                          (sliderSpecificProps as any).onL3DoubleClick
                        }
                        onNavigateContextDown={
                          (sliderSpecificProps as any).onNavigateContextDown
                        }
                        rootJournalIdConst={
                          (sliderSpecificProps as any).rootJournalIdConst
                        }
                        onOpenModal={(sliderSpecificProps as any).onOpenModal}
                        isRootView={(sliderSpecificProps as any).isRootView}
                        currentFilterStatus={
                          (sliderSpecificProps as any).currentFilterStatus
                        }
                        onFilterStatusChange={
                          (sliderSpecificProps as any).onFilterStatusChange
                        }
                        onL2DoubleClick={
                          (sliderSpecificProps as any).onL2DoubleClick
                        }
                        fullHierarchyData={
                          (sliderSpecificProps as any).fullHierarchyData
                        } // Pass full hierarchy for double-click actions
                      />
                    )
                  ) : sliderId === SLIDER_TYPES.PARTNER ? (
                    <DynamicSlider
                      sliderId={sliderId}
                      title={currentSliderTitle}
                      data={(sliderSpecificProps as any).data}
                      isLoading={(sliderSpecificProps as any).isLoading}
                      isError={(sliderSpecificProps as any).isError}
                      activeItemId={(sliderSpecificProps as any).activeItemId}
                      onSlideChange={(sliderSpecificProps as any).onSlideChange}
                      isAccordionOpen={
                        (sliderSpecificProps as any).isAccordionOpen
                      }
                      onToggleAccordion={
                        (sliderSpecificProps as any).onToggleAccordion
                      }
                      isLocked={(sliderSpecificProps as any).isLocked}
                      isDocumentCreationMode={
                        (sliderSpecificProps as any).isDocumentCreationMode
                      }
                      onOpenModal={(sliderSpecificProps as any).onOpenModal}
                    />
                  ) : sliderId === SLIDER_TYPES.GOODS ? (
                    <DynamicSlider
                      sliderId={sliderId}
                      title={currentSliderTitle}
                      // Pass any other props that are *not* in sliderSpecificProps
                      // or that need to be handled uniquely here.
                      // For example, onToggleAccordion might be generic:
                      onToggleAccordion={() => toggleAccordion(sliderId)}
                      {...(sliderSpecificProps as any)} // This will pass all props from the object
                    />
                  ) : // Fallback for other types that use DynamicSlider (e.g., Project, Document)
                  // This assumes SLIDER_CONFIG_REF.current[sliderId].Component is DynamicSlider
                  // You might need to be more specific if other components can be used
                  baseConfig.Component === DynamicSlider ? (
                    <DynamicSlider
                      sliderId={sliderId}
                      title={currentSliderTitle}
                      {...(sliderSpecificProps as any)} // Spread all props assuming they match DynamicSlider
                    />
                  ) : (
                    <div>
                      Unsupported slider type or component configuration for{" "}
                      {sliderId}
                    </div>
                  )}
                  {/* --- END OF CONDITIONAL RENDERING --- */}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>

      {isDocumentCreationMode && (
        <div className={styles.finishDocumentContainer}>
          <button
            onClick={handleFinishDocument}
            className={`${styles.modalButtonPrimary} ${styles.finishDocumentButton}`}
          >
            {" "}
            Finish Document & Review{" "}
          </button>
        </div>
      )}

      {/* Modals (ensure all props are passed, especially isSubmitting from mutations) */}
      <AnimatePresence>
        {partnerJournalLinking.isLinkPartnerToJournalsModalOpen && (
          <LinkPartnerToJournalsModal
            isOpen={partnerJournalLinking.isLinkPartnerToJournalsModalOpen}
            onClose={
              partnerJournalLinking.closeLinkPartnerToJournalsModalHandler
            }
            onSubmitLinks={
              partnerJournalLinking.submitLinkPartnerToJournalsHandler
            }
            partnerToLink={partnerJournalLinking.partnerForLinking}
            isSubmitting={
              partnerJournalLinking.isSubmittingLinkPartnerToJournals
            }
            onOpenJournalSelector={openJournalSelectorForLinking} // Generic selector opener
            fullJournalHierarchy={journalManager.currentHierarchy} // Pass full hierarchy if modal needs it for display/filtering
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {journalManager.isAddJournalModalOpen && ( // NEW
          <AddJournalModal
            isOpen={journalManager.isAddJournalModalOpen} // NEW
            onClose={journalManager.closeAddJournalModal} // NEW
            onSubmit={handleAddJournalSubmit} // Uses journalManager.createJournal
            context={journalManager.addJournalContext} // NEW
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isConfirmationModalOpen && partnerManager.partnerQuery.data && (
          <DocumentConfirmationModal
            isOpen={isConfirmationModalOpen}
            onClose={closeConfirmationModal}
            onValidate={handleValidateDocument}
            partner={partnerManager.partnerQuery.data.find(
              (p) => p.id === lockedPartnerId
            )}
            goods={selectedGoodsForDocument}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {partnerManager.isAddEditPartnerModalOpen && (
          <AddEditPartnerModal
            isOpen={partnerManager.isAddEditPartnerModalOpen}
            onClose={partnerManager.handleCloseAddEditPartnerModal}
            onSubmit={partnerManager.handleAddOrUpdatePartnerSubmit}
            initialData={partnerManager.editingPartnerData}
            isSubmitting={
              partnerManager.createPartnerMutation.isPending ||
              partnerManager.updatePartnerMutation.isPending
            }
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {goodManager.isAddEditGoodModalOpen && (
          <AddEditGoodModal
            isOpen={goodManager.isAddEditGoodModalOpen}
            onClose={goodManager.handleCloseAddEditGoodModal}
            onSubmit={goodManager.handleAddOrUpdateGoodSubmit}
            initialData={goodManager.editingGoodData}
            isSubmitting={
              goodManager.createGoodMutation.isPending ||
              goodManager.updateGoodMutation.isPending
            }
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {partnerJournalLinking.isUnlinkPartnerModalOpen &&
          partnerJournalLinking.partnerForUnlinking && (
            <UnlinkPartnerFromJournalsModal
              isOpen={partnerJournalLinking.isUnlinkPartnerModalOpen}
              onClose={partnerJournalLinking.closeUnlinkPartnerModalHandler}
              partner={partnerJournalLinking.partnerForUnlinking}
              onUnlink={partnerJournalLinking.submitUnlinkPartnerHandler}
              fetchLinksFn={() => {
                if (!partnerJournalLinking.partnerForUnlinking?.id) {
                  // Should not happen if modal is open with partnerForUnlinking set
                  console.warn(
                    "Attempted to fetch links for unlinking partner without a partner ID."
                  );
                  return Promise.resolve([]); // Return empty array or handle error
                }
                return partnerJournalLinking.fetchLinksForUnlinkModal(
                  String(partnerJournalLinking.partnerForUnlinking.id) // Ensure it's a string
                );
              }}
              isUnlinking={partnerJournalLinking.isSubmittingUnlinkPartner}
            />
          )}
      </AnimatePresence>
      <AnimatePresence>
        {goodJournalLinking.isLinkGoodToJournalsModalOpen &&
          goodJournalLinking.goodForLinking && (
            <LinkGoodToJournalsModal
              isOpen={goodJournalLinking.isLinkGoodToJournalsModalOpen}
              onClose={goodJournalLinking.closeLinkGoodToJournalsModalHandler}
              onSubmitLinks={goodJournalLinking.submitLinkGoodToJournalsHandler}
              goodToLink={goodJournalLinking.goodForLinking}
              isSubmitting={goodJournalLinking.isSubmittingLinkGoodToJournals}
              onOpenJournalSelector={goodJournalLinking.onOpenJournalSelector} // This is the generic openJournalSelectorForLinking
            />
          )}
      </AnimatePresence>
      <AnimatePresence>
        {goodJournalLinking.isUnlinkGoodModalOpen &&
          goodJournalLinking.goodForUnlinking && (
            <UnlinkGoodFromJournalsModal
              isOpen={goodJournalLinking.isUnlinkGoodModalOpen}
              onClose={goodJournalLinking.closeUnlinkGoodModalHandler}
              good={goodJournalLinking.goodForUnlinking}
              onUnlink={goodJournalLinking.submitUnlinkGoodHandler}
              fetchLinksFn={() => {
                if (!goodJournalLinking.goodForUnlinking?.id) {
                  // Should not happen if modal is open with goodForUnlinking set
                  console.warn(
                    "Attempted to fetch links for unlinking without a good ID."
                  );
                  return Promise.resolve([]); // Return empty array or handle error
                }
                return goodJournalLinking.fetchLinksForGoodUnlinkModal(
                  String(goodJournalLinking.goodForUnlinking.id) // Ensure it's a string
                );
              }}
              isUnlinking={goodJournalLinking.isSubmittingUnlinkGood}
            />
          )}
      </AnimatePresence>
      <AnimatePresence>
        {(journalManager.isJournalNavModalOpen ||
          isJournalModalOpenForLinking) && ( // NEW
          <JournalModal
            isOpen={
              journalManager.isJournalNavModalOpen ||
              isJournalModalOpenForLinking
            } // NEW
            onClose={() => {
              if (journalManager.isJournalNavModalOpen)
                journalManager.closeJournalNavModal(); // NEW
              if (isJournalModalOpenForLinking) {
                /* ... (linking logic unchanged) ... */
              }
            }}
            modalTitle="Select Context Journal for G-P View"
            onConfirmSelection={(selId, childSel) => {
              // For navigation mode
              if (
                !isJournalModalOpenForLinking &&
                journalManager.handleSelectTopLevelJournal
              ) {
                journalManager.handleSelectTopLevelJournal(
                  selId,
                  journalManager.currentHierarchy,
                  childSel
                ); // NEW
              }
            }}
            onSetShowRoot={() => {
              // For navigation mode
              if (
                !isJournalModalOpenForLinking &&
                journalManager.handleSelectTopLevelJournal
              ) {
                journalManager.handleSelectTopLevelJournal(
                  ROOT_JOURNAL_ID,
                  journalManager.currentHierarchy
                ); // NEW
              }
            }}
            onSelectForLinking={
              isJournalModalOpenForLinking
                ? handleJournalNodeSelectedForLinking
                : undefined
            }
            hierarchy={
              journalManager.isHierarchyLoading // NEW
                ? []
                : [
                    {
                      id: ROOT_JOURNAL_ID_FOR_MODAL,
                      name: `Chart of Accounts`,
                      code: "ROOT",
                      children: journalManager.currentHierarchy, // NEW (or journalManager.hierarchyData for raw full tree)
                      isConceptualRoot: true,
                    },
                  ]
            }
            isLoading={journalManager.isHierarchyLoading} // NEW
            onTriggerAddChild={(parentId, parentCode) => {
              const parentNode =
                parentId === ROOT_JOURNAL_ID_FOR_MODAL
                  ? null
                  : findNodeById(journalManager.currentHierarchy, parentId);
              journalManager.openAddJournalModal({
                // NEW
                level: parentNode ? "child" : "top",
                parentId: parentNode ? parentId : null,
                parentCode: parentCode,
                parentName: parentNode?.name || "",
              });
            }}
            onDeleteAccount={handleDeleteJournalAccount} // Uses journalManager.deleteJournal
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isJournalModalOpenForGPGContext && (
          <JournalModal
            isOpen={isJournalModalOpenForGPGContext}
            onClose={() => setIsJournalModalOpenForGPGContext(false)}
            onConfirmSelection={(selectedNodeId) => {
              // Find the node details from hierarchy. JournalModal only gives ID on confirm.
              // This assumes JournalModal's onConfirmSelection is for navigation usually.
              // For this "picker" mode, we might need to enhance JournalModal or use onSelectForLinking
              // Temporarily, let's assume a direct call to our handler if the modal internally calls it.
              // OR, better, use a dedicated prop for single selection confirmation in JournalModal.
              // For now, assuming JournalModal's "Confirm Selection" button triggers this.
              let nodeToPass: AccountNodeData | null = null;
              if (
                selectedNodeId &&
                selectedNodeId !== ROOT_JOURNAL_ID_FOR_MODAL
              ) {
                nodeToPass = findNodeById(
                  journalManager.hierarchyData || [],
                  selectedNodeId
                );
              }
              if (nodeToPass) {
                handleGPGContextJournalSelected(nodeToPass);
              } else if (
                selectedNodeId === ROOT_JOURNAL_ID_FOR_MODAL ||
                !selectedNodeId
              ) {
                // If conceptual root or nothing is selected, and confirm is hit, do nothing or clear
                // handleGPGContextJournalSelected will alert if !node or conceptualRoot.
              }
            }}
            // If JournalModal uses onSelectForLinking for its "Add Selected Journal" button:
            onSelectForLinking={handleGPGContextJournalSelected} // This makes the "Add Selected Journal" button work
            modalTitle="Select Context Journal for G-P-G View" // New prop for modal title
            hierarchy={
              journalManager.isHierarchyLoading
                ? []
                : [
                    {
                      id: ROOT_JOURNAL_ID_FOR_MODAL,
                      name: `Chart of Accounts (Select Context Journal)`,
                      code: "ROOT",
                      children: journalManager.currentHierarchy,
                      isConceptualRoot: true,
                    },
                  ]
            }
            isLoading={journalManager.isHierarchyLoading}
            onTriggerAddChild={(parentId, parentCode) => {
              const parentNode =
                parentId === ROOT_JOURNAL_ID_FOR_MODAL
                  ? null
                  : findNodeById(journalManager.currentHierarchy, parentId);
              journalManager.openAddJournalModal({
                level: parentNode ? "child" : "top",
                parentId: parentNode ? parentId : null,
                parentCode,
                parentName: parentNode?.name || "",
              });
            }}
            onDeleteAccount={handleDeleteJournalAccount}
            //hmmmmmmmmmmmmmmmmmmmmmmmmmm
            onSetShowRoot={() => {
              // For GPG context selection, we always show the root
              handleGPGContextJournalSelected({
                id: ROOT_JOURNAL_ID_FOR_MODAL,
                name: "Chart of Accounts",
                code: "ROOT",
              });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {jpqlLinking.isLinkGoodToPartnersViaJournalModalOpen &&
          jpqlLinking.goodForJpgLinking &&
          jpqlLinking.targetJournalForJpgLinking && (
            <LinkGoodToPartnersViaJournalModal
              isOpen={jpqlLinking.isLinkGoodToPartnersViaJournalModalOpen}
              onClose={
                jpqlLinking.closeLinkGoodToPartnersViaJournalModalHandler
              }
              onSubmitLinks={
                jpqlLinking.submitLinkGoodToPartnersViaJournalHandler
              }
              goodToLink={jpqlLinking.goodForJpgLinking}
              targetJournal={jpqlLinking.targetJournalForJpgLinking}
              availablePartners={
                jpqlLinking.isLoadingPartnersForJpgModal
                  ? []
                  : jpqlLinking.partnersForJpgModal
              }
              isSubmitting={
                jpqlLinking.isLoadingPartnersForJpgModal ||
                jpqlLinking.isSubmittingLinkJPGL
              }
            />
          )}
      </AnimatePresence>
      <AnimatePresence>
        {jpqlLinking.isUnlinkGoodFromPartnersViaJournalModalOpen &&
          jpqlLinking.goodForUnlinkingContext &&
          jpqlLinking.journalForUnlinkingContext && (
            <UnlinkGoodFromPartnersViaJournalModal
              isOpen={jpqlLinking.isUnlinkGoodFromPartnersViaJournalModalOpen}
              onClose={
                jpqlLinking.closeUnlinkGoodFromPartnersViaJournalModalHandler
              }
              onConfirmUnlink={
                jpqlLinking.submitUnlinkGoodFromPartnersViaJournalHandler
              }
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

      <PartnerOptionsMenu
        isOpen={partnerManager.isPartnerOptionsMenuOpen}
        onClose={partnerManager.handleClosePartnerOptionsMenu}
        anchorEl={partnerManager.partnerOptionsMenuAnchorEl}
        selectedPartnerId={partnerManager.selectedPartnerId}
        onAdd={partnerManager.handleOpenAddPartnerModal}
        onEdit={partnerManager.handleOpenEditPartnerModal}
        onDelete={partnerManager.handleDeleteCurrentPartner}
        onLinkToJournals={
          partnerJournalLinking.openLinkPartnerToJournalsModalHandler
        }
        onUnlinkFromJournals={
          partnerJournalLinking.openUnlinkPartnerModalHandler
        }
        onCreateGPGLink={
          isGPStartOrder && // Only if in GPG mode
          selectedContextJournalIdForGPG && // Context journal is set
          goodManager.selectedGoodsId && // Good in S1 is selected
          partnerManager.selectedPartnerId // Partner in S2 is selected
            ? handleCreateGPGLink
            : undefined
        }
      />
      <GoodsOptionsMenu
        isOpen={goodManager.isGoodsOptionsMenuOpen}
        onClose={goodManager.handleCloseGoodsOptionsMenu}
        anchorEl={goodManager.goodsOptionsMenuAnchorEl}
        selectedGoodsId={goodManager.selectedGoodsId}
        onAdd={goodManager.handleOpenAddGoodModal}
        onEdit={goodManager.handleOpenEditGoodModal}
        onDelete={goodManager.handleDeleteCurrentGood}
        // 2-Way Good-Journal Links
        onLinkToJournals={goodJournalLinking.openLinkGoodToJournalsModalHandler}
        onUnlinkFromJournals={goodJournalLinking.openUnlinkGoodModalHandler}
        // --- 3-Way JPGL MODAL-BASED LINKING ---
        // Prop name in GoodsOptionsMenu: onOpenLinkGoodToPartnersModal
        // Handler in page.tsx: handleOpenLinkGoodToPartnersViaJournalModal
        // Condition in page.tsx: canLinkGoodToPartnersViaJournal
        onOpenLinkGoodToPartnersModal={
          // Renamed for clarity in GoodsOptionsMenu component
          canLinkGoodToPartnersViaJournal // This is the boolean condition from page.tsx
            ? jpqlLinking.openLinkGoodToPartnersViaJournalModalHandler
            : undefined
        }
        canOpenLinkGoodToPartnersModal={canLinkGoodToPartnersViaJournal} // Renamed for clarity
        // --- 3-Way JPGL MODAL-BASED UNLINKING ---
        // Prop name in GoodsOptionsMenu: onOpenUnlinkGoodFromPartnersModal
        // Handler in page.tsx: handleOpenUnlinkGoodFromPartnersViaJournalModal
        // Condition in page.tsx: canUnlinkGoodFromPartnersViaJournal
        onOpenUnlinkGoodFromPartnersModal={
          // Renamed for clarity in GoodsOptionsMenu component
          canUnlinkGoodFromPartnersViaJournal // This is the boolean condition from page.tsx
            ? jpqlLinking.openUnlinkGoodFromPartnersViaJournalModalHandler
            : undefined
        }
        canOpenUnlinkGoodFromPartnersModal={canUnlinkGoodFromPartnersViaJournal} // Renamed for clarity
      />
    </div>
  );
}
