// src/app/page.tsx
"use client";

// React & Next.js Core
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// Third-party Libraries
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
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
import { findNodeById } from "@/lib/helpers";
import { SLIDER_TYPES, ROOT_JOURNAL_ID, INITIAL_ORDER } from "@/lib/constants";
import type {
  AccountNodeData,
  CreateJournalPartnerGoodLinkClientData,
  Journal,
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

import UserAuthDisplay from "@/components/layout/UserAuthDisplay";

import { useSession } from "next-auth/react"; // <<<< MAKE SURE THIS IS IMPORTED
import { useModalStates } from "@/hooks/useModalStates"; // <<<< Import your updated modal states hook
import CreateUserModal from "@/components/modals/CreateUserModal"; // <<<< Import the new modal
import type { ExtendedUser } from "@/app/api/auth/[...nextauth]/route"; // Ensure this is imported

// --- Main Page Component ---
export default function Home() {
  const { data: session, status: sessionStatus } = useSession();

  // --- Determine effective journal restriction ---
  let effectiveRestrictedJournalId: string | null = null;
  let effectiveRestrictedJournalCompanyId: string | null = null;

  if (sessionStatus === "authenticated" && session?.user) {
    const user = session.user as ExtendedUser; // Cast to your detailed type
    if (user.roles && user.roles.length > 0) {
      // Find the first role with a journal restriction.
      // You might have more complex logic if multiple roles can have restrictions.
      const roleWithRestriction = user.roles.find(
        (role) => !!role.restrictedTopLevelJournalId
      );
      if (roleWithRestriction) {
        effectiveRestrictedJournalId =
          roleWithRestriction.restrictedTopLevelJournalId || null;
        effectiveRestrictedJournalCompanyId =
          roleWithRestriction.restrictedTopLevelJournalCompanyId || null;
      }
    }
  }
  // Log the determined restriction for debugging
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      console.log("[Page.tsx] Effective Journal Restriction:", {
        id: effectiveRestrictedJournalId,
        companyId: effectiveRestrictedJournalCompanyId,
      });
    }
  }, [
    sessionStatus,
    effectiveRestrictedJournalId,
    effectiveRestrictedJournalCompanyId,
  ]);
  // --- Hooks ---
  // 1. Base Custom Hooks (few dependencies on local state here)
  const { sliderOrder, visibility, toggleVisibility, moveSlider } =
    useSliderManagement();

  // 2. Journal Manager - often a primary source of context
  const journalManager = useJournalManager({
    sliderOrder,
    visibility,
    restrictedJournalId: effectiveRestrictedJournalId, // <<<< Pass determined restriction
    restrictedJournalCompanyId: effectiveRestrictedJournalCompanyId, // <<<< Pass determined restriction company
  });

  const {
    // Destructure resetJournalSelections early if it's stable and used in deps
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
    resetJournalSelections, // Make sure this is destructured
    // Destructure other needed values from journalManager if used directly before linking hooks
    // e.g., isJournalNavModalOpen, closeJournalNavModal, resetJournalSelections, setSelectedFlatJournalId
    // openJournalNavModal, addJournalContext, createJournal, deleteJournal, setJournalRootFilterStatus
  } = journalManager;

  // --- MODAL STATES HOOK ---
  const {
    // ... existing modal states and handlers from useModalStates
    isJournalModalOpen, // Example, ensure all used ones are destructured
    openJournalModal,
    closeJournalModal,
    isAddJournalModalOpen,
    addJournalContext,
    openAddJournalModalWithContext,
    closeAddJournalModal,
    // --- NEWLY ADDED for Create User Modal ---
    isCreateUserModalOpen,
    openCreateUserModal,
    closeCreateUserModal,
  } = useModalStates(); // <<<< Use the updated hook

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

  // NEW: State for cross-filtering IDs and loading states
  const [crossFilterSelectedPartnerId, setCrossFilterSelectedPartnerId] =
    useState<string | null>(null);
  const [crossFilterSelectedGoodsId, setCrossFilterSelectedGoodsId] = useState<
    string | null
  >(null);
  const [isPartnerDataLoading, setIsPartnerDataLoading] = useState(false);
  const [isGoodsDataLoading, setIsGoodsDataLoading] = useState(false);

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

  // Partner Manager INSTANCE (defined before Good Manager if Good Manager needs its output)
  const partnerManager = usePartnerManager({
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds: journalManager.effectiveSelectedJournalIds,
    selectedGoodsId: crossFilterSelectedGoodsId, // INPUT: for J-G-P filtering (from page state)
    selectedJournalIdForGjpFiltering:
      !journalManager.isJournalSliderPrimary && // use !isJournalSliderPrimary for clarity
      sliderOrder.indexOf(SLIDER_TYPES.GOODS) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1
        ? journalManager.selectedFlatJournalId
        : null,
    journalRootFilterStatus: journalManager.journalRootFilterStatus,
    isJournalHierarchyLoading: journalManager.isHierarchyLoading,
    // isFlatJournalsQueryForGoodLoading will be derived from flatJournalsQueryForGood.isLoading later
    isGPGOrderActive: isGPStartOrder,
    gpgContextJournalId: selectedContextJournalIdForGPG,
    // Pass flatJournalsQueryForGood loading state if it's defined *before* this hook
    // For now, use isGoodsDataLoading as a proxy if it's generally about goods related loading affecting partners
    isFlatJournalsQueryForGoodLoading: isGoodsDataLoading,
  });

  // Good Manager INSTANCE
  const goodManager = useGoodManager({
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds: journalManager.effectiveSelectedJournalIds,
    selectedPartnerId: crossFilterSelectedPartnerId, // INPUT: for J-P-G filtering (from page state)
    selectedJournalIdForPjgFiltering:
      !journalManager.isJournalSliderPrimary &&
      sliderOrder.indexOf(SLIDER_TYPES.PARTNER) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1
        ? journalManager.selectedFlatJournalId
        : null,
    journalRootFilterStatus: journalManager.journalRootFilterStatus,
    isJournalHierarchyLoading: journalManager.isHierarchyLoading,
    isPartnerQueryLoading: isPartnerDataLoading, // INPUT: loading state from partnerManager (via page state)
    // Pass flatJournalsQuery loading state if it's defined *before* this hook
    // For now, use isPartnerDataLoading as a proxy for partner-related flat journal loading
    isFlatJournalsQueryLoading: isPartnerDataLoading,
    isGPContextActive: isGPStartOrder,
    gpgContextJournalId: selectedContextJournalIdForGPG,
  });

  // useEffects to sync internal hook selections and loading states to page-level states
  useEffect(() => {
    setCrossFilterSelectedPartnerId(partnerManager.selectedPartnerId);
  }, [partnerManager.selectedPartnerId]);

  useEffect(() => {
    setIsPartnerDataLoading(
      partnerManager.partnerQuery.isLoading ||
        partnerManager.partnerQuery.isFetching
    );
  }, [
    partnerManager.partnerQuery.isLoading,
    partnerManager.partnerQuery.isFetching,
  ]);

  useEffect(() => {
    setCrossFilterSelectedGoodsId(goodManager.selectedGoodsId);
  }, [goodManager.selectedGoodsId]);

  useEffect(() => {
    setIsGoodsDataLoading(
      goodManager.goodsQueryState.isLoading ||
        goodManager.goodsQueryState.isFetching
    );
  }, [
    goodManager.goodsQueryState.isLoading,
    goodManager.goodsQueryState.isFetching,
  ]);

  // Declare flat journal queries using the crossFilter states
  const flatJournalsQueryForGood = useQuery<Journal[], Error>({
    queryKey: ["flatJournalsFilteredByGood", crossFilterSelectedGoodsId], // Use page state
    queryFn: async () =>
      !crossFilterSelectedGoodsId
        ? []
        : fetchJournalsLinkedToGood(crossFilterSelectedGoodsId),
    enabled:
      visibility[SLIDER_TYPES.JOURNAL] &&
      sliderOrder.indexOf(SLIDER_TYPES.GOODS) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1 &&
      !!crossFilterSelectedGoodsId,
  });

  const flatJournalsQuery = useQuery<Journal[], Error>({
    queryKey: [
      "flatJournalsFilteredByPartner",
      crossFilterSelectedPartnerId, // Use page state
    ],
    queryFn: async () =>
      !crossFilterSelectedPartnerId
        ? []
        : fetchJournalsLinkedToPartner(crossFilterSelectedPartnerId),
    enabled:
      visibility[SLIDER_TYPES.JOURNAL] &&
      sliderOrder.indexOf(SLIDER_TYPES.PARTNER) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1 &&
      !!crossFilterSelectedPartnerId,
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
          // Reset partner selection when GPG context journal changes.
          // The usePartnerManager hook will react to the new gpgContextJournalId prop.
          // No need to directly call partnerManager.setSelectedPartnerId here.
        }
      } else {
        alert(
          "Please select a specific journal account for the G-P-G context."
        );
      }
      setIsJournalModalOpenForGPGContext(false);
    },
    [isGPStartOrder, ROOT_JOURNAL_ID]
  );

  const handleClearGPGContextJournal = useCallback(() => {
    setSelectedContextJournalIdForGPG(null);
    if (isGPStartOrder) {
      // Reset partner selection. The usePartnerManager hook will react.
    }
  }, [isGPStartOrder]);

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
      journalContextAvailable =
        journalManager.effectiveSelectedJournalIds.length > 0;
    } else {
      const isPJG =
        partnerSliderIndex === 0 &&
        journalSliderIndex === 1 &&
        goodSliderIndex === 2;
      const isGJP =
        goodSliderIndex === 0 &&
        journalSliderIndex === 1 &&
        partnerSliderIndex > 1;

      if (isPJG || isGJP) {
        journalContextAvailable = !!journalManager.selectedFlatJournalId;
      }
    }

    return (
      visibility[SLIDER_TYPES.GOODS] &&
      goodSliderIndex !== -1 &&
      journalContextAvailable &&
      !!goodManager.selectedGoodsId
    );
  }, [
    sliderOrder,
    visibility,
    journalManager.isJournalSliderPrimary,
    journalManager.effectiveSelectedJournalIds,
    journalManager.selectedFlatJournalId,
    goodManager.selectedGoodsId,
  ]);

  // --- Effects (useEffect) ---
  // useEffect for goodManager.selectedGoodsId auto-selection
  useEffect(() => {
    if (
      !goodManager.goodsQueryState.isLoading &&
      !goodManager.goodsQueryState.isFetching &&
      !goodManager.goodsQueryState.isError &&
      goodManager.goodsQueryState.data
    ) {
      // Logic handled by useGoodManager internal useEffect
    } else if (
      !goodManager.goodsQueryState.isLoading &&
      !goodManager.goodsQueryState.isFetching &&
      !goodManager.goodsQueryState.isError &&
      goodManager.selectedGoodsId !== null
    ) {
      // Logic handled by useGoodManager internal useEffect
    }
  }, [
    goodManager.goodsQueryState.data,
    goodManager.goodsQueryState.isLoading,
    goodManager.goodsQueryState.isFetching,
    goodManager.goodsQueryState.isError,
    goodManager.selectedGoodsId,
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

  // Stable references
  const { setSelectedPartnerId } = partnerManager;
  const { setSelectedGoodsId } = goodManager;

  useEffect(() => {
    console.log(
      "EFFECT: Slider order changed to:",
      sliderOrder.join("-"),
      ". Resetting dependent entity selections."
    );
    if (resetJournalSelections) resetJournalSelections();
    if (setSelectedPartnerId) setSelectedPartnerId(null);
    if (setSelectedGoodsId) setSelectedGoodsId(null);
    setCrossFilterSelectedPartnerId(null);
    setCrossFilterSelectedGoodsId(null);
  }, [
    sliderOrder,
    resetJournalSelections,
    setSelectedPartnerId,
    setSelectedGoodsId,
  ]);

  useEffect(() => {
    if (!isGPStartOrder && selectedContextJournalIdForGPG !== null) {
      console.log(
        "EFFECT: GPStartOrder is false OR sliderOrder changed; clearing GP context journal if set."
      );
      setSelectedContextJournalIdForGPG(null);
    }
  }, [isGPStartOrder, sliderOrder, selectedContextJournalIdForGPG]);

  useEffect(() => {
    if (isJournalSecondAfterPartner) {
      journalManager.setSelectedFlatJournalId(null);
    }
  }, [
    partnerManager.selectedPartnerId,
    isJournalSecondAfterPartner,
    journalManager.setSelectedFlatJournalId,
  ]);

  useEffect(() => {
    if (isJournalSecondAfterPartner) {
      // P-J-G
      if (goodManager.setSelectedGoodsId) goodManager.setSelectedGoodsId(null);
      setCrossFilterSelectedGoodsId(null);
    } else if (isJournalSecondAfterGood) {
      // G-J-P
      if (partnerManager.setSelectedPartnerId)
        partnerManager.setSelectedPartnerId(null);
      setCrossFilterSelectedPartnerId(null);
    }
  }, [
    journalManager.selectedFlatJournalId,
    isJournalSecondAfterPartner,
    isJournalSecondAfterGood,
    goodManager.setSelectedGoodsId,
    partnerManager.setSelectedPartnerId,
  ]);

  useEffect(() => {
    if (isJournalSecondAfterGood) {
      journalManager.setSelectedFlatJournalId(null);
    }
  }, [
    goodManager.selectedGoodsId,
    isJournalSecondAfterGood,
    journalManager.setSelectedFlatJournalId,
  ]);

  useEffect(() => {
    const journalSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
    if (journalSliderIndex === 0) {
      if (partnerManager.setSelectedPartnerId)
        partnerManager.setSelectedPartnerId(null);
      if (goodManager.setSelectedGoodsId) goodManager.setSelectedGoodsId(null);
      setCrossFilterSelectedPartnerId(null);
      setCrossFilterSelectedGoodsId(null);
    }
  }, [
    journalManager.journalRootFilterStatus,
    journalManager.effectiveSelectedJournalIds,
    sliderOrder,
    goodManager.setSelectedGoodsId,
    partnerManager.setSelectedPartnerId,
  ]);

  useEffect(() => {
    if (!isGPStartOrder) {
      if (selectedContextJournalIdForGPG !== null) {
        setSelectedContextJournalIdForGPG(null);
      }
    }
  }, [isGPStartOrder, selectedContextJournalIdForGPG]);

  useEffect(() => {
    if (isGPStartOrder && selectedContextJournalIdForGPG === null) {
      // Selections will be cleared by the hooks reacting to gpgContextJournalId prop
    }
  }, [isGPStartOrder, selectedContextJournalIdForGPG]);

  // G-P-G Link Creation Handler
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
      journalManager.createJournal(formDataFromModal);
    },
    [journalManager.createJournal, journalManager.addJournalContext] // journalManager.addJournalContext was listed as dependency, keep if intended.
  );

  const handleDeleteJournalAccount = useCallback(
    (accountIdToDelete: string) => {
      if (
        window.confirm(
          `Are you sure you want to delete journal ${accountIdToDelete}? This cannot be undone.`
        )
      ) {
        journalManager.deleteJournal(accountIdToDelete);
      }
    },
    [journalManager.deleteJournal]
  );

  const handleJournalRootFilterChange = useCallback(
    journalManager.setJournalRootFilterStatus,
    [journalManager.setJournalRootFilterStatus]
  );

  const handleOpenJournalModalForNavigation = useCallback(() => {
    setIsJournalModalOpenForLinking(false);
    setOnJournalSelectForLinkingCallback(null);
    journalManager.openJournalNavModal();
  }, [journalManager.openJournalNavModal]);

  const handleJournalNodeSelectedForLinking = useCallback(
    (selectedNode: AccountNodeData) => {
      if (onJournalSelectForLinkingCallback) {
        onJournalSelectForLinkingCallback(selectedNode);
      }
    },
    [onJournalSelectForLinkingCallback]
  );

  const handleLinkGoodToActiveJournalAndPartner = useCallback(() => {
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
      alert("No good selected.");
      return;
    }

    const linkDataForSimpleButton: CreateJournalPartnerGoodLinkClientData = {
      journalId: targetJournalId,
      partnerId: partnerManager.selectedPartnerId,
      goodId: goodManager.selectedGoodsId,
      partnershipType: "STANDARD_TRANSACTION",
    };
    jpqlLinking.createSimpleJPGLHandler(linkDataForSimpleButton);
  }, [
    journalManager.effectiveSelectedJournalIds, // Now directly from journalManager destructuring
    partnerManager.selectedPartnerId,
    goodManager.selectedGoodsId,
    jpqlLinking.createSimpleJPGLHandler,
  ]);

  const isJAndPSelectedForJPGL = useMemo(() => {
    return (
      journalManager.effectiveSelectedJournalIds.length > 0 &&
      !!partnerManager.selectedPartnerId
    );
  }, [
    journalManager.effectiveSelectedJournalIds,
    partnerManager.selectedPartnerId,
  ]);

  const canLinkGoodToPartnersViaJournal = useMemo(() => {
    const journalIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const goodsIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);

    return (
      visibility[SLIDER_TYPES.JOURNAL] &&
      visibility[SLIDER_TYPES.GOODS] &&
      journalIndex === 0 &&
      goodsIndex === 1 &&
      journalManager.effectiveSelectedJournalIds.length > 0 &&
      !!goodManager.selectedGoodsId
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
      selectedTopLevelJournalId, // from journalManager
      selectedLevel2JournalIds, // from journalManager
      selectedLevel3JournalIds // from journalManager
    );
    console.log("Partner:", partnerDetails);
    console.log("Goods for Document:", selectedGoodsForDocument);
    console.log("--------------------------");
    resetDocumentCreationState();
  }, [
    partnerManager.partnerQuery.data,
    lockedPartnerId,
    selectedGoodsForDocument,
    selectedTopLevelJournalId, // from journalManager
    selectedLevel2JournalIds, // from journalManager
    selectedLevel3JournalIds, // from journalManager
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
      partnerManager.setSelectedPartnerId, // from partnerManager
      goodManager.setSelectedGoodsId, // from goodManager
    ]
  );

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
            const isPJ =
              visibleSliders.length > 1 &&
              visibleSliders[0] === SLIDER_TYPES.PARTNER &&
              myVisibleIndex === 1;
            const isGJ =
              visibleSliders.length > 1 &&
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
            // Determine isRootView for the hierarchical slider
            const isHierarchicalSliderRootView =
              (journalManager.selectedTopLevelJournalId === ROOT_JOURNAL_ID &&
                !effectiveRestrictedJournalId) ||
              (effectiveRestrictedJournalId &&
                journalManager.selectedTopLevelJournalId ===
                  effectiveRestrictedJournalId);

            return {
              _isFlatJournalMode: false,
              hierarchyData: journalManager.currentHierarchy,
              fullHierarchyData: journalManager.hierarchyData, // Pass the potentially fuller data for findParentOfNode
              isLoading: journalManager.isHierarchyLoading,
              isError: journalManager.isHierarchyError,
              error: journalManager.hierarchyError,
              selectedTopLevelId: journalManager.selectedTopLevelJournalId,
              selectedLevel2Ids: journalManager.selectedLevel2JournalIds || [],
              selectedLevel3Ids: journalManager.selectedLevel3JournalIds || [],
              onSelectTopLevel: (id: string, childId?: string | null) =>
                journalManager.handleSelectTopLevelJournal(
                  id,
                  journalManager.hierarchyData,
                  childId
                ),
              onToggleLevel2Id: (id: string) =>
                journalManager.handleToggleLevel2JournalId(
                  id,
                  journalManager.currentHierarchy
                ),
              onToggleLevel3Id: (id: string) =>
                journalManager.handleToggleLevel3JournalId(
                  id,
                  journalManager.currentHierarchy
                ),
              rootJournalIdConst: ROOT_JOURNAL_ID,
              restrictedJournalId: effectiveRestrictedJournalId, // <<<< Pass restriction ID
              isRootView: isHierarchicalSliderRootView,
              currentFilterStatus: journalManager.journalRootFilterStatus,
              onFilterStatusChange: journalManager.setJournalRootFilterStatus,
              onOpenModal: journalManager.openJournalNavModal,
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
              partnerManager.setSelectedPartnerId(id),
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
            selectedGoodsForDoc: documentCreation.selectedGoodsForDocument,
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
        case SLIDER_TYPES.PROJECT:
          return {
            data: displayedProjects,
            activeItemId: selectedProjectId,
            onSlideChange: (id: string | null) =>
              setSelectedProjectId(id as string),
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
              setSelectedDocumentId(id as string),
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
      // Dependencies for getSliderProps
      sliderOrder,
      visibility,
      isGPStartOrder,
      selectedContextJournalIdForGPG,
      // journalManager.hierarchyData, // Now using journalManager.currentHierarchy or journalManager.hierarchyData explicitly in props below
      goodManager.goodsQueryState,
      goodManager.selectedGoodsId,
      goodManager.setSelectedGoodsId,
      goodManager.handleOpenGoodsOptionsMenu,
      accordionTypeState,
      toggleAccordion,
      documentCreation.isDocumentCreationMode,
      documentCreation.selectedGoodsForDocument,
      documentCreation.handleToggleGoodForDocument,
      documentCreation.handleUpdateGoodDetailForDocument,
      handleOpenJournalModalForGPGContext,
      handleClearGPGContextJournal,
      ROOT_JOURNAL_ID, // Used by JournalHierarchySlider props
      flatJournalsQuery, // Data source for flat journals
      flatJournalsQueryForGood, // Data source for flat journals
      journalManager.selectedFlatJournalId, // Used by flat journal DynamicSlider
      journalManager.setSelectedFlatJournalId, // Handler for flat journal DynamicSlider
      journalManager.openJournalNavModal, // Handler for flat journal DynamicSlider
      journalManager.isJournalSliderPrimary, // Determines which journal view
      // journalManager props for hierarchical view
      journalManager.currentHierarchy,
      journalManager.hierarchyData, // Specifically for fullHierarchyData prop
      journalManager.isHierarchyLoading,
      journalManager.isHierarchyError,
      journalManager.hierarchyError,
      journalManager.selectedTopLevelJournalId,
      journalManager.selectedLevel2JournalIds,
      journalManager.selectedLevel3JournalIds,
      journalManager.handleSelectTopLevelJournal,
      journalManager.handleToggleLevel2JournalId,
      journalManager.handleToggleLevel3JournalId,
      journalManager.journalRootFilterStatus,
      journalManager.setJournalRootFilterStatus,
      effectiveRestrictedJournalId, // <<<< Added for isHierarchicalSliderRootView and restrictedJournalId prop
      // partnerManager props for PARTNER case
      partnerManager.partnersForSlider, // Data source for partner slider
      partnerManager.partnerQuery, // Contains isLoading, isError for partner slider
      partnerManager.selectedPartnerId, // Active item for partner slider
      partnerManager.setSelectedPartnerId, // Handler for partner slider
      partnerManager.handleOpenPartnerOptionsMenu, // Handler for partner slider
      // Add any other direct dependencies from the outer scope used within getSliderProps
      displayedProjects,
      selectedProjectId,
      setSelectedProjectId, // For PROJECT slider
      displayedDocuments,
      selectedDocumentId,
      setSelectedDocumentId, // For DOCUMENT slider
    ]
  );
  // --- Component JSX ---
  return (
    <div className={styles.pageContainer}>
      <h1 className={styles.title}>ERP Application Interface</h1>
      <UserAuthDisplay onOpenCreateUserModal={openCreateUserModal} />
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
              if (!visibility[sliderId]) return null;

              const baseConfig =
                SLIDER_CONFIG_REF.current[
                  sliderId as keyof typeof SLIDER_CONFIG_REF.current
                ];
              if (!baseConfig) return null;

              let currentSliderTitle = baseConfig.title;
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

                  {sliderId === SLIDER_TYPES.JOURNAL ? (
                    isJournalFlatMode ? (
                      <DynamicSlider
                        sliderId={sliderId}
                        title={currentSliderTitle}
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
                          // This is currentHierarchy from journalManager
                          (sliderSpecificProps as any).hierarchyData
                        }
                        fullHierarchyData={
                          // This is hierarchyData (raw from query) from journalManager
                          (sliderSpecificProps as any).fullHierarchyData
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
                        onSelectTopLevel={(
                          id: string,
                          childId?: string | null
                        ) =>
                          journalManager.handleSelectTopLevelJournal(
                            id,
                            journalManager.hierarchyData,
                            childId
                          )
                        }
                        onToggleLevel2Id={(id: string) =>
                          journalManager.handleToggleLevel2JournalId(
                            id,
                            journalManager.currentHierarchy
                          )
                        }
                        onToggleLevel3Id={(id: string) =>
                          journalManager.handleToggleLevel3JournalId(
                            id,
                            journalManager.currentHierarchy
                          )
                        }
                        rootJournalIdConst={
                          // This is the true ROOT_JOURNAL_ID
                          (sliderSpecificProps as any).rootJournalIdConst
                        }
                        restrictedJournalId={
                          // Pass the actual restriction ID
                          (sliderSpecificProps as any).restrictedJournalId
                        }
                        isRootView={(sliderSpecificProps as any).isRootView}
                        currentFilterStatus={
                          (sliderSpecificProps as any).currentFilterStatus
                        }
                        onFilterStatusChange={
                          (sliderSpecificProps as any).onFilterStatusChange
                        }
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
                      onToggleAccordion={() => toggleAccordion(sliderId)}
                      {...(sliderSpecificProps as any)}
                    />
                  ) : baseConfig.Component === DynamicSlider ? (
                    <DynamicSlider
                      sliderId={sliderId}
                      title={currentSliderTitle}
                      {...(sliderSpecificProps as any)}
                    />
                  ) : (
                    <div>
                      Unsupported slider type or component configuration for{" "}
                      {sliderId}
                    </div>
                  )}
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
      {/* Modals */}
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
            onOpenJournalSelector={openJournalSelectorForLinking}
            fullJournalHierarchy={journalManager.currentHierarchy}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {journalManager.isAddJournalModalOpen && (
          <AddJournalModal
            isOpen={journalManager.isAddJournalModalOpen}
            onClose={journalManager.closeAddJournalModal}
            onSubmit={handleAddJournalSubmit}
            context={journalManager.addJournalContext}
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
                  console.warn(
                    "Attempted to fetch links for unlinking partner without a partner ID."
                  );
                  return Promise.resolve([]);
                }
                return partnerJournalLinking.fetchLinksForUnlinkModal(
                  String(partnerJournalLinking.partnerForUnlinking.id)
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
              onOpenJournalSelector={goodJournalLinking.onOpenJournalSelector} // This was already correct
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
                  console.warn(
                    "Attempted to fetch links for unlinking without a good ID."
                  );
                  return Promise.resolve([]);
                }
                return goodJournalLinking.fetchLinksForGoodUnlinkModal(
                  String(goodJournalLinking.goodForUnlinking.id)
                );
              }}
              isUnlinking={goodJournalLinking.isSubmittingUnlinkGood}
            />
          )}
      </AnimatePresence>
      <AnimatePresence>
        {(journalManager.isJournalNavModalOpen ||
          isJournalModalOpenForLinking) && (
          <JournalModal
            isOpen={
              journalManager.isJournalNavModalOpen ||
              isJournalModalOpenForLinking
            }
            onClose={() => {
              if (journalManager.isJournalNavModalOpen) {
                journalManager.closeJournalNavModal();
              }
              if (isJournalModalOpenForLinking) {
                setIsJournalModalOpenForLinking(false);
                setOnJournalSelectForLinkingCallback(null);
              }
            }}
            modalTitle={
              isJournalModalOpenForLinking
                ? "Select Journal(s) to Link"
                : "Manage & Select Journals"
            }
            onConfirmSelection={(selId, childSel) => {
              if (
                journalManager.isJournalNavModalOpen &&
                !isJournalModalOpenForLinking
              ) {
                journalManager.handleSelectTopLevelJournal(
                  selId,
                  journalManager.currentHierarchy,
                  childSel
                );
              }
            }}
            onSetShowRoot={() => {
              if (
                journalManager.isJournalNavModalOpen &&
                !isJournalModalOpenForLinking
              ) {
                journalManager.handleSelectTopLevelJournal(
                  ROOT_JOURNAL_ID, // This should navigate to the effective root (considering restriction)
                  journalManager.currentHierarchy // or journalManager.hierarchyData if true root is always intended here
                );
              }
            }}
            onSelectForLinking={
              isJournalModalOpenForLinking
                ? handleJournalNodeSelectedForLinking
                : undefined
            }
            hierarchy={
              journalManager.isHierarchyLoading
                ? []
                : [
                    {
                      id: ROOT_JOURNAL_ID_FOR_MODAL,
                      name: `Chart of Accounts`,
                      code: "ROOT",
                      children: journalManager.currentHierarchy, // This is already the restricted view if applicable
                      isConceptualRoot: true,
                    },
                  ]
            }
            isLoading={journalManager.isHierarchyLoading}
            onTriggerAddChild={(parentId, parentCode) => {
              const parentNode =
                parentId === ROOT_JOURNAL_ID_FOR_MODAL
                  ? null
                  : findNodeById(journalManager.currentHierarchy, parentId); // Search within current (potentially restricted) hierarchy
              journalManager.openAddJournalModal({
                // This uses the hook's openAddJournalModal method
                level: parentNode ? "child" : "top",
                parentId: parentNode ? parentId : null,
                parentCode: parentCode,
                parentName: parentNode?.name || "",
              });
            }}
            onDeleteAccount={handleDeleteJournalAccount}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isJournalModalOpenForGPGContext && (
          <JournalModal
            isOpen={isJournalModalOpenForGPGContext}
            onClose={() => setIsJournalModalOpenForGPGContext(false)}
            onConfirmSelection={(selectedNodeId) => {
              // This callback is for navigation, ensure it respects hierarchy
              let nodeToPass: AccountNodeData | null = null;
              if (
                selectedNodeId &&
                selectedNodeId !== ROOT_JOURNAL_ID_FOR_MODAL
              ) {
                nodeToPass = findNodeById(
                  // Search within the *full* hierarchyData for context selection
                  journalManager.hierarchyData || [], // Use hierarchyData (potentially unfiltered) if selecting outside current view context
                  selectedNodeId
                );
              }
              if (nodeToPass) {
                handleGPGContextJournalSelected(nodeToPass);
              }
            }}
            onSelectForLinking={handleGPGContextJournalSelected} // This is for selecting the GPG context
            modalTitle="Select Context Journal for G-P-G View"
            hierarchy={
              journalManager.isHierarchyLoading
                ? []
                : [
                    {
                      id: ROOT_JOURNAL_ID_FOR_MODAL,
                      name: `Chart of Accounts (Select Context Journal)`,
                      code: "ROOT",
                      children: journalManager.currentHierarchy, // Show current restricted view for selection
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
                // Hook's method
                level: parentNode ? "child" : "top",
                parentId: parentNode ? parentId : null,
                parentCode,
                parentName: parentNode?.name || "",
              });
            }}
            onDeleteAccount={handleDeleteJournalAccount}
            onSetShowRoot={() => {
              // This is effectively "clear selection" or "select conceptual root" for linking
              handleGPGContextJournalSelected({
                id: ROOT_JOURNAL_ID_FOR_MODAL, // This might need to be a true null or a specific "no context" state
                name: "Chart of Accounts",
                code: "ROOT",
                isConceptualRoot: true, // Add this to signify it's not a real journal
              } as AccountNodeData);
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
          isGPStartOrder &&
          selectedContextJournalIdForGPG &&
          goodManager.selectedGoodsId &&
          partnerManager.selectedPartnerId
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
        onLinkToJournals={goodJournalLinking.openLinkGoodToJournalsModalHandler}
        onUnlinkFromJournals={goodJournalLinking.openUnlinkGoodModalHandler}
        onOpenLinkGoodToPartnersModal={
          canLinkGoodToPartnersViaJournal
            ? jpqlLinking.openLinkGoodToPartnersViaJournalModalHandler
            : undefined
        }
        canOpenLinkGoodToPartnersModal={canLinkGoodToPartnersViaJournal}
        onOpenUnlinkGoodFromPartnersModal={
          canUnlinkGoodFromPartnersViaJournal
            ? jpqlLinking.openUnlinkGoodFromPartnersViaJournalModalHandler
            : undefined
        }
        canOpenUnlinkGoodFromPartnersModal={canUnlinkGoodFromPartnersViaJournal}
      />

      {/* --- NEW: Render CreateUserModal --- */}
      <AnimatePresence>
        {isCreateUserModalOpen && (
          <CreateUserModal
            isOpen={isCreateUserModalOpen}
            onClose={closeCreateUserModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
