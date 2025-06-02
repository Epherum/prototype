// src/app/page.js// src/app/page.js
"use client";

// React & Next.js Core
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// Third-party Libraries
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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
  fetchJournalHierarchy,
  createJournalEntry,
  deleteJournalEntry,
  fetchJournalsLinkedToPartner,
} from "@/services/clientJournalService";

// Libs (Helpers, Constants, Types)
import { findNodeById, getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES, ROOT_JOURNAL_ID, INITIAL_ORDER } from "@/lib/constants";
import type { CreateJournalData as ServerCreateJournalData } from "@/app/services/journalService";

import type { AccountNodeData, Journal } from "@/lib/types";

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
import LinkGoodToPartnersViaJournalModal from "@/components/modals/LinkGoodToPartnersViaJournalModal"; // Import the new modal
import UnlinkGoodFromPartnersViaJournalModal from "@/components/modals/UnlinkGoodFromPartnersViaJournalModal"; // Import the new modal

// Custom Hooks
import { useSliderManagement } from "@/hooks/useSliderManagement";
import { useJournalNavigation } from "@/hooks/useJournalNavigation";
import { useDocumentCreation } from "@/hooks/useDocumentCreation";
import { useModalStates } from "@/hooks/useModalStates";
import { usePartnerManager } from "@/hooks/usePartnerManager";
import { useGoodJournalLinking } from "@/hooks/useGoodJournalLinking";
import { useGoodManager } from "@/hooks/useGoodManager";
import { usePartnerJournalLinking } from "@/hooks/usePartnerJournalLinking";
import { useJournalPartnerGoodLinking } from "@/hooks/useJournalPartnerGoodLinking";
import { useJournalManager } from "@/hooks/useJournalManager";

// --- Main Page Component ---
export default function Home() {
  // --- Hooks ---
  // Base Custom Hooks (few dependencies on local state here)
  const { sliderOrder, visibility, toggleVisibility, moveSlider } =
    useSliderManagement();
  const {
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    handleSelectTopLevelJournal: hookHandleSelectTopLevelJournal,
    handleToggleLevel2JournalId: hookHandleToggleLevel2JournalId,
    handleToggleLevel3JournalId: hookHandleToggleLevel3JournalId,
    handleL3DoubleClick: hookHandleL3DoubleClick,
    handleNavigateContextDown: hookHandleNavigateContextDown,
    resetJournalSelections: hookResetJournalSelections,
  } = useJournalNavigation();
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
  } = useDocumentCreation();
  const {
    isJournalModalOpen: _isJournalNavModalOpen,
    openJournalModal: openJournalNavModalFromHook,
    closeJournalModal: closeJournalNavModalFromHook,
    isAddJournalModalOpen,
    addJournalContext,
    openAddJournalModalWithContext,
    closeAddJournalModal,
  } = useModalStates();

  // --- State Declarations (useState) ---
  const [journalRootFilterStatus, setJournalRootFilterStatus] = useState<
    "affected" | "unaffected" | "all" | null
  >(null);
  const [
    selectedJournalIdForPjgFiltering,
    setSelectedJournalIdForPjgFiltering,
  ] = useState<string | null>(null);
  const [
    selectedJournalIdForGjpFiltering,
    setSelectedJournalIdForGjpFiltering,
  ] = useState<string | null>(null);

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

  // --- Refs ---
  const visibilitySwiperRef = useRef<any>(null);

  // --- Query Client & Constants ---
  const queryClient = useQueryClient();
  const ROOT_JOURNAL_ID_FOR_MODAL = "__MODAL_ROOT_NODE__";

  // --- Data Queries & Derived State (useQuery, useMemo) ---
  const journalHierarchyQuery = useQuery<AccountNodeData[], Error>({
    queryKey: ["journalHierarchy"],
    queryFn: fetchJournalHierarchy,
  });

  const currentHierarchy = useMemo(
    () => journalHierarchyQuery.data || [],
    [journalHierarchyQuery.data]
  );

  const effectiveSelectedJournalIds = useMemo(() => {
    if (sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) !== 0) return [];
    const effectiveIds = new Set<string>();
    const getParentContextForL2s = () =>
      selectedTopLevelJournalId && selectedTopLevelJournalId !== ROOT_JOURNAL_ID
        ? findNodeById(currentHierarchy, selectedTopLevelJournalId)
        : null;
    const parentContextNode = getParentContextForL2s();
    const sourceForL2s = parentContextNode
      ? parentContextNode.children
      : currentHierarchy;
    selectedLevel3JournalIds.forEach((l3Id) => effectiveIds.add(l3Id));
    selectedLevel2JournalIds.forEach((l2Id) => {
      const l2Node = findNodeById(sourceForL2s || [], l2Id);
      if (l2Node) {
        const anyOfItsL3ChildrenSelected = (l2Node.children || []).some(
          (l3Child) => selectedLevel3JournalIds.includes(l3Child.id)
        );
        if (!anyOfItsL3ChildrenSelected) effectiveIds.add(l2Id);
      }
    });
    if (
      effectiveIds.size === 0 &&
      selectedTopLevelJournalId &&
      selectedTopLevelJournalId !== ROOT_JOURNAL_ID
    ) {
      const l1Node = findNodeById(currentHierarchy, selectedTopLevelJournalId);
      if (l1Node && (l1Node.children || []).length === 0)
        effectiveIds.add(selectedTopLevelJournalId);
    }
    return Array.from(effectiveIds);
  }, [
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    currentHierarchy,
    sliderOrder,
    ROOT_JOURNAL_ID, // findNodeById is assumed to be defined globally or imported
  ]);

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

  const isTerminalJournalActive = useMemo(() => {
    if (
      selectedTopLevelJournalId === ROOT_JOURNAL_ID ||
      !currentHierarchy ||
      currentHierarchy.length === 0
    )
      return false;
    const l1Node = findNodeById(currentHierarchy, selectedTopLevelJournalId);
    return !!(l1Node && (l1Node.children || []).length === 0);
  }, [selectedTopLevelJournalId, currentHierarchy, ROOT_JOURNAL_ID]); // findNodeById assumed global/imported

  // --- Manager Hooks (Potentially Cyclical Dependencies) ---
  // The order of goodManager, partnerManager, and flatJournalsQuery is tricky
  // due to their interdependencies.
  // goodManager is declared first. Its hook should be robust to
  // partnerManager.selectedPartnerId and flatJournalsQuery.isLoading being undefined initially.
  // These values would then be supplied on subsequent renders.

  const goodManager = useGoodManager({
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds,
    // These will be undefined on first render if partnerManager and flatJournalsQuery are defined later.
    // The useGoodManager hook needs to handle this, typically by re-fetching/re-calculating when these props change.
    selectedPartnerId: undefined, // Placeholder: partnerManager is not yet defined
    isPartnerQueryLoading: undefined, // Placeholder: partnerManager is not yet defined
    isFlatJournalsQueryLoading: undefined, // Placeholder: flatJournalsQuery is not yet defined
    selectedJournalIdForPjgFiltering,
    journalRootFilterStatus,
    isJournalHierarchyLoading: journalHierarchyQuery.isLoading,
    // isFlatJournalsQueryLoading: flatJournalsQuery.isLoading, // Original: This would be a problem if flatJournalsQuery depends on partnerManager
  });

  // Query for journals linked to a good (G-J scenario)
  // Note: The enabled logic and queryFn might need selectedGoodsId from goodManager.
  // Placed here as it's less complexly tied than the main partner/good manager cycle.
  const flatJournalsQueryForGood = useQuery<Journal[], Error>({
    queryKey: ["flatJournalsFilteredByGood", goodManager.selectedGoodsId],
    queryFn: async () => {
      // Actual logic depends on where selectedGoodsId comes from
      return []; // Placeholder
    },
    enabled:
      visibility[SLIDER_TYPES.JOURNAL] &&
      isJournalSecondAfterGood && // Replaced useMemo with direct usage
      false, // Placeholder, enabled logic depends on selectedGoodsId source
  });

  const partnerManager = usePartnerManager({
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds,
    selectedGoodsId: goodManager.selectedGoodsId, // OK: goodManager is now defined
    selectedJournalIdForGjpFiltering,
    journalRootFilterStatus,
    isJournalHierarchyLoading: journalHierarchyQuery.isLoading,
    isFlatJournalsQueryForGoodLoading: flatJournalsQueryForGood.isLoading, // OK
  });

  // Query for journals linked to a partner (P-J scenario)
  const flatJournalsQuery = useQuery<Journal[], Error>({
    queryKey: [
      "flatJournalsFilteredByPartner",
      partnerManager.selectedPartnerId, // OK: partnerManager is now defined
    ],
    queryFn: async () =>
      !partnerManager.selectedPartnerId
        ? (console.log("[flatJournalsQuery] No partner, returning []"), [])
        : (console.log(
            `[flatJournalsQuery] Fetching for partner: ${partnerManager.selectedPartnerId}`
          ),
          fetchJournalsLinkedToPartner(partnerManager.selectedPartnerId)), // fetchJournalsLinkedToPartner assumed global/imported
    enabled:
      visibility[SLIDER_TYPES.JOURNAL] &&
      isJournalSecondAfterPartner &&
      !!partnerManager.selectedPartnerId, // OK
  });

  // Note: If useGoodManager truly needs live values from partnerManager and flatJournalsQuery
  // *at the moment of its first call*, the above ordering still presents a conceptual issue
  // that must be handled by the hook's internal logic (e.g. initial undefined state, then update).
  // The provided snippet for useGoodManager's arguments:
  // { selectedPartnerId: partnerManager.selectedPartnerId, isPartnerQueryLoading: partnerManager.partnerQuery.isLoading, isFlatJournalsQueryLoading: flatJournalsQuery.isLoading }
  // was problematic because partnerManager and flatJournalsQuery would not be defined yet.
  // The corrected call to useGoodManager above passes `undefined` for these, assuming the hook handles it.

  // --- Callbacks & Dependent Hooks ---
  const openJournalSelectorForLinking = useCallback(
    (onSelectCallback: (journalNode: AccountNodeData) => void) => {
      setOnJournalSelectForLinkingCallback(() => onSelectCallback);
      setIsJournalModalOpenForLinking(true);
      if (_isJournalNavModalOpen) {
        closeJournalNavModalFromHook();
      }
    },
    [
      _isJournalNavModalOpen,
      closeJournalNavModalFromHook,
      setOnJournalSelectForLinkingCallback, // Added missing dependencies
      setIsJournalModalOpenForLinking, // Added missing dependencies
    ]
  );

  const goodJournalLinking = useGoodJournalLinking({
    selectedGoodsId: goodManager.selectedGoodsId,
    goodsData: goodManager.goodsQuery.data,
    onOpenJournalSelector: openJournalSelectorForLinking,
  });

  const partnerJournalLinking = usePartnerJournalLinking({
    selectedPartnerId: partnerManager.selectedPartnerId,
    partnerData: partnerManager.partnersForSlider, // Use data from partnerManager
    onOpenJournalSelector: openJournalSelectorForLinking,
    // partnerQueryKeyParamsStructure: partnerManager.partnerQueryKeyParamsStructure, // If hook needed it for invalidation
  });

  const jpqlLinking = useJournalPartnerGoodLinking({
    selectedGoodsId: goodManager.selectedGoodsId,
    goodsData: goodManager.goodsQuery.data,
    effectiveSelectedJournalIds,
    selectedJournalIdForPjgFiltering,
    currentHierarchy: currentHierarchy, // Pass the fetched hierarchy
    sliderOrder,
    // goodsQueryKeyParamsStructure: goodManager.goodsQueryKeyParamsStructure, // Optional for precise invalidation
  });

  const canUnlinkGoodFromPartnersViaJournal = useMemo(() => {
    const journalSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const goodSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);
    const partnerSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);

    let journalContextAvailable = false;
    if (
      journalSliderIndex === 0 &&
      (goodSliderIndex === 1 ||
        (partnerSliderIndex === 1 && goodSliderIndex === 2))
    ) {
      journalContextAvailable = effectiveSelectedJournalIds.length > 0;
    } else if (
      partnerSliderIndex === 0 &&
      journalSliderIndex === 1 &&
      goodSliderIndex === 2
    ) {
      journalContextAvailable = !!selectedJournalIdForPjgFiltering;
    }

    return (
      visibility[SLIDER_TYPES.GOODS] &&
      goodSliderIndex > 0 &&
      journalContextAvailable &&
      !!goodManager.selectedGoodsId
    );
  }, [
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds,
    selectedJournalIdForPjgFiltering,
    goodManager.selectedGoodsId,
  ]);

  // --- Effects (useEffect) ---
  useEffect(() => {
    if (goodManager.goodsQuery.isSuccess && goodManager.goodsQuery.data) {
      const fetchedGoods = goodManager.goodsQuery.data;
      const currentSelectionInList =
        goodManager.selectedGoodsId &&
        fetchedGoods.some((g) => g.id === goodManager.selectedGoodsId);
      if (fetchedGoods.length > 0 && !currentSelectionInList)
        goodManager.setSelectedGoodsId(getFirstId(fetchedGoods));
      // getFirstId assumed global/imported
      else if (fetchedGoods.length === 0) goodManager.setSelectedGoodsId(null);
    } else if (
      !goodManager.goodsQuery.isLoading &&
      !goodManager.goodsQuery.isFetching &&
      !goodManager.goodsQuery.isError
    ) {
      goodManager.setSelectedGoodsId(null);
    }
  }, [
    goodManager.goodsQuery.data,
    goodManager.goodsQuery.isSuccess,
    goodManager.goodsQuery.isLoading,
    goodManager.goodsQuery.isFetching,
    goodManager.goodsQuery.isError,
    goodManager.selectedGoodsId,
    goodManager.setSelectedGoodsId, // Added missing dependency
  ]);

  useEffect(() => {
    if (visibilitySwiperRef.current) visibilitySwiperRef.current?.update();
  }, [sliderOrder, visibility]);

  useEffect(() => {
    console.log(
      "Slider order changed to:",
      sliderOrder.join("-"),
      ". Resetting selections."
    );
    if (hookResetJournalSelections) hookResetJournalSelections();
    partnerManager.setSelectedPartnerId(null);
    goodManager.setSelectedGoodsId(null);
    setSelectedJournalIdForPjgFiltering(null);
    setSelectedJournalIdForGjpFiltering(null);
  }, [
    sliderOrder,
    hookResetJournalSelections,
    partnerManager.setSelectedPartnerId, // Use the setter from the hook directly
    goodManager.setSelectedGoodsId, // Use the setter from the hook directly
    // setSelectedJournalIdForPjgFiltering and setSelectedJournalIdForGjpFiltering are already stable
  ]);

  useEffect(() => {
    if (isJournalSecondAfterPartner) {
      setSelectedJournalIdForPjgFiltering(null);
    }
  }, [partnerManager.selectedPartnerId, isJournalSecondAfterPartner]);

  useEffect(() => {
    if (isJournalSecondAfterPartner) {
      goodManager.setSelectedGoodsId(null);
    } else if (isJournalSecondAfterGood) {
      partnerManager.setSelectedPartnerId(null);
    }
  }, [
    selectedJournalIdForPjgFiltering,
    selectedJournalIdForGjpFiltering,
    isJournalSecondAfterPartner,
    isJournalSecondAfterGood,
    partnerManager.setSelectedPartnerId, // Use the setter
    goodManager.setSelectedGoodsId, // Use the setter
  ]);

  useEffect(() => {
    if (isJournalSecondAfterGood) {
      setSelectedJournalIdForGjpFiltering(null);
    }
  }, [goodManager.selectedGoodsId, isJournalSecondAfterGood]);

  useEffect(() => {
    const journalSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
    if (journalSliderIndex === 0) {
      partnerManager.setSelectedPartnerId(null);
      goodManager.setSelectedGoodsId(null);
    }
  }, [
    journalRootFilterStatus,
    effectiveSelectedJournalIds,
    sliderOrder,
    partnerManager.setSelectedPartnerId, // Use the setter
    goodManager.setSelectedGoodsId, // Use the setter
  ]);

  // --- TanStack Mutations (Data Modification) ---
  const createJournalMutation = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: (newJournal) => {
      queryClient.invalidateQueries({ queryKey: ["journalHierarchy"] });
      closeAddJournalModal();
      alert(`Journal '${newJournal.name}' created successfully!`);
    },
    onError: (error: Error) => {
      console.error("Failed to create journal:", error);
      alert(`Error creating journal: ${error.message}`);
    },
  });

  const deleteJournalMutation = useMutation({
    mutationFn: deleteJournalEntry,
    onSuccess: (data, deletedJournalId) => {
      queryClient.invalidateQueries({ queryKey: ["journalHierarchy"] });
      alert(
        data?.message || `Journal ${deletedJournalId} deleted successfully!`
      );
      if (selectedTopLevelJournalId === deletedJournalId) {
        hookHandleSelectTopLevelJournal(
          ROOT_JOURNAL_ID,
          journalHierarchyQuery.data || []
        );
      }
      // TODO: Add more nuanced selection reset if L2/L3 is deleted or parent of selection is deleted
    },
    onError: (error: Error, deletedJournalId) => {
      console.error(`Failed to delete journal ${deletedJournalId}:`, error);
      alert(`Error deleting journal: ${error.message}`);
    },
  });

  const closeJournalNavModal = closeJournalNavModalFromHook;

  // --- Callback Handlers ---
  const handleSelectTopLevelJournalWrapper = useCallback(
    (newTopLevelId: string, childToSelectInL2: string | null = null) => {
      hookHandleSelectTopLevelJournal(
        newTopLevelId,
        currentHierarchy,
        childToSelectInL2
      );
      console.log(
        "L1 Journal selected/navigated, resetting downstream Partner & Goods selections."
      );
      partnerManager.setSelectedPartnerId(null);
      goodManager.setSelectedGoodsId(null);
    },
    [
      hookHandleSelectTopLevelJournal,
      currentHierarchy,
      partnerManager.setSelectedPartnerId,
    ]
  );

  const handleToggleLevel2JournalIdWrapper = useCallback(
    (level2IdToToggle: string) => {
      hookHandleToggleLevel2JournalId(level2IdToToggle, currentHierarchy);
      console.log(
        "L2 Journal toggled, resetting downstream Partner & Goods selections."
      );
      partnerManager.setSelectedPartnerId(null);
      goodManager.setSelectedGoodsId(null);
    },
    [
      hookHandleToggleLevel2JournalId,
      currentHierarchy,
      partnerManager.setSelectedPartnerId,
    ]
  );

  const handleToggleLevel3JournalIdWrapper = useCallback(
    (level3IdToToggle: string) => {
      hookHandleToggleLevel3JournalId(level3IdToToggle, currentHierarchy);
      console.log(
        "L3 Journal toggled, resetting downstream Partner & Goods selections."
      );
      partnerManager.setSelectedPartnerId(null);
      goodManager.setSelectedGoodsId(null);
    },
    [
      hookHandleToggleLevel3JournalId,
      currentHierarchy,
      partnerManager.setSelectedPartnerId,
    ]
  );

  const handleNavigateContextDownWrapper = useCallback(
    (args: {
      currentL1ToBecomeL2: string;
      longPressedL2ToBecomeL3?: string;
    }) => {
      hookHandleNavigateContextDown(args, currentHierarchy);
      console.log(
        "Journal context navigated down, resetting downstream Partner & Goods selections."
      );
      partnerManager.setSelectedPartnerId(null);
      goodManager.setSelectedGoodsId(null);
    },
    [
      hookHandleNavigateContextDown,
      currentHierarchy,
      partnerManager.setSelectedPartnerId,
    ]
  );

  // Journal Navigation Wrappers
  const handleSelectTopLevelJournal = useCallback(
    (newTopLevelId: string, childToSelectInL2: string | null = null) => {
      hookHandleSelectTopLevelJournal(
        newTopLevelId,
        currentHierarchy,
        childToSelectInL2
      );
    },
    [hookHandleSelectTopLevelJournal, currentHierarchy]
  );

  const handleToggleLevel2JournalId = useCallback(
    (level2IdToToggle: string) => {
      hookHandleToggleLevel2JournalId(level2IdToToggle, currentHierarchy);
    },
    [hookHandleToggleLevel2JournalId, currentHierarchy]
  );

  const handleToggleLevel3JournalId = useCallback(
    (level3IdToToggle: string) => {
      hookHandleToggleLevel3JournalId(level3IdToToggle, currentHierarchy);
    },
    [hookHandleToggleLevel3JournalId, currentHierarchy]
  );

  const handleL3DoubleClick = useCallback(
    (l3ItemId: string, isSelected: boolean) => {
      hookHandleL3DoubleClick(l3ItemId, isSelected, currentHierarchy);
    },
    [hookHandleL3DoubleClick, currentHierarchy]
  );

  const handleNavigateContextDown = useCallback(
    (args: {
      currentL1ToBecomeL2: string;
      longPressedL2ToBecomeL3?: string;
    }) => {
      hookHandleNavigateContextDown(args, currentHierarchy);
    },
    [hookHandleNavigateContextDown, currentHierarchy]
  );

  // Journal CRUD
  const handleAddJournalSubmit = useCallback(
    (formDataFromModal: Omit<AccountNodeData, "children">) => {
      const journalToCreate: ServerCreateJournalData = {
        id: formDataFromModal.code,
        name: formDataFromModal.name,
        parentId: addJournalContext?.parentId || undefined,
        isTerminal: formDataFromModal.isTerminal || false,
        additionalDetails: formDataFromModal.additionalDetails,
      };
      createJournalMutation.mutate(journalToCreate);
    },
    [addJournalContext, createJournalMutation]
  );

  const handleDeleteJournalAccount = useCallback(
    (accountIdToDelete: string) => {
      if (
        window.confirm(
          `Are you sure you want to delete journal ${accountIdToDelete}? This cannot be undone.`
        )
      ) {
        deleteJournalMutation.mutate(accountIdToDelete);
      }
    },
    [deleteJournalMutation]
  );

  // --- Callback for Journal Root Filter Change ---
  const handleJournalRootFilterChange = useCallback(
    (status: "affected" | "unaffected" | "all" | null) => {
      setJournalRootFilterStatus(status);
      // The useEffect above will handle resetting downstream selections.
    },
    []
  );

  // New handler for opening JournalModal for navigation/management
  const handleOpenJournalModalForNavigation = useCallback(() => {
    setIsJournalModalOpenForLinking(false); // Explicitly turn OFF linking mode
    setOnJournalSelectForLinkingCallback(null); // Clear any linking callback
    openJournalNavModalFromHook(); // Open the modal for navigation
  }, [openJournalNavModalFromHook]); // Dependency on the hook's open function

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
      effectiveSelectedJournalIds.length > 0
        ? effectiveSelectedJournalIds[0]
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
      effectiveSelectedJournalIds.length > 0 &&
      !!partnerManager.selectedPartnerId
    );
  }, [effectiveSelectedJournalIds, partnerManager.selectedPartnerId]);

  const canLinkGoodToPartnersViaJournal = useMemo(() => {
    const journalIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const goodsIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);

    return (
      visibility[SLIDER_TYPES.JOURNAL] &&
      visibility[SLIDER_TYPES.GOODS] &&
      journalIndex === 0 && // Journal is first
      goodsIndex === 1 && // Goods is second
      effectiveSelectedJournalIds.length > 0 && // A journal context exists
      !!goodManager.selectedGoodsId // A good is selected
    );
  }, [
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds,
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
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
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
    (sliderId: string) => {
      // ... (Props generation logic as in your original code, but ensure callbacks are the new wrappers)
      // For example, for JournalHierarchySlider:
      // onSelectTopLevel: handleSelectTopLevelJournalWrapper,
      // onToggleLevel2Id: handleToggleLevel2JournalIdWrapper,
      // onToggleLevel3Id: handleToggleLevel3JournalIdWrapper,
      // onNavigateContextDown: handleNavigateContextDownWrapper,
      // ...
      // For flat journal mode (DynamicSlider):
      // onSlideChange for P-J-G: (journalId: string | null) => { setSelectedJournalIdForPjgFiltering(journalId); /* useEffect handles goods reset */ }
      // onSlideChange for G-J-P: (journalId: string | null) => { setSelectedJournalIdForGjpFiltering(journalId); /* useEffect handles partner reset */ }
      // Ensure errors from queries are passed: error: query.error
      switch (sliderId) {
        case SLIDER_TYPES.JOURNAL:
          if (isJournalSecondAfterPartner) {
            // P-J-G
            const flatJournalItems = (flatJournalsQuery.data || []).map(
              (j) => ({ id: String(j.id), name: j.name, code: j.id })
            );
            return {
              _isFlatJournalMode: true,
              data: flatJournalItems,
              isLoading: flatJournalsQuery.isLoading,
              isError: flatJournalsQuery.isError,
              error: flatJournalsQuery.error,
              activeItemId: selectedJournalIdForPjgFiltering,
              onSlideChange: (journalId: string | null) =>
                setSelectedJournalIdForPjgFiltering(journalId), // Cascades handled by useEffect
              isAccordionOpen: accordionTypeState[SLIDER_TYPES.JOURNAL],
              onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.JOURNAL),
              onOpenModal: handleOpenJournalModalForNavigation,
            };
          } else if (isJournalSecondAfterGood) {
            // G-J-P
            const flatJournalItems = (flatJournalsQueryForGood.data || []).map(
              (j) => ({ id: String(j.id), name: j.name, code: j.id })
            );
            return {
              _isFlatJournalMode: true,
              data: flatJournalItems,
              isLoading: flatJournalsQueryForGood.isLoading,
              isError: flatJournalsQueryForGood.isError,
              error: flatJournalsQueryForGood.error,
              activeItemId: selectedJournalIdForGjpFiltering,
              onSlideChange: (journalId: string | null) =>
                setSelectedJournalIdForGjpFiltering(journalId), // Cascades handled by useEffect
              isAccordionOpen: accordionTypeState[SLIDER_TYPES.JOURNAL],
              onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.JOURNAL),
              onOpenModal: handleOpenJournalModalForNavigation,
            };
          } else {
            // Hierarchical (J is 1st)
            return {
              _isFlatJournalMode: false,
              hierarchyData: currentHierarchy,
              isLoading: journalHierarchyQuery.isLoading,
              isError: journalHierarchyQuery.isError,
              error: journalHierarchyQuery.error,
              selectedTopLevelId: selectedTopLevelJournalId,
              selectedLevel2Ids: selectedLevel2JournalIds,
              selectedLevel3Ids: selectedLevel3JournalIds,
              onSelectTopLevel: handleSelectTopLevelJournalWrapper,
              onToggleLevel2Id: handleToggleLevel2JournalIdWrapper,
              onToggleLevel3Id: handleToggleLevel3JournalIdWrapper,
              onL3DoubleClick: hookHandleL3DoubleClick,
              onNavigateContextDown: handleNavigateContextDownWrapper,
              rootJournalIdConst: ROOT_JOURNAL_ID,
              onOpenModal: handleOpenJournalModalForNavigation,
              // +++ NEW PROPS FOR JournalHierarchySlider +++
              isRootView: selectedTopLevelJournalId === ROOT_JOURNAL_ID, // To show filter buttons
              currentFilterStatus: journalRootFilterStatus,
              onFilterStatusChange: handleJournalRootFilterChange,
            };
          }
        case SLIDER_TYPES.PARTNER:
          return {
            data: partnerManager.partnersForSlider.map((p) => ({
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
              handleSwipe(SLIDER_TYPES.PARTNER, id),
            isAccordionOpen: accordionTypeState[SLIDER_TYPES.PARTNER],
            onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.PARTNER),
            isLocked: isDocumentCreationMode && lockedPartnerId !== null,
            isDocumentCreationMode: isDocumentCreationMode,
            onOpenModal: partnerManager.handleOpenPartnerOptionsMenu,
          };
        case SLIDER_TYPES.GOODS:
          const goodsDataForDisplay = goodManager.goodsForSlider.map((g) => ({
            ...g,
            id: String(g.id),
            name: g.label,
            code: g.referenceCode || String(g.id),
            unit_code: g.unitOfMeasure?.code || (g as any).unit || "N/A",
          }));
          return {
            data: goodsDataForDisplay,
            isLoading: goodManager.goodsQuery.isLoading,
            isError: goodManager.goodsQuery.isError,
            error: goodManager.goodsQuery.error,
            activeItemId: goodManager.selectedGoodsId,
            onSlideChange: (id: string | null) =>
              handleSwipe(SLIDER_TYPES.GOODS, id),
            isAccordionOpen: accordionTypeState[SLIDER_TYPES.GOODS],
            onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.GOODS),
            isDocumentCreationMode: isDocumentCreationMode,
            selectedGoodsForDoc: selectedGoodsForDocument.map((gfd) => ({
              ...gfd,
              id: String(gfd.id),
              name: gfd.name || gfd.label,
              code: gfd.code || gfd.referenceCode || String(gfd.id),
              unit_code:
                gfd.unit_code ||
                gfd.unitOfMeasure?.code ||
                (gfd as any).unit ||
                "N/A",
            })),
            onToggleGoodForDoc: handleToggleGoodForDocument,
            onUpdateGoodDetailForDoc: handleUpdateGoodDetailForDocument,
            onOpenModal: goodManager.handleOpenGoodsOptionsMenu,
          };
        case SLIDER_TYPES.PROJECT:
          return {
            data: displayedProjects,
            activeItemId: selectedProjectId,
            onSlideChange: (id: string | null) =>
              handleSwipe(SLIDER_TYPES.PROJECT, id),
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
              handleSwipe(SLIDER_TYPES.DOCUMENT, id),
            isAccordionOpen: accordionTypeState[SLIDER_TYPES.DOCUMENT],
            onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.DOCUMENT),
            isLoading: false,
            isError: false,
            error: null,
          };
        default:
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
      sliderOrder,
      currentHierarchy,
      journalHierarchyQuery.isLoading,
      journalHierarchyQuery.isError,
      journalHierarchyQuery.error,
      selectedTopLevelJournalId,
      selectedLevel2JournalIds,
      selectedLevel3JournalIds,
      handleSelectTopLevelJournalWrapper,
      handleToggleLevel2JournalIdWrapper,
      journalRootFilterStatus, // Add new state
      handleJournalRootFilterChange, // Add new callback
      handleToggleLevel3JournalIdWrapper,
      hookHandleL3DoubleClick,
      handleNavigateContextDownWrapper, // Use wrappers
      handleOpenJournalModalForNavigation,
      ROOT_JOURNAL_ID,
      accordionTypeState,
      toggleAccordion,
      isJournalSecondAfterPartner,
      flatJournalsQuery.data,
      flatJournalsQuery.isLoading,
      flatJournalsQuery.isError,
      flatJournalsQuery.error,
      selectedJournalIdForPjgFiltering,
      isJournalSecondAfterGood,
      flatJournalsQueryForGood.data,
      flatJournalsQueryForGood.isLoading,
      flatJournalsQueryForGood.isError,
      flatJournalsQueryForGood.error,
      selectedJournalIdForGjpFiltering,
      partnerManager.partnersForSlider,
      partnerManager.partnerQuery.isLoading,
      partnerManager.partnerQuery.isError,
      partnerManager.partnerQuery.error,
      partnerManager.selectedPartnerId,
      partnerManager.handleOpenPartnerOptionsMenu,
      handleSwipe,
      isDocumentCreationMode,
      lockedPartnerId,
      goodManager.goodsForSlider,
      goodManager.goodsQuery.isLoading,
      goodManager.goodsQuery.isError,
      goodManager.goodsQuery.error,
      goodManager.selectedGoodsId,
      goodManager.handleOpenGoodsOptionsMenu,
      selectedGoodsForDocument,
      handleToggleGoodForDocument,
      handleUpdateGoodDetailForDocument,
      displayedProjects,
      selectedProjectId,
      displayedDocuments,
      selectedDocumentId,
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
            {sliderOrder.map((sliderId) => {
              if (!visibility[sliderId]) return null;

              const baseConfig =
                SLIDER_CONFIG_REF.current[
                  sliderId as keyof typeof SLIDER_CONFIG_REF.current
                ];
              if (!baseConfig) return null;

              // We no longer need ComponentToRender determined here for this approach
              // let ComponentToRender = baseConfig.Component;
              let currentSliderTitle = baseConfig.title;
              const sliderSpecificProps = getSliderProps(sliderId); // Props are still fetched the same way

              // Determine if Journal is in flat mode (this logic was implicitly used by ComponentToRender)
              const isJournalFlatMode =
                sliderId === SLIDER_TYPES.JOURNAL &&
                (sliderSpecificProps as any)._isFlatJournalMode;

              const motionOrderIndex = sliderOrder.indexOf(sliderId);
              // ... (canMoveUp, canMoveDown, isPartnerSlider logic remains the same)
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
                      isDocumentCreationMode={
                        (sliderSpecificProps as any).isDocumentCreationMode
                      }
                      selectedGoodsForDoc={
                        (sliderSpecificProps as any).selectedGoodsForDoc
                      }
                      onToggleGoodForDoc={
                        (sliderSpecificProps as any).onToggleGoodForDoc
                      }
                      onUpdateGoodDetailForDoc={
                        (sliderSpecificProps as any).onUpdateGoodDetailForDoc
                      }
                      onOpenModal={(sliderSpecificProps as any).onOpenModal}
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
            fullJournalHierarchy={currentHierarchy} // Pass full hierarchy if modal needs it for display/filtering
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddJournalModalOpen && (
          <AddJournalModal
            isOpen={isAddJournalModalOpen}
            onClose={closeAddJournalModal}
            onSubmit={handleAddJournalSubmit}
            context={addJournalContext}
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
        {(_isJournalNavModalOpen || isJournalModalOpenForLinking) && (
          <JournalModal
            isOpen={_isJournalNavModalOpen || isJournalModalOpenForLinking}
            onClose={() => {
              if (_isJournalNavModalOpen) closeJournalNavModal();
              if (isJournalModalOpenForLinking) {
                setIsJournalModalOpenForLinking(false);
                setOnJournalSelectForLinkingCallback(null);
              }
            }}
            onConfirmSelection={(selId, childSel) => {
              if (
                !isJournalModalOpenForLinking &&
                hookHandleSelectTopLevelJournal
              ) {
                hookHandleSelectTopLevelJournal(
                  selId,
                  currentHierarchy,
                  childSel
                );
              }
            }}
            onSetShowRoot={() => {
              if (
                !isJournalModalOpenForLinking &&
                hookHandleSelectTopLevelJournal
              ) {
                hookHandleSelectTopLevelJournal(
                  ROOT_JOURNAL_ID,
                  currentHierarchy
                );
              }
            }}
            onSelectForLinking={
              isJournalModalOpenForLinking
                ? handleJournalNodeSelectedForLinking
                : undefined
            }
            hierarchy={
              journalHierarchyQuery.isLoading
                ? []
                : [
                    {
                      id: ROOT_JOURNAL_ID_FOR_MODAL,
                      name: `Chart of Accounts`,
                      code: "ROOT",
                      children: currentHierarchy,
                      isConceptualRoot: true,
                    },
                  ]
            }
            isLoading={journalHierarchyQuery.isLoading}
            onTriggerAddChild={(parentId, parentCode) => {
              const parentNode =
                parentId === ROOT_JOURNAL_ID_FOR_MODAL
                  ? null
                  : findNodeById(currentHierarchy, parentId);
              openAddJournalModalWithContext({
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
