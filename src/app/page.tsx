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

// Services
import {
  fetchPartners,
  createPartner,
  updatePartner,
  deletePartner,
  fetchPartnersLinkedToJournals,
  fetchPartnersLinkedToJournalsAndGood,
} from "@/services/clientPartnerService";
import {
  fetchJournalHierarchy,
  createJournalEntry,
  deleteJournalEntry,
  fetchJournalsLinkedToPartner,
  fetchJournalsLinkedToGood,
} from "@/services/clientJournalService";
import {
  fetchGoods,
  createGood,
  updateGood,
  deleteGood,
  fetchGoodsForJournalsAndPartner,
  fetchGoodsLinkedToJournals,
  fetchGoodsLinkedToPartnerViaJPGL,
} from "@/services/clientGoodService";

// Libs (Helpers, Constants, Types)
import { findNodeById, getFirstId } from "@/lib/helpers";
import { SLIDER_TYPES, ROOT_JOURNAL_ID, INITIAL_ORDER } from "@/lib/constants";
import type { CreateJournalData as ServerCreateJournalData } from "@/app/services/journalService";
import {
  createJournalPartnerLink,
  deleteJournalPartnerLink,
  fetchJournalLinksForPartner,
} from "@/services/clientJournalPartnerLinkService";

import {
  createJournalGoodLink,
  deleteJournalGoodLink,
  fetchJournalLinksForGood,
} from "@/services/clientJournalGoodLinkService";

import {
  createJournalPartnerGoodLink,
  deleteJournalPartnerGoodLink,
  fetchJpgLinksForGoodAndJournalContext,
} from "@/services/clientJournalPartnerGoodLinkService";

import type {
  Partner,
  Good,
  AccountNodeData,
  Journal,
  CreatePartnerClientData,
  UpdatePartnerClientData,
  CreateGoodClientData,
  UpdateGoodClientData,
  CreateJournalPartnerLinkClientData,
  CreateJournalGoodLinkClientData,
  CreateJournalPartnerGoodLinkClientData,
  JournalPartnerGoodLinkClient,
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
import LinkGoodToPartnersViaJournalModal from "@/components/modals/LinkGoodToPartnersViaJournalModal"; // Import the new modal
import UnlinkGoodFromPartnersViaJournalModal from "@/components/modals/UnlinkGoodFromPartnersViaJournalModal"; // Import the new modal

// Custom Hooks
import { useSliderManagement } from "@/hooks/useSliderManagement";
import { useJournalNavigation } from "@/hooks/useJournalNavigation";
import { useDocumentCreation } from "@/hooks/useDocumentCreation";
import { useModalStates } from "@/hooks/useModalStates";

// --- Main Page Component ---
export default function Home() {
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

  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    null
  );
  const [isPartnerOptionsMenuOpen, setIsPartnerOptionsMenuOpen] =
    useState(false);
  const [partnerOptionsMenuAnchorEl, setPartnerOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditPartnerModalOpen, setIsAddEditPartnerModalOpen] =
    useState(false);
  const [editingPartnerData, setEditingPartnerData] = useState<Partner | null>(
    null
  );

  const [selectedGoodsId, setSelectedGoodsId] = useState<string | null>(null);
  const [isGoodsOptionsMenuOpen, setIsGoodsOptionsMenuOpen] = useState(false);
  const [goodsOptionsMenuAnchorEl, setGoodsOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [isAddEditGoodModalOpen, setIsAddEditGoodModalOpen] = useState(false);
  const [editingGoodData, setEditingGoodData] = useState<Good | null>(null);

  const [
    selectedJournalIdForPjgFiltering,
    setSelectedJournalIdForPjgFiltering,
  ] = useState<string | null>(null);
  const [
    selectedJournalIdForGjpFiltering,
    setSelectedJournalIdForGjpFiltering,
  ] = useState<string | null>(null);

  const [isLinkPartnerModalOpen, setIsLinkPartnerModalOpen] = useState(false); // <<< ADD THIS LINE BACK

  const [
    isLinkPartnerToJournalsModalOpen,
    setIsLinkPartnerToJournalsModalOpen,
  ] = useState(false);
  const [partnerForLinking, setPartnerForLinking] = useState<Partner | null>(
    null
  );
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [partnerForUnlinking, setPartnerForUnlinking] =
    useState<Partner | null>(null);
  const [isJournalModalOpenForLinking, setIsJournalModalOpenForLinking] =
    useState(false);
  const [
    onJournalSelectForLinkingCallback,
    setOnJournalSelectForLinkingCallback,
  ] = useState<((node: AccountNodeData) => void) | null>(null);

  const [isLinkGoodToJournalsModalOpen, setIsLinkGoodToJournalsModalOpen] =
    useState(false);
  const [goodForLinking, setGoodForLinking] = useState<Good | null>(null);
  const [isUnlinkGoodModalOpen, setIsUnlinkGoodModalOpen] = useState(false);
  const [goodForUnlinking, setGoodForUnlinking] = useState<Good | null>(null);

  const [
    isUnlinkGoodFromPartnersViaJournalModalOpen,
    setIsUnlinkGoodFromPartnersViaJournalModalOpen,
  ] = useState(false);
  const [goodForUnlinkingContext, setGoodForUnlinkingContext] =
    useState<Good | null>(null);
  const [journalForUnlinkingContext, setJournalForUnlinkingContext] =
    useState<AccountNodeData | null>(null);
  const [existingJpgLinksForModal, setExistingJpgLinksForModal] = useState<
    JournalPartnerGoodLinkClient[]
  >([]);
  const [isLoadingJpgLinksForModal, setIsLoadingJpgLinksForModal] =
    useState(false);

  const [
    isLinkGoodToPartnersViaJournalModalOpen,
    setIsLinkGoodToPartnersViaJournalModalOpen,
  ] = useState(false);
  const [goodForJpgLinking, setGoodForJpgLinking] = useState<Good | null>(null);
  const [targetJournalForJpgLinking, setTargetJournalForJpgLinking] =
    useState<AccountNodeData | null>(null);
  const [partnersForJpgModal, setPartnersForJpgModal] = useState<Partner[]>([]);
  const [isLoadingPartnersForJpgModal, setIsLoadingPartnersForJpgModal] =
    useState(false);

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

  const visibilitySwiperRef = useRef<any>(null);
  const queryClient = useQueryClient();
  const ROOT_JOURNAL_ID_FOR_MODAL = "__MODAL_ROOT_NODE__";

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
    // console.log("Effective Journal IDs for filtering:", Array.from(effectiveIds));
    return Array.from(effectiveIds);
  }, [
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    currentHierarchy,
    sliderOrder,
    ROOT_JOURNAL_ID,
  ]);

  const isJournalSecondAfterPartner = useMemo(
    () =>
      sliderOrder.indexOf(SLIDER_TYPES.PARTNER) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1,
    [sliderOrder]
  );
  const flatJournalsQuery = useQuery<Journal[], Error>({
    queryKey: ["flatJournalsFilteredByPartner", selectedPartnerId],
    queryFn: async () =>
      !selectedPartnerId
        ? (console.log("[flatJournalsQuery] No partner, returning []"), [])
        : (console.log(
            `[flatJournalsQuery] Fetching for partner: ${selectedPartnerId}`
          ),
          fetchJournalsLinkedToPartner(selectedPartnerId)),
    enabled:
      visibility[SLIDER_TYPES.JOURNAL] &&
      isJournalSecondAfterPartner &&
      !!selectedPartnerId,
  });

  const isJournalSecondAfterGood = useMemo(
    () =>
      sliderOrder.indexOf(SLIDER_TYPES.GOODS) === 0 &&
      sliderOrder.indexOf(SLIDER_TYPES.JOURNAL) === 1,
    [sliderOrder]
  );
  const flatJournalsQueryForGood = useQuery<Journal[], Error>({
    queryKey: ["flatJournalsFilteredByGood", selectedGoodsId],
    queryFn: async () =>
      !selectedGoodsId
        ? (console.log("[flatJournalsQueryForGood] No good, returning []"), [])
        : (console.log(
            `[flatJournalsQueryForGood] Fetching for good: ${selectedGoodsId}`
          ),
          fetchJournalsLinkedToGood(selectedGoodsId)),
    enabled:
      visibility[SLIDER_TYPES.JOURNAL] &&
      isJournalSecondAfterGood &&
      !!selectedGoodsId,
  });

  const partnerQueryKeyParamsStructure = useMemo(() => {
    const orderString = sliderOrder.join("-");
    let params: {
      limit?: number;
      offset?: number;
      linkedToJournalIds?: string[];
      includeChildren?: boolean;
      linkedToGoodIdForJGP?: string;
    } = {};
    const partnerIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);

    if (partnerIndex === 0) {
      params = { limit: 1000, offset: 0 };
    } else if (
      orderString.startsWith(SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.PARTNER)
    ) {
      // J-P-...
      if (effectiveSelectedJournalIds.length > 0) {
        params.linkedToJournalIds = [...effectiveSelectedJournalIds];
        params.includeChildren = true;
      }
    } else if (
      orderString.startsWith(
        SLIDER_TYPES.JOURNAL +
          "-" +
          SLIDER_TYPES.GOODS +
          "-" +
          SLIDER_TYPES.PARTNER
      )
    ) {
      // J-G-P
      if (effectiveSelectedJournalIds.length > 0 && selectedGoodsId) {
        params.linkedToJournalIds = [...effectiveSelectedJournalIds];
        params.linkedToGoodIdForJGP = selectedGoodsId;
        params.includeChildren = true;
      }
    } else if (
      orderString.startsWith(
        SLIDER_TYPES.GOODS +
          "-" +
          SLIDER_TYPES.JOURNAL +
          "-" +
          SLIDER_TYPES.PARTNER
      )
    ) {
      // G-J-P
      if (selectedGoodsId && selectedJournalIdForGjpFiltering) {
        params.linkedToJournalIds = [selectedJournalIdForGjpFiltering];
        params.linkedToGoodIdForJGP = selectedGoodsId;
        params.includeChildren = false;
      }
    }
    // console.log("[partnerQueryKeyParamsStructure] Generated params:", params, "for order:", orderString);
    return params;
  }, [
    sliderOrder,
    effectiveSelectedJournalIds,
    selectedGoodsId,
    selectedJournalIdForGjpFiltering,
  ]);

  const partnerQuery = useQuery<Partner[], Error>({
    queryKey: ["partners", partnerQueryKeyParamsStructure],
    queryFn: async (): Promise<Partner[]> => {
      const {
        linkedToJournalIds,
        includeChildren,
        linkedToGoodIdForJGP,
        limit,
        offset,
      } = partnerQueryKeyParamsStructure;
      const effectiveIncludeChildren =
        includeChildren === undefined ? true : includeChildren;
      const currentOrderString = sliderOrder.join("-");
      console.log(
        `[partnerQuery.queryFn] order: ${currentOrderString}, params:`,
        JSON.stringify(partnerQueryKeyParamsStructure)
      );

      if (
        linkedToJournalIds &&
        linkedToJournalIds.length > 0 &&
        linkedToGoodIdForJGP
      ) {
        // J-G-P or G-J-P
        const type = currentOrderString.startsWith("J-G-P") ? "J-G-P" : "G-J-P";
        console.log(
          `  Fetching for ${type}. Journals: [${linkedToJournalIds.join(
            ","
          )}] & Good: ${linkedToGoodIdForJGP}`
        );
        return fetchPartnersLinkedToJournalsAndGood(
          linkedToJournalIds,
          linkedToGoodIdForJGP,
          effectiveIncludeChildren
        );
      } else if (
        currentOrderString.startsWith(
          SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.PARTNER
        )
      ) {
        // J-P-...
        if (linkedToJournalIds && linkedToJournalIds.length > 0) {
          console.log(
            `  Fetching for J-P. Journals: [${linkedToJournalIds.join(",")}]`
          );
          return fetchPartnersLinkedToJournals(
            linkedToJournalIds,
            effectiveIncludeChildren
          );
        } else {
          console.log("  J-P order, but no effective journals. Returning [].");
          return [];
        }
      } else if (
        sliderOrder.indexOf(SLIDER_TYPES.PARTNER) === 0 &&
        limit !== undefined &&
        offset !== undefined
      ) {
        // Partner is 1st
        console.log("  Partner is 1st. Fetching all partners.");
        const paginatedResult = await fetchPartners({ limit, offset });
        return paginatedResult.data.map((p) => ({ ...p, id: String(p.id) }));
      }
      console.log(
        "  No specific filter conditions met or unhandled config for partners. Returning []."
      );
      return [];
    },
    enabled: (() => {
      if (!visibility[SLIDER_TYPES.PARTNER]) return false;
      const partnerIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);
      const orderString = sliderOrder.join("-");
      if (partnerIndex === 0) return true;
      if (
        orderString.startsWith(
          SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.PARTNER
        )
      )
        return !journalHierarchyQuery.isLoading;
      if (
        orderString.startsWith(
          SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.GOODS +
            "-" +
            SLIDER_TYPES.PARTNER
        )
      )
        return effectiveSelectedJournalIds.length > 0 && !!selectedGoodsId;
      if (
        orderString.startsWith(
          SLIDER_TYPES.GOODS +
            "-" +
            SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.PARTNER
        )
      )
        return !!selectedGoodsId && !!selectedJournalIdForGjpFiltering;
      return false;
    })(),
  });
  const partnersForSlider = useMemo(
    () => partnerQuery.data || [],
    [partnerQuery.data]
  );

  const goodsQueryKeyParamsStructure = useMemo(() => {
    const orderString = sliderOrder.join("-");
    let params: {
      limit?: number;
      offset?: number;
      forJournalIds?: string[];
      forPartnerId?: string;
      linkedToPartnerIdForJPGL?: string;
      linkedToJournalIdsForJG?: string[];
      includeChildren?: boolean;
    } = {};
    const goodsIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);

    if (goodsIndex === 0) {
      params = { limit: 1000, offset: 0 };
    } else if (
      orderString.startsWith(
        SLIDER_TYPES.JOURNAL +
          "-" +
          SLIDER_TYPES.PARTNER +
          "-" +
          SLIDER_TYPES.GOODS
      )
    ) {
      // J-P-G
      if (selectedPartnerId) {
        if (effectiveSelectedJournalIds.length > 0) {
          params.forJournalIds = [...effectiveSelectedJournalIds];
          params.forPartnerId = selectedPartnerId;
          params.includeChildren = true;
        } else {
          params.linkedToPartnerIdForJPGL = selectedPartnerId;
        }
      }
    } else if (
      orderString.startsWith(
        SLIDER_TYPES.PARTNER +
          "-" +
          SLIDER_TYPES.JOURNAL +
          "-" +
          SLIDER_TYPES.GOODS
      )
    ) {
      // P-J-G
      if (selectedPartnerId && selectedJournalIdForPjgFiltering) {
        params.forJournalIds = [selectedJournalIdForPjgFiltering];
        params.forPartnerId = selectedPartnerId;
        params.includeChildren = false;
      }
    } else if (
      orderString.startsWith(SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.GOODS)
    ) {
      // J-G
      if (effectiveSelectedJournalIds.length > 0) {
        params.linkedToJournalIdsForJG = [...effectiveSelectedJournalIds];
        params.includeChildren = true;
      }
    }
    // console.log("[goodsQueryKeyParamsStructure] Generated params:", params, "for order:", orderString);
    return params;
  }, [
    sliderOrder,
    effectiveSelectedJournalIds,
    selectedPartnerId,
    selectedJournalIdForPjgFiltering,
  ]);

  const goodsQuery = useQuery<Good[], Error>({
    queryKey: ["goods", goodsQueryKeyParamsStructure],
    queryFn: async (): Promise<Good[]> => {
      const {
        forJournalIds,
        forPartnerId,
        linkedToPartnerIdForJPGL,
        linkedToJournalIdsForJG,
        includeChildren,
        limit,
        offset,
      } = goodsQueryKeyParamsStructure;
      const effectiveIncludeChildren =
        includeChildren === undefined ? true : includeChildren;
      console.log(
        `[goodsQuery.queryFn] params:`,
        JSON.stringify(goodsQueryKeyParamsStructure)
      );

      if (forJournalIds && forJournalIds.length > 0 && forPartnerId) {
        console.log(
          `  Fetching goods for Specific Journals: [${forJournalIds.join(
            ","
          )}] AND Partner: ${forPartnerId}`
        );
        return fetchGoodsForJournalsAndPartner(
          forJournalIds,
          forPartnerId,
          effectiveIncludeChildren
        );
      } else if (linkedToPartnerIdForJPGL) {
        console.log(
          `  Fetching all goods linked to Partner (via JPGL): ${linkedToPartnerIdForJPGL}`
        );
        return fetchGoodsLinkedToPartnerViaJPGL(linkedToPartnerIdForJPGL);
      } else if (
        linkedToJournalIdsForJG &&
        linkedToJournalIdsForJG.length > 0
      ) {
        console.log(
          `  Fetching goods linked to Journals (J-G): ${linkedToJournalIdsForJG.join(
            ","
          )}`
        );
        return fetchGoodsLinkedToJournals(
          linkedToJournalIdsForJG,
          effectiveIncludeChildren
        );
      } else if (
        sliderOrder.indexOf(SLIDER_TYPES.GOODS) === 0 &&
        limit !== undefined &&
        offset !== undefined
      ) {
        console.log("  Goods slider is 1st. Fetching all goods.");
        const paginatedResult = await fetchGoods({ limit, offset });
        return paginatedResult.data.map((g: Good) => ({
          ...g,
          id: String(g.id),
          taxCodeId: g.taxCodeId ?? null,
          unitCodeId: g.unitCodeId ?? null,
        }));
      }
      console.log(
        "  Preceding filters for Goods not fully set or unhandled config. Returning []."
      );
      return [];
    },
    enabled: (() => {
      if (!visibility[SLIDER_TYPES.GOODS]) return false;
      const goodsIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);
      const orderString = sliderOrder.join("-");
      if (goodsIndex === 0) return true;
      if (
        orderString.startsWith(
          SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.PARTNER +
            "-" +
            SLIDER_TYPES.GOODS
        )
      )
        return (
          !!selectedPartnerId &&
          !journalHierarchyQuery.isLoading &&
          !partnerQuery.isLoading
        );
      if (
        orderString.startsWith(
          SLIDER_TYPES.PARTNER +
            "-" +
            SLIDER_TYPES.JOURNAL +
            "-" +
            SLIDER_TYPES.GOODS
        )
      )
        return (
          !!selectedPartnerId &&
          !!selectedJournalIdForPjgFiltering &&
          !partnerQuery.isLoading &&
          !flatJournalsQuery.isLoading
        );
      if (
        orderString.startsWith(SLIDER_TYPES.JOURNAL + "-" + SLIDER_TYPES.GOODS)
      )
        return !journalHierarchyQuery.isLoading;
      return false;
    })(),
  });
  const goodsForSlider = useMemo(
    () => goodsQuery.data || [],
    [goodsQuery.data]
  );

  const canUnlinkGoodFromPartnersViaJournal = useMemo(() => {
    const journalSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const goodSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);
    const partnerSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);

    // Enabled if:
    // 1. J-G... (Journal is 0, Good is 1) AND a journal is selected
    // 2. J-P-G (Journal 0, Partner 1, Good 2) AND journal & partner selected
    // 3. P-J-G (Partner 0, Journal 1, Good 2) AND partner & flat journal selected
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
    // Add more specific conditions if needed, e.g., selectedPartnerId for J-P-G

    return (
      visibility[SLIDER_TYPES.GOODS] &&
      goodSliderIndex > 0 && // Goods not first
      journalContextAvailable &&
      !!selectedGoodsId
    );
  }, [
    sliderOrder,
    visibility,
    effectiveSelectedJournalIds,
    selectedJournalIdForPjgFiltering,
    selectedGoodsId,
  ]);
  const isTerminalJournalActive = useMemo(() => {
    if (
      selectedTopLevelJournalId === ROOT_JOURNAL_ID ||
      !currentHierarchy ||
      currentHierarchy.length === 0
    )
      return false;
    const l1Node = findNodeById(currentHierarchy, selectedTopLevelJournalId);
    return !!(l1Node && (l1Node.children || []).length === 0);
  }, [selectedTopLevelJournalId, currentHierarchy, ROOT_JOURNAL_ID]);

  useEffect(() => {
    // Auto-select first partner
    if (partnerQuery.isSuccess && partnerQuery.data) {
      const fetchedPartners = partnerQuery.data;
      const currentSelectionInList =
        selectedPartnerId &&
        fetchedPartners.some((p) => p.id === selectedPartnerId);
      if (fetchedPartners.length > 0 && !currentSelectionInList)
        setSelectedPartnerId(getFirstId(fetchedPartners));
      else if (fetchedPartners.length === 0) setSelectedPartnerId(null);
    } else if (
      !partnerQuery.isLoading &&
      !partnerQuery.isFetching &&
      !partnerQuery.isError
    ) {
      setSelectedPartnerId(null);
    }
  }, [
    partnerQuery.data,
    partnerQuery.isSuccess,
    partnerQuery.isLoading,
    partnerQuery.isFetching,
    partnerQuery.isError,
    selectedPartnerId,
  ]); // Added selectedPartnerId to dependencies

  useEffect(() => {
    // Auto-select first good
    if (goodsQuery.isSuccess && goodsQuery.data) {
      const fetchedGoods = goodsQuery.data;
      const currentSelectionInList =
        selectedGoodsId && fetchedGoods.some((g) => g.id === selectedGoodsId);
      if (fetchedGoods.length > 0 && !currentSelectionInList)
        setSelectedGoodsId(getFirstId(fetchedGoods));
      else if (fetchedGoods.length === 0) setSelectedGoodsId(null);
    } else if (
      !goodsQuery.isLoading &&
      !goodsQuery.isFetching &&
      !goodsQuery.isError
    ) {
      setSelectedGoodsId(null);
    }
  }, [
    goodsQuery.data,
    goodsQuery.isSuccess,
    goodsQuery.isLoading,
    goodsQuery.isFetching,
    goodsQuery.isError,
    selectedGoodsId,
  ]); // Added selectedGoodsId

  useEffect(() => {
    if (visibilitySwiperRef.current) visibilitySwiperRef.current?.update();
  }, [sliderOrder, visibility]);

  useEffect(() => {
    // Reset selections on sliderOrder change
    console.log(
      "Slider order changed to:",
      sliderOrder.join("-"),
      ". Resetting selections."
    );
    if (hookResetJournalSelections) hookResetJournalSelections();
    setSelectedPartnerId(null);
    setSelectedGoodsId(null);
    setSelectedJournalIdForPjgFiltering(null);
    setSelectedJournalIdForGjpFiltering(null);
  }, [sliderOrder, hookResetJournalSelections]);

  useEffect(() => {
    // P-J-G: Partner change -> reset flat Journal
    if (isJournalSecondAfterPartner) {
      setSelectedJournalIdForPjgFiltering(null);
    }
  }, [selectedPartnerId, isJournalSecondAfterPartner]);

  useEffect(() => {
    // P-J-G: Flat Journal change -> reset Goods; G-J-P: Flat Journal change -> reset Partner
    if (isJournalSecondAfterPartner) {
      setSelectedGoodsId(null);
    } else if (isJournalSecondAfterGood) {
      setSelectedPartnerId(null);
    }
  }, [
    selectedJournalIdForPjgFiltering,
    selectedJournalIdForGjpFiltering,
    isJournalSecondAfterPartner,
    isJournalSecondAfterGood,
  ]);

  useEffect(() => {
    // G-J-P: Good change -> reset flat Journal
    if (isJournalSecondAfterGood) {
      setSelectedJournalIdForGjpFiltering(null);
    }
  }, [selectedGoodsId, isJournalSecondAfterGood]);

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

  // Partner Mutations
  const createPartnerMutation = useMutation({
    mutationFn: createPartner,
    onSuccess: (newPartner) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      // queryClient.invalidateQueries({ queryKey: ['goods'] }); // If goods list depends on partner links
      setIsAddEditPartnerModalOpen(false);
      setEditingPartnerData(null);
      alert(`Partner '${newPartner.name}' created successfully!`);
      // Optionally, set selectedPartnerId to newPartner.id if desired
      setSelectedPartnerId(String(newPartner.id));
    },
    onError: (error: Error) => {
      console.error("Failed to create partner:", error);
      alert(`Error creating partner: ${error.message}`);
    },
  });

  const updatePartnerMutation = useMutation({
    mutationFn: (variables: { id: string; data: UpdatePartnerClientData }) =>
      updatePartner(variables.id, variables.data),
    onSuccess: (updatedPartner) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({
        queryKey: ["partners", String(updatedPartner.id)],
      }); // Use String() for consistency
      setIsAddEditPartnerModalOpen(false);
      setEditingPartnerData(null);
      alert(`Partner '${updatedPartner.name}' updated successfully!`);
    },
    onError: (error: Error) => {
      console.error("Failed to update partner:", error);
      alert(`Error updating partner: ${error.message}`);
    },
  });

  const deletePartnerMutation = useMutation({
    mutationFn: deletePartner,
    onSuccess: (response, deletedPartnerId) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      // queryClient.invalidateQueries({ queryKey: ['goods'] }); // If goods list depends on partner links
      alert(
        response.message || `Partner ${deletedPartnerId} deleted successfully!`
      );
      if (selectedPartnerId === deletedPartnerId) {
        setSelectedPartnerId(null); // Clear selection if deleted partner was selected
      }
    },
    onError: (error: Error, deletedPartnerId) => {
      console.error(`Failed to delete partner ${deletedPartnerId}:`, error);
      alert(`Error deleting partner: ${error.message}`);
    },
  });

  // Goods Mutations
  const createGoodMutation = useMutation({
    mutationFn: createGood,
    onSuccess: (newGood) => {
      queryClient.invalidateQueries({
        queryKey: ["goods", goodsQueryKeyParamsStructure],
      }); // Use the dynamic key
      setIsAddEditGoodModalOpen(false);
      setEditingGoodData(null);
      alert(`Good/Service '${newGood.label}' created successfully!`);
      setSelectedGoodsId(String(newGood.id)); // Select the new good
    },
    onError: (error: Error) => {
      console.error("Failed to create good/service:", error);
      alert(`Error creating good/service: ${error.message}`);
    },
  });

  const updateGoodMutation = useMutation({
    mutationFn: (variables: { id: string; data: UpdateGoodClientData }) =>
      updateGood(variables.id, variables.data),
    onSuccess: (updatedGood) => {
      queryClient.invalidateQueries({
        queryKey: ["goods", goodsQueryKeyParamsStructure],
      });
      queryClient.invalidateQueries({
        queryKey: ["goods", String(updatedGood.id)],
      }); // If fetching single good
      setIsAddEditGoodModalOpen(false);
      setEditingGoodData(null);
      alert(`Good/Service '${updatedGood.label}' updated successfully!`);
    },
    onError: (error: Error) => {
      console.error("Failed to update good/service:", error);
      alert(`Error updating good/service: ${error.message}`);
    },
  });

  const deleteGoodMutation = useMutation({
    mutationFn: deleteGood,
    onSuccess: (response, deletedGoodId) => {
      queryClient.invalidateQueries({
        queryKey: ["goods", goodsQueryKeyParamsStructure],
      });
      alert(
        response.message ||
          `Good/Service ${deletedGoodId} deleted successfully!`
      );
      if (selectedGoodsId === deletedGoodId) {
        setSelectedGoodsId(null);
      }
    },
    onError: (error: Error, deletedGoodId) => {
      console.error(`Failed to delete good/service ${deletedGoodId}:`, error);
      alert(`Error deleting good/service: ${error.message}`);
    },
  });

  const createJPLMutation = useMutation({
    mutationFn: createJournalPartnerLink,
    onSuccess: (newLink) => {
      // Primarily handle query invalidation and perhaps a generic notification
      queryClient.invalidateQueries({
        queryKey: ["partners", partnerQueryKeyParamsStructure],
      });
      queryClient.invalidateQueries({
        queryKey: ["flatJournalsFilteredByPartner", newLink.partnerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["partnerJournalLinks", newLink.partnerId],
      }); // For Unlink modal list
      // Alerting can be done here or, more flexibly, in the specific calling handlers
      // console.log(`JPL created: Partner ${newLink.partnerId} to Journal ${newLink.journalId}.`);
    },
    onError: (error: Error) => {
      console.error("Failed to create journal-partner link:", error);
      alert(`Error linking partner to journal: ${error.message}`); // Generic error
    },
  });

  const deleteJPLMutation = useMutation({
    mutationFn: deleteJournalPartnerLink,
    onSuccess: (data, deletedLinkId) => {
      alert(data.message || `Link ${deletedLinkId} unlinked successfully!`);
      queryClient.invalidateQueries({
        queryKey: ["partnerJournalLinks", partnerForUnlinking?.id],
      });
      // Potentially invalidate partner/goods queries if their data depends on these links
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
    onError: (error: Error, deletedLinkId) => {
      console.error(`Failed to unlink ${deletedLinkId}:`, error);
      alert(`Error unlinking: ${error.message}`);
    },
  });

  // +++ Journal-Good Link Mutations +++
  const createJGLMutation = useMutation({
    // JGL = Journal Good Link
    mutationFn: createJournalGoodLink,
    onSuccess: (newLink) => {
      alert(
        `Successfully linked Good ${newLink.goodId} to Journal ${newLink.journalId}.`
      );
      // Invalidate queries that depend on this link.
      // e.g., if Goods slider filters by journal or Unlink modal's list
      queryClient.invalidateQueries({ queryKey: ["goods"] });
      queryClient.invalidateQueries({
        queryKey: ["goodJournalLinks", newLink.goodId],
      });
      // Potentially close the "LinkGoodToJournalsModal" if it's still open
      // setIsLinkGoodToJournalsModalOpen(false); // Or handle in its own submit logic
    },
    onError: (error: Error) => {
      console.error("Failed to create journal-good link:", error);
      alert(`Error linking good to journal: ${error.message}`);
    },
  });

  const deleteJGLMutation = useMutation({
    mutationFn: deleteJournalGoodLink,
    onSuccess: (data, deletedLinkId) => {
      alert(
        data.message ||
          `Journal-Good link ${deletedLinkId} unlinked successfully!`
      );
      queryClient.invalidateQueries({
        queryKey: ["goodJournalLinks", goodForUnlinking?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["goods"] }); // If goods list depends on these links
    },
    onError: (error: Error, deletedLinkId) => {
      console.error(`Failed to unlink Journal-Good ${deletedLinkId}:`, error);
      alert(`Error unlinking good from journal: ${error.message}`);
    },
  });

  const createJPGLMutation = useMutation<
    JournalPartnerGoodLinkClient, // Expected success response type
    Error, // Error type
    CreateJournalPartnerGoodLinkClientData // Variables type
  >({
    mutationFn: createJournalPartnerGoodLink,
    onSuccess: (newLink) => {
      console.log("Successfully created 3-way link:", newLink);
      alert(
        `Good linked to Journal ${
          newLink.journalPartnerLink?.journal?.name ||
          newLink.journalPartnerLinkId
        } and Partner ${
          newLink.journalPartnerLink?.partner?.name ||
          newLink.journalPartnerLink?.partnerId
        } successfully!`
      );
      // Invalidate queries that display these links or goods filtered by them
      // For instance, if goodsQuery depends on these 3-way links for J-P-G:
      queryClient.invalidateQueries({
        queryKey: ["goods", goodsQueryKeyParamsStructure],
      });
      // Potentially a specific query for JPGLs if you display them directly
      if (newLink.journalPartnerLinkId) {
        queryClient.invalidateQueries({
          queryKey: ["jpgLinks", newLink.journalPartnerLinkId],
        });
      }
    },
    onError: (error: Error) => {
      console.error("Failed to create 3-way link:", error);
      alert(`Error creating 3-way link: ${error.message}`);
    },
  });

  const deleteJPGLMutation = useMutation<
    { message: string }, // Expected success response type from your API
    Error, // Error type
    string // Variables type (the linkId to delete, which is a string client-side)
  >({
    mutationFn: (linkId: string) => deleteJournalPartnerGoodLink(linkId), // Pass string ID
    onSuccess: (data, deletedLinkId) => {
      console.log(
        `Successfully deleted 3-way link ${deletedLinkId}:`,
        data.message
      );
      alert(
        data.message || `3-way link ${deletedLinkId} unlinked successfully!`
      );

      // --- IMPORTANT: Invalidate queries ---
      // 1. Invalidate the goods query if its content depends on these 3-way links.
      //    This is crucial if the goods list should refresh after a link is removed.
      queryClient.invalidateQueries({
        queryKey: ["goods", goodsQueryKeyParamsStructure],
      });

      // 2. Invalidate the query that fetches the list of existing JPGLs for the modal,
      //    so if the modal is reopened, it shows the updated list.
      //    The key for this would be ['jpgLinksForContext', goodId, journalId] if we follow that pattern.
      //    We can make this more dynamic by invalidating based on the context used to open the modal.
      if (goodForUnlinkingContext && journalForUnlinkingContext) {
        queryClient.invalidateQueries({
          queryKey: [
            "jpgLinksForContext",
            goodForUnlinkingContext.id,
            journalForUnlinkingContext.id,
          ],
        });
      }
      // Add any other relevant query invalidations.
    },
    onError: (error: Error, linkId) => {
      console.error(`Failed to delete 3-way link ${linkId}:`, error);
      alert(`Error unlinking 3-way link: ${error.message}`);
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
      setSelectedPartnerId(null);
      setSelectedGoodsId(null);
    },
    [hookHandleSelectTopLevelJournal, currentHierarchy]
  );

  const handleToggleLevel2JournalIdWrapper = useCallback(
    (level2IdToToggle: string) => {
      hookHandleToggleLevel2JournalId(level2IdToToggle, currentHierarchy);
      console.log(
        "L2 Journal toggled, resetting downstream Partner & Goods selections."
      );
      setSelectedPartnerId(null);
      setSelectedGoodsId(null);
    },
    [hookHandleToggleLevel2JournalId, currentHierarchy]
  );

  const handleToggleLevel3JournalIdWrapper = useCallback(
    (level3IdToToggle: string) => {
      hookHandleToggleLevel3JournalId(level3IdToToggle, currentHierarchy);
      console.log(
        "L3 Journal toggled, resetting downstream Partner & Goods selections."
      );
      setSelectedPartnerId(null);
      setSelectedGoodsId(null);
    },
    [hookHandleToggleLevel3JournalId, currentHierarchy]
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
      setSelectedPartnerId(null);
      setSelectedGoodsId(null);
    },
    [hookHandleNavigateContextDown, currentHierarchy]
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

  // Partner Options & Modal Callbacks
  const handleOpenPartnerOptionsMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setPartnerOptionsMenuAnchorEl(event.currentTarget);
      setIsPartnerOptionsMenuOpen(true);
    },
    []
  );

  const handleClosePartnerOptionsMenu = useCallback(() => {
    setIsPartnerOptionsMenuOpen(false);
    setPartnerOptionsMenuAnchorEl(null);
  }, []);

  const handleOpenAddPartnerModal = useCallback(() => {
    setEditingPartnerData(null); // Clear any editing data
    setIsAddEditPartnerModalOpen(true);
    handleClosePartnerOptionsMenu(); // Close options menu
  }, [handleClosePartnerOptionsMenu]);

  // Corrected: handleOpenEditPartnerModal
  const handleOpenEditPartnerModal = useCallback(() => {
    if (selectedPartnerId && partnerQuery.data) {
      // Check partnerQuery.data
      const partnerToEdit = partnerQuery.data.find(
        (p) => p.id === selectedPartnerId
      );
      if (partnerToEdit) {
        setEditingPartnerData(partnerToEdit);
        setIsAddEditPartnerModalOpen(true);
      } else {
        alert("Selected partner data not found.");
      }
    }
    handleClosePartnerOptionsMenu();
  }, [selectedPartnerId, partnerQuery.data, handleClosePartnerOptionsMenu]);

  const handleCloseAddEditPartnerModal = useCallback(() => {
    setIsAddEditPartnerModalOpen(false);
    setEditingPartnerData(null); // Clear editing data on close
  }, []);

  const handleAddOrUpdatePartnerSubmit = useCallback(
    (
      dataFromModal: CreatePartnerClientData | UpdatePartnerClientData,
      partnerIdToUpdate?: string
    ) => {
      if (partnerIdToUpdate && editingPartnerData) {
        // Edit mode
        // Explicitly pick only the fields allowed by the backend's updatePartnerSchema
        const payloadForUpdate: UpdatePartnerClientData = {
          name: dataFromModal.name, // Name is usually part of UpdatePartnerClientData
          notes: dataFromModal.notes,
          logoUrl: (dataFromModal as any).logoUrl, // Cast if not strictly in UpdatePartnerClientData but present in form
          photoUrl: (dataFromModal as any).photoUrl,
          isUs: (dataFromModal as any).isUs,
          registrationNumber: (dataFromModal as any).registrationNumber,
          taxId: (dataFromModal as any).taxId,
          bioFatherName: (dataFromModal as any).bioFatherName,
          bioMotherName: (dataFromModal as any).bioMotherName,
          additionalDetails: (dataFromModal as any).additionalDetails,
          // DO NOT include: id, partnerType, createdAt, updatedAt
        };

        // Remove undefined properties so they don't overwrite existing values with null if not intended
        // (unless your backend schema explicitly expects null for clearing fields)
        Object.keys(payloadForUpdate).forEach((keyStr) => {
          const key = keyStr as keyof UpdatePartnerClientData;
          if (payloadForUpdate[key] === undefined) {
            delete payloadForUpdate[key];
          }
        });

        if (Object.keys(payloadForUpdate).length === 0) {
          alert("No changes detected to save.");
          setIsAddEditPartnerModalOpen(false); // Close modal if no changes
          setEditingPartnerData(null);
          return;
        }

        updatePartnerMutation.mutate({
          id: partnerIdToUpdate,
          data: payloadForUpdate,
        });
      } else {
        // Add mode
        createPartnerMutation.mutate(dataFromModal as CreatePartnerClientData);
      }
    },
    [
      editingPartnerData,
      createPartnerMutation,
      updatePartnerMutation,
      setIsAddEditPartnerModalOpen,
      setEditingPartnerData,
    ] // Add modal setters
  );

  const handleDeleteCurrentPartner = useCallback(() => {
    if (selectedPartnerId) {
      if (
        window.confirm(
          `Are you sure you want to delete partner ${selectedPartnerId}? This might affect related documents or links.`
        )
      ) {
        deletePartnerMutation.mutate(selectedPartnerId);
      }
    }
    handleClosePartnerOptionsMenu();
  }, [selectedPartnerId, deletePartnerMutation, handleClosePartnerOptionsMenu]);

  // Goods Options & Modal Callbacks
  const handleOpenGoodsOptionsMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setGoodsOptionsMenuAnchorEl(event.currentTarget);
      setIsGoodsOptionsMenuOpen(true);
    },
    []
  );

  const handleCloseGoodsOptionsMenu = useCallback(() => {
    setIsGoodsOptionsMenuOpen(false);
    setGoodsOptionsMenuAnchorEl(null);
  }, []);

  const handleOpenAddGoodModal = useCallback(() => {
    setEditingGoodData(null);
    setIsAddEditGoodModalOpen(true);
    handleCloseGoodsOptionsMenu();
  }, [handleCloseGoodsOptionsMenu]);

  // Corrected: handleOpenEditGoodModal
  const handleOpenEditGoodModal = useCallback(() => {
    if (selectedGoodsId && goodsQuery.data) {
      // Check goodsQuery.data
      const goodToEdit = goodsQuery.data.find((g) => g.id === selectedGoodsId);
      if (goodToEdit) {
        setEditingGoodData(goodToEdit);
        setIsAddEditGoodModalOpen(true);
      } else {
        alert("Selected good/service data not found.");
      }
    }
    handleCloseGoodsOptionsMenu();
  }, [selectedGoodsId, goodsQuery.data, handleCloseGoodsOptionsMenu]);

  const handleCloseAddEditGoodModal = useCallback(() => {
    setIsAddEditGoodModalOpen(false);
    setEditingGoodData(null);
  }, []);

  const handleAddOrUpdateGoodSubmit = useCallback(
    (
      dataFromModal: CreateGoodClientData | UpdateGoodClientData,
      goodIdToUpdate?: string
    ) => {
      if (goodIdToUpdate && editingGoodData) {
        // Edit mode
        // Explicitly pick only the fields allowed by the backend's updateGoodsSchema
        const payloadForUpdate: UpdateGoodClientData = {
          label: dataFromModal.label,
          taxCodeId: (dataFromModal as any).taxCodeId, // Cast if necessary, ensure it's number or null
          typeCode: (dataFromModal as any).typeCode,
          description: (dataFromModal as any).description,
          unitCodeId: (dataFromModal as any).unitCodeId, // Cast if necessary, ensure it's number or null
          stockTrackingMethod: (dataFromModal as any).stockTrackingMethod,
          packagingTypeCode: (dataFromModal as any).packagingTypeCode,
          photoUrl: (dataFromModal as any).photoUrl,
          additionalDetails: (dataFromModal as any).additionalDetails,
          price: (dataFromModal as any).price, // Assuming price is updatable
          // DO NOT include: referenceCode, barcode (unless updatable), id, createdAt, updatedAt,
          // full taxCode object, full unitOfMeasure object, or any client-only mapped fields like 'name' or 'code'
        };

        // Remove undefined properties to only send actual changes or explicit nulls
        Object.keys(payloadForUpdate).forEach((keyStr) => {
          const key = keyStr as keyof UpdateGoodClientData;
          if (payloadForUpdate[key] === undefined) {
            delete payloadForUpdate[key];
          }
        });

        if (Object.keys(payloadForUpdate).length === 0) {
          alert("No changes detected to save for the good/service.");
          setIsAddEditGoodModalOpen(false);
          setEditingGoodData(null);
          return;
        }

        console.log("Final Payload for Good Update:", payloadForUpdate); // Log the cleaned payload
        updateGoodMutation.mutate({
          id: goodIdToUpdate,
          data: payloadForUpdate,
        });
      } else {
        // Add mode
        // Ensure dataFromModal for create matches CreateGoodClientData structure
        createGoodMutation.mutate(dataFromModal as CreateGoodClientData);
      }
    },
    [
      editingGoodData,
      createGoodMutation,
      updateGoodMutation,
      setIsAddEditGoodModalOpen,
      setEditingGoodData,
    ]
  );

  const handleDeleteCurrentGood = useCallback(() => {
    if (selectedGoodsId) {
      if (
        window.confirm(
          `Are you sure you want to delete good/service ${selectedGoodsId}?`
        )
      ) {
        deleteGoodMutation.mutate(selectedGoodsId);
      }
    }
    handleCloseGoodsOptionsMenu();
  }, [selectedGoodsId, deleteGoodMutation, handleCloseGoodsOptionsMenu]);

  // Link Partner to Journal Modal Handlers
  const handleOpenLinkPartnerToJournalModal = useCallback(() => {
    if (!selectedPartnerId) {
      alert("Please select a partner to link.");
      return;
    }
    if (
      !selectedTopLevelJournalId ||
      selectedTopLevelJournalId === ROOT_JOURNAL_ID
    ) {
      alert(
        "Please select a specific journal (not root) to link the partner to."
      );
      return;
    }
    setIsLinkPartnerModalOpen(true);
  }, [selectedPartnerId, selectedTopLevelJournalId]);

  // New handler for opening JournalModal for navigation/management
  const handleOpenJournalModalForNavigation = useCallback(() => {
    setIsJournalModalOpenForLinking(false); // Explicitly turn OFF linking mode
    setOnJournalSelectForLinkingCallback(null); // Clear any linking callback
    openJournalNavModalFromHook(); // Open the modal for navigation
  }, [openJournalNavModalFromHook]); // Dependency on the hook's open function

  // This is called FROM LinkPartnerToJournalsModal to open the main JournalModal FOR LINKING
  const handleOpenJournalSelectorForLinkModal = useCallback(
    (onSelectCallback: (journalNode: AccountNodeData) => void) => {
      setOnJournalSelectForLinkingCallback(() => onSelectCallback); // Store the linking callback
      setIsJournalModalOpenForLinking(true); // Set linking mode to TRUE

      // Explicitly turn OFF navigation mode if it happens to be on
      if (_isJournalNavModalOpen) {
        closeJournalNavModal();
      }
    },
    [_isJournalNavModalOpen, closeJournalNavModal] // Added dependencies
  );

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

  const handleCloseLinkPartnerToJournalModal = useCallback(() => {
    setIsLinkPartnerModalOpen(false);
  }, []);

  const handleCreateJournalPartnerLinkSubmit = useCallback(
    (data: CreateJournalPartnerLinkClientData) => {
      createJPLMutation.mutate(data, {
        onSuccess: (newLink) => {
          // Generic onSuccess from mutation definition runs first
          alert(
            `Successfully linked Partner ${newLink.partnerId} to Journal ${newLink.journalId}.`
          );
          setIsLinkPartnerModalOpen(false); // Close the simple modal
        },
        onError: (error: Error) => {
          // Generic onError runs, or you can have more specific error handling here
          // alert(`Specific error for simple link: ${error.message}`);
        },
      });
    },
    [
      createJPLMutation,
      queryClient,
      partnerQueryKeyParamsStructure,
      setIsLinkPartnerModalOpen,
    ] // Add setIsLinkPartnerModalOpen
  );

  // Partner-Journal Linking Modals
  const handleOpenLinkPartnerToJournalsModal = useCallback(() => {
    if (selectedPartnerId && partnerQuery.data) {
      // Check partnerQuery.data
      const partner = partnerQuery.data.find((p) => p.id === selectedPartnerId);
      if (partner) {
        setPartnerForLinking(partner);
        setIsLinkPartnerToJournalsModalOpen(true);
      } else {
        alert("Selected partner data not found.");
      }
    } else {
      alert("Please select a partner first.");
    }
  }, [selectedPartnerId, partnerQuery.data]);

  const handleCloseLinkPartnerToJournalsModal = useCallback(() => {
    setIsLinkPartnerToJournalsModalOpen(false);
    setPartnerForLinking(null);
  }, []);

  const handleCreateMultipleJPLSubmit = useCallback(
    async (linksData: CreateJournalPartnerLinkClientData[]) => {
      if (linksData.length === 0) {
        setIsLinkPartnerToJournalsModalOpen(false);
        setPartnerForLinking(null);
        return;
      }

      let successCount = 0;
      const promises = linksData.map((linkData) =>
        createJPLMutation
          .mutateAsync(linkData) // Use mutateAsync for Promise.all
          .then((newLink) => {
            successCount++;
            console.log(
              `Successfully linked Partner ${newLink.partnerId} to Journal ${newLink.journalId}.`
            );
          })
          .catch((error) => {
            console.error(
              `Failed to link a journal for partner ${linkData.partnerId}:`,
              error
            );
            // Potentially collect errors to show a summary
          })
      );

      await Promise.allSettled(promises); // Wait for all mutations to complete

      if (successCount > 0) {
        alert(
          `${successCount} of ${linksData.length} link(s) created successfully.`
        );
        // Invalidate relevant queries once after all attempts
        // The generic onSuccess of createJPLMutation already invalidates,
        // but if specific timing or additional invalidations are needed, do them here.
        // For example, if partnerForLinking changed during the modal being open:
        if (partnerForLinking) {
          queryClient.invalidateQueries({
            queryKey: ["partners", partnerQueryKeyParamsStructure],
          });
          queryClient.invalidateQueries({
            queryKey: ["flatJournalsFilteredByPartner", partnerForLinking.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["partnerJournalLinks", partnerForLinking.id],
          });
        }
      }
      if (successCount !== linksData.length) {
        alert(`Some links could not be created. Check console for details.`);
      }

      setIsLinkPartnerToJournalsModalOpen(false);
      setPartnerForLinking(null);
    },
    [
      createJPLMutation,
      queryClient,
      partnerQueryKeyParamsStructure,
      partnerForLinking,
      setIsLinkPartnerToJournalsModalOpen,
      setPartnerForLinking,
    ]
  );

  // Callbacks for UnlinkPartnerFromJournalsModal
  const handleOpenUnlinkModal = useCallback(() => {
    if (selectedPartnerId && partnerQuery.data) {
      // Check partnerQuery.data
      const partnerToSet = partnerQuery.data.find(
        (p) => p.id === selectedPartnerId
      );
      if (partnerToSet && partnerToSet.id) {
        setPartnerForUnlinking(partnerToSet);
        setIsUnlinkModalOpen(true);
        handleClosePartnerOptionsMenu();
      } else {
        alert("Selected partner data not found or partner ID is missing.");
        setPartnerForUnlinking(null);
        setIsUnlinkModalOpen(false);
      }
    } else {
      alert("Please select a partner first.");
    }
  }, [selectedPartnerId, partnerQuery.data, handleClosePartnerOptionsMenu]);
  const handleCloseUnlinkModal = useCallback(() => {
    setIsUnlinkModalOpen(false);
    setPartnerForUnlinking(null);
  }, []);

  const handleUnlinkSubmit = useCallback(
    (linkIdsToUnlink: string[]) => {
      if (!partnerForUnlinking) return;

      // For simplicity, deleting one by one. Could batch if backend supports.
      linkIdsToUnlink.forEach((linkId) => {
        deleteJPLMutation.mutate(linkId);
      });

      // Optionally close modal immediately or wait for all mutations (more complex)
      // If there's only one link usually, or if individual alerts are okay:
      // This will be handled by onSuccess/onError of the mutation if we want to close after each
      // Or, if we want to close after initiating all, we can do it here.
      // For now, let's assume individual alerts and potential partial success is acceptable.
      // The modal could stay open and refresh its list. Or, if we want to close it:
      // setIsUnlinkModalOpen(false); // Or defer this to when all mutations are settled.
    },
    [deleteJPLMutation, partnerForUnlinking]
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
    if (!selectedPartnerId) {
      alert("No partner selected.");
      return;
    }
    if (!selectedGoodsId) {
      // This shouldn't happen if called from GoodsOptionsMenu context, but good check.
      alert("No good selected.");
      return;
    }

    const linkData: CreateJournalPartnerGoodLinkClientData = {
      journalId: targetJournalId,
      partnerId: selectedPartnerId, // Already a string
      goodId: selectedGoodsId, // Already a string
      partnershipType: "STANDARD_TRANSACTION", // Or get this from somewhere else if dynamic
      // descriptiveText: "Linked via UI", // Optional
      // contextualTaxCodeId: null, // Optional
    };

    console.log("Attempting to create 3-way link with data:", linkData);
    createJPGLMutation.mutate(linkData);
  }, [
    effectiveSelectedJournalIds,
    selectedPartnerId,
    selectedGoodsId,
    createJPGLMutation,
    // partnershipType (if dynamic)
  ]);

  const isJAndPSelectedForJPGL = useMemo(() => {
    return effectiveSelectedJournalIds.length > 0 && !!selectedPartnerId;
  }, [effectiveSelectedJournalIds, selectedPartnerId]);

  const canLinkGoodToPartnersViaJournal = useMemo(() => {
    const journalIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
    const goodsIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);

    return (
      visibility[SLIDER_TYPES.JOURNAL] &&
      visibility[SLIDER_TYPES.GOODS] &&
      journalIndex === 0 && // Journal is first
      goodsIndex === 1 && // Goods is second
      effectiveSelectedJournalIds.length > 0 && // A journal context exists
      !!selectedGoodsId // A good is selected
    );
  }, [sliderOrder, visibility, effectiveSelectedJournalIds, selectedGoodsId]);

  // Good-Journal Linking Modals
  const handleOpenLinkGoodToJournalsModal = useCallback(() => {
    if (selectedGoodsId && goodsQuery.data) {
      // Check goodsQuery.data
      const good = goodsQuery.data.find((g) => g.id === selectedGoodsId);
      if (good) {
        setGoodForLinking(good);
        setIsLinkGoodToJournalsModalOpen(true);
        handleCloseGoodsOptionsMenu();
      } else {
        alert("Selected good/service data not found.");
      }
    } else {
      alert("Please select a good/service first.");
    }
  }, [selectedGoodsId, goodsQuery.data, handleCloseGoodsOptionsMenu]);

  const handleCloseLinkGoodToJournalsModal = useCallback(() => {
    setIsLinkGoodToJournalsModalOpen(false);
    setGoodForLinking(null);
  }, []);

  // This will be called by LinkGoodToJournalsModal to open JournalModal for selection
  // It's identical in function to handleOpenJournalSelectorForLinkModal for partners
  const handleOpenJournalSelectorForGoodLinkModal = useCallback(
    (onSelectCallback: (journalNode: AccountNodeData) => void) => {
      setOnJournalSelectForLinkingCallback(() => onSelectCallback);
      setIsJournalModalOpenForLinking(true);
      if (_isJournalNavModalOpen) {
        closeJournalNavModal();
      }
    },
    [_isJournalNavModalOpen, closeJournalNavModal] // Reusing existing state/logic for JournalModal
  );

  const handleCreateMultipleJGLSubmit = useCallback(
    (linksData: CreateJournalGoodLinkClientData[]) => {
      linksData.forEach((linkData) => {
        createJGLMutation.mutate(linkData);
      });
      if (linksData.length > 0) {
        setIsLinkGoodToJournalsModalOpen(false); // Close after initiating
        setGoodForLinking(null);
      }
    },
    [createJGLMutation]
  );

  const handleOpenLinkGoodToPartnersViaJournalModal = useCallback(async () => {
    if (!selectedGoodsId || !goodsQuery.data) {
      alert("Please select a Good first.");
      return;
    }
    const good = goodsQuery.data.find((g) => g.id === selectedGoodsId);
    if (!good) {
      alert("Selected Good data not found.");
      return;
    }

    // Determine the targetJournalId - typically the first effective one
    // Or, if 'document creation mode' logic implies a single specific journal, use that.
    // For J-G context (Goods is 2nd after Journal), effectiveSelectedJournalIds is key.
    if (effectiveSelectedJournalIds.length === 0) {
      alert("No active Journal context found to link with.");
      return;
    }
    const targetJournalNodeId = effectiveSelectedJournalIds[0]; // Simplistic pick for now
    const targetJournalNode = findNodeById(
      currentHierarchy,
      targetJournalNodeId
    );

    if (!targetJournalNode) {
      alert(
        `Journal node for ID ${targetJournalNodeId} not found in hierarchy.`
      );
      return;
    }

    setGoodForJpgLinking(good);
    setTargetJournalForJpgLinking(targetJournalNode);
    setIsLoadingPartnersForJpgModal(true);
    setIsLinkGoodToPartnersViaJournalModalOpen(true); // Open modal while loading partners

    try {
      // Fetch partners already linked to this specific journal
      // fetchPartnersLinkedToJournals expects an array of journal IDs
      const partners = await fetchPartnersLinkedToJournals(
        [targetJournalNode.id],
        false /* includeChildren for journals - false here as we have a specific journal */
      );
      setPartnersForJpgModal(partners);
    } catch (error) {
      console.error("Error fetching partners for JPG linking modal:", error);
      alert("Could not load partners for the selected journal.");
      setPartnersForJpgModal([]); // Clear if error
    } finally {
      setIsLoadingPartnersForJpgModal(false);
    }
  }, [
    selectedGoodsId,
    goodsQuery.data,
    effectiveSelectedJournalIds,
    currentHierarchy, // For findNodeById
  ]);

  const handleCloseLinkGoodToPartnersViaJournalModal = useCallback(() => {
    setIsLinkGoodToPartnersViaJournalModalOpen(false);
    setGoodForJpgLinking(null);
    setTargetJournalForJpgLinking(null);
    setPartnersForJpgModal([]);
    setIsLoadingPartnersForJpgModal(false);
  }, []);

  const handleSubmitMultipleJPGLsFromModal = useCallback(
    (linksData: CreateJournalPartnerGoodLinkClientData[]) => {
      if (linksData.length === 0) {
        handleCloseLinkGoodToPartnersViaJournalModal();
        return;
      }
      console.log("Submitting multiple JPGLs:", linksData);
      // Mutate for each link.
      // Consider Promise.all if you want to show a single "all done" message.
      let successCount = 0;
      let errorCount = 0;

      const mutationPromises = linksData.map((linkData) =>
        createJPGLMutation
          .mutateAsync(linkData)
          .then(() => successCount++)
          .catch(() => errorCount++)
      );

      Promise.allSettled(mutationPromises).then(() => {
        if (successCount > 0) {
          alert(`${successCount} link(s) created successfully.`);
        }
        if (errorCount > 0) {
          alert(
            `${errorCount} link(s) failed to create. Check console for details.`
          );
        }
        // Invalidation is handled by individual mutation's onSuccess.
        // Or, if you need a batch invalidation after all are done:
        // queryClient.invalidateQueries({ queryKey: ['goods', goodsQueryKeyParamsStructure] });
        // if (targetJournalForJpgLinking) {
        //    queryClient.invalidateQueries({ queryKey: ['jpgLinksForJournal', targetJournalForJpgLinking.id] }); // Example
        // }
        if (successCount > 0 || linksData.length > 0) {
          // Close if any attempt was made or successful
          handleCloseLinkGoodToPartnersViaJournalModal();
        }
      });
    },
    [
      createJPGLMutation,
      handleCloseLinkGoodToPartnersViaJournalModal,
      queryClient,
      goodsQueryKeyParamsStructure,
      targetJournalForJpgLinking,
    ] // Added targetJournalForJpgLinking for potential invalidation key
  );

  // +++ Callbacks for UnlinkGoodFromJournalsModal +++
  const handleOpenUnlinkGoodModal = useCallback(() => {
    if (selectedGoodsId) {
      const good = goodsQuery?.data.find((g) => g.id === selectedGoodsId);
      if (good) {
        setGoodForUnlinking(good);
        setIsUnlinkGoodModalOpen(true);
        handleCloseGoodsOptionsMenu();
      } else {
        alert("Selected good/service data not found.");
      }
    } else {
      alert("Please select a good/service first.");
    }
  }, [selectedGoodsId, goodsQuery?.data, handleCloseGoodsOptionsMenu]);

  const handleCloseUnlinkGoodModal = useCallback(() => {
    setIsUnlinkGoodModalOpen(false);
    setGoodForUnlinking(null);
  }, []);

  const handleGoodUnlinkSubmit = useCallback(
    (linkIdsToUnlink: string[]) => {
      if (!goodForUnlinking) return;
      linkIdsToUnlink.forEach((linkId) => {
        deleteJGLMutation.mutate(linkId);
      });
    },
    [deleteJGLMutation, goodForUnlinking]
  );

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
    if (!selectedPartnerId) {
      alert("Please select a partner first.");
      return;
    }
    hookHandleStartDocumentCreation(
      selectedPartnerId,
      callbackToOpenGoodsAccordion
    );
  }, [selectedPartnerId, hookHandleStartDocumentCreation]);

  const handleFinishDocument = useCallback(() => {
    const success = hookHandleFinishDocument();
    if (!success && selectedGoodsForDocument.length === 0) {
      alert("Please select at least one good for the document.");
    } else if (!success && !lockedPartnerId) {
      alert("Error: No partner locked. Please restart.");
    }
  }, [hookHandleFinishDocument, selectedGoodsForDocument, lockedPartnerId]);

  const handleValidateDocument = useCallback(() => {
    const partnerDetails = partnerQuery.data?.find(
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
    partnerQuery.data,
    lockedPartnerId,
    selectedGoodsForDocument,
    selectedTopLevelJournalId,
    selectedLevel2JournalIds,
    selectedLevel3JournalIds,
    resetDocumentCreationState,
  ]);

  const handleOpenUnlinkGoodFromPartnersViaJournalModal =
    useCallback(async () => {
      if (!selectedGoodsId || !goodsQuery.data) {
        alert("Please select a Good first.");
        return;
      }
      const good = goodsQuery.data.find((g) => g.id === selectedGoodsId);
      if (!good) {
        alert("Selected Good data not found.");
        return;
      }

      // Determine contextJournalId based on sliderOrder
      let contextJournalNodeId: string | null = null;
      const journalSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.JOURNAL);
      const partnerSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.PARTNER);
      const goodSliderIndex = sliderOrder.indexOf(SLIDER_TYPES.GOODS);

      if (
        journalSliderIndex === 0 &&
        (goodSliderIndex === 1 || goodSliderIndex === 2)
      ) {
        // J-G... or J-P-G
        contextJournalNodeId =
          effectiveSelectedJournalIds.length > 0
            ? effectiveSelectedJournalIds[0]
            : null;
      } else if (
        partnerSliderIndex === 0 &&
        journalSliderIndex === 1 &&
        goodSliderIndex === 2
      ) {
        // P-J-G
        contextJournalNodeId = selectedJournalIdForPjgFiltering;
      }
      // Add other order checks if necessary (e.g., G-J-P if unlinking from partner options)

      if (!contextJournalNodeId) {
        alert("No active Journal context found to determine links.");
        return;
      }
      const journalNode = findNodeById(currentHierarchy, contextJournalNodeId);
      if (!journalNode) {
        alert(`Journal node for ID ${contextJournalNodeId} not found.`);
        return;
      }

      setGoodForUnlinkingContext(good);
      setJournalForUnlinkingContext(journalNode);
      setIsLoadingJpgLinksForModal(true);
      setIsUnlinkGoodFromPartnersViaJournalModalOpen(true);

      try {
        const links = await fetchJpgLinksForGoodAndJournalContext(
          good.id,
          journalNode.id
        );
        setExistingJpgLinksForModal(links);
      } catch (error) {
        console.error(
          "Error fetching existing JPGLs for unlinking modal:",
          error
        );
        alert("Could not load existing links for this context.");
        setExistingJpgLinksForModal([]);
      } finally {
        setIsLoadingJpgLinksForModal(false);
      }
    }, [
      selectedGoodsId,
      goodsQuery.data,
      sliderOrder,
      effectiveSelectedJournalIds,
      selectedJournalIdForPjgFiltering,
      currentHierarchy,
    ]);

  const handleCloseUnlinkGoodFromPartnersViaJournalModal = useCallback(() => {
    setIsUnlinkGoodFromPartnersViaJournalModalOpen(false);
    setGoodForUnlinkingContext(null);
    setJournalForUnlinkingContext(null);
    setExistingJpgLinksForModal([]);
    setIsLoadingJpgLinksForModal(false);
  }, []);

  const handleConfirmUnlinkMultipleJPGLs = useCallback(
    (linkIdsToUnlink: string[]) => {
      if (linkIdsToUnlink.length === 0) {
        handleCloseUnlinkGoodFromPartnersViaJournalModal();
        return;
      }
      // deleteJPGLMutation is already defined
      let successCount = 0;
      let errorCount = 0;
      const mutationPromises = linkIdsToUnlink.map((linkId) =>
        deleteJPGLMutation
          .mutateAsync(linkId)
          .then(() => successCount++)
          .catch(() => errorCount++)
      );
      Promise.allSettled(mutationPromises).then(() => {
        if (successCount > 0)
          alert(`${successCount} link(s) unlinked successfully.`);
        if (errorCount > 0)
          alert(`${errorCount} link(s) failed to unlink. Check console.`);
        if (successCount > 0 || linkIdsToUnlink.length > 0) {
          handleCloseUnlinkGoodFromPartnersViaJournalModal();
        }
        // Invalidation is handled by deleteJPGLMutation's onSuccess
      });
    },
    [deleteJPGLMutation, handleCloseUnlinkGoodFromPartnersViaJournalModal]
  );

  // General UI Callbacks
  const handleSwipe = useCallback(
    (sourceSliderId: string, selectedItemId: string | null) => {
      if (
        isDocumentCreationMode &&
        sourceSliderId === SLIDER_TYPES.PARTNER &&
        selectedItemId !== lockedPartnerId
      ) {
        setSelectedPartnerId(lockedPartnerId);
        return;
      }
      if (sourceSliderId === SLIDER_TYPES.PARTNER)
        setSelectedPartnerId(selectedItemId);
      else if (sourceSliderId === SLIDER_TYPES.GOODS)
        setSelectedGoodsId(selectedItemId);
      else if (sourceSliderId === SLIDER_TYPES.PROJECT)
        setSelectedProjectId(selectedItemId as string);
      else if (sourceSliderId === SLIDER_TYPES.DOCUMENT)
        setSelectedDocumentId(selectedItemId as string);
    },
    [isDocumentCreationMode, lockedPartnerId]
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
            };
          }
        case SLIDER_TYPES.PARTNER:
          return {
            data: partnersForSlider.map((p) => ({
              ...p,
              id: String(p.id),
              name: p.name,
              code: String(p.registrationNumber || p.id),
            })),
            isLoading: partnerQuery.isLoading,
            isError: partnerQuery.isError,
            error: partnerQuery.error,
            activeItemId: selectedPartnerId,
            onSlideChange: (id: string | null) =>
              handleSwipe(SLIDER_TYPES.PARTNER, id),
            isAccordionOpen: accordionTypeState[SLIDER_TYPES.PARTNER],
            onToggleAccordion: () => toggleAccordion(SLIDER_TYPES.PARTNER),
            isLocked: isDocumentCreationMode && lockedPartnerId !== null,
            isDocumentCreationMode: isDocumentCreationMode,
            onOpenModal: handleOpenPartnerOptionsMenu,
          };
        case SLIDER_TYPES.GOODS:
          const goodsDataForDisplay = goodsForSlider.map((g) => ({
            ...g,
            id: String(g.id),
            name: g.label,
            code: g.referenceCode || String(g.id),
            unit_code: g.unitOfMeasure?.code || (g as any).unit || "N/A",
          }));
          return {
            data: goodsDataForDisplay,
            isLoading: goodsQuery.isLoading,
            isError: goodsQuery.isError,
            error: goodsQuery.error,
            activeItemId: selectedGoodsId,
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
            onOpenModal: handleOpenGoodsOptionsMenu,
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
      partnersForSlider,
      partnerQuery.isLoading,
      partnerQuery.isError,
      partnerQuery.error,
      selectedPartnerId,
      handleOpenPartnerOptionsMenu,
      handleSwipe,
      isDocumentCreationMode,
      lockedPartnerId,
      goodsForSlider,
      goodsQuery.isLoading,
      goodsQuery.isError,
      goodsQuery.error,
      selectedGoodsId,
      handleOpenGoodsOptionsMenu,
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
                        lockedPartnerId !== selectedPartnerId
                      }
                    >
                      <IoOptionsOutline />
                    </button>
                    {isPartnerSlider &&
                      isTerminalJournalActive &&
                      !isDocumentCreationMode &&
                      selectedPartnerId && (
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
                      lockedPartnerId === selectedPartnerId && (
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
        {isLinkPartnerToJournalsModalOpen && (
          <LinkPartnerToJournalsModal
            isOpen={isLinkPartnerToJournalsModalOpen}
            onClose={handleCloseLinkPartnerToJournalsModal}
            onSubmitLinks={handleCreateMultipleJPLSubmit}
            partnerToLink={partnerForLinking}
            isSubmitting={createJPLMutation.isPending}
            onOpenJournalSelector={handleOpenJournalSelectorForLinkModal}
            fullJournalHierarchy={currentHierarchy}
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
        {isConfirmationModalOpen && partnerQuery.data && (
          <DocumentConfirmationModal
            isOpen={isConfirmationModalOpen}
            onClose={closeConfirmationModal}
            onValidate={handleValidateDocument}
            partner={partnerQuery.data.find((p) => p.id === lockedPartnerId)}
            goods={selectedGoodsForDocument}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddEditPartnerModalOpen && (
          <AddEditPartnerModal
            isOpen={isAddEditPartnerModalOpen}
            onClose={handleCloseAddEditPartnerModal}
            onSubmit={handleAddOrUpdatePartnerSubmit}
            initialData={editingPartnerData}
            isSubmitting={
              createPartnerMutation.isPending || updatePartnerMutation.isPending
            }
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddEditGoodModalOpen && (
          <AddEditGoodModal
            isOpen={isAddEditGoodModalOpen}
            onClose={handleCloseAddEditGoodModal}
            onSubmit={handleAddOrUpdateGoodSubmit}
            initialData={editingGoodData}
            isSubmitting={
              createGoodMutation.isPending || updateGoodMutation.isPending
            }
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isUnlinkModalOpen && partnerForUnlinking && (
          <UnlinkPartnerFromJournalsModal
            isOpen={isUnlinkModalOpen}
            onClose={handleCloseUnlinkModal}
            partner={partnerForUnlinking}
            onUnlink={handleUnlinkSubmit}
            fetchLinksFn={() =>
              fetchJournalLinksForPartner(partnerForUnlinking!.id)
            }
            isUnlinking={deleteJPLMutation.isPending}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isLinkGoodToJournalsModalOpen && goodForLinking && (
          <LinkGoodToJournalsModal
            isOpen={isLinkGoodToJournalsModalOpen}
            onClose={handleCloseLinkGoodToJournalsModal}
            onSubmitLinks={handleCreateMultipleJGLSubmit}
            goodToLink={goodForLinking}
            isSubmitting={createJGLMutation.isPending}
            onOpenJournalSelector={handleOpenJournalSelectorForGoodLinkModal}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isUnlinkGoodModalOpen && goodForUnlinking && (
          <UnlinkGoodFromJournalsModal
            isOpen={isUnlinkGoodModalOpen}
            onClose={handleCloseUnlinkGoodModal}
            good={goodForUnlinking}
            onUnlink={handleGoodUnlinkSubmit}
            fetchLinksFn={() =>
              fetchJournalLinksForGood(String(goodForUnlinking!.id))
            }
            isUnlinking={deleteJGLMutation.isPending}
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
        {isLinkGoodToPartnersViaJournalModalOpen &&
          goodForJpgLinking &&
          targetJournalForJpgLinking && (
            <LinkGoodToPartnersViaJournalModal
              isOpen={isLinkGoodToPartnersViaJournalModalOpen}
              onClose={handleCloseLinkGoodToPartnersViaJournalModal}
              onSubmitLinks={handleSubmitMultipleJPGLsFromModal}
              goodToLink={goodForJpgLinking}
              targetJournal={targetJournalForJpgLinking}
              availablePartners={
                isLoadingPartnersForJpgModal ? [] : partnersForJpgModal
              } // Pass empty if loading
              isSubmitting={
                isLoadingPartnersForJpgModal || createJPGLMutation.isPending
              } // Modal shows its own loading for partners list, mutation for submit
            />
          )}
      </AnimatePresence>
      <AnimatePresence>
        {isUnlinkGoodFromPartnersViaJournalModalOpen &&
          goodForUnlinkingContext &&
          journalForUnlinkingContext && (
            <UnlinkGoodFromPartnersViaJournalModal
              isOpen={isUnlinkGoodFromPartnersViaJournalModalOpen}
              onClose={handleCloseUnlinkGoodFromPartnersViaJournalModal}
              onConfirmUnlink={handleConfirmUnlinkMultipleJPGLs}
              goodToUnlink={goodForUnlinkingContext}
              contextJournal={journalForUnlinkingContext}
              existingLinks={existingJpgLinksForModal}
              isSubmitting={
                deleteJPGLMutation.isPending || isLoadingJpgLinksForModal
              }
              isLoadingLinks={isLoadingJpgLinksForModal}
            />
          )}
      </AnimatePresence>

      <PartnerOptionsMenu
        isOpen={isPartnerOptionsMenuOpen}
        onClose={handleClosePartnerOptionsMenu}
        anchorEl={partnerOptionsMenuAnchorEl}
        selectedPartnerId={selectedPartnerId}
        onAdd={handleOpenAddPartnerModal}
        onEdit={handleOpenEditPartnerModal}
        onDelete={handleDeleteCurrentPartner}
        onLinkToJournals={handleOpenLinkPartnerToJournalsModal}
        onUnlinkFromJournals={handleOpenUnlinkModal}
      />
      <GoodsOptionsMenu
        isOpen={isGoodsOptionsMenuOpen}
        onClose={handleCloseGoodsOptionsMenu}
        anchorEl={goodsOptionsMenuAnchorEl}
        selectedGoodsId={selectedGoodsId}
        onAdd={handleOpenAddGoodModal}
        onEdit={handleOpenEditGoodModal}
        onDelete={handleDeleteCurrentGood}
        // 2-Way Good-Journal Links
        onLinkToJournals={handleOpenLinkGoodToJournalsModal}
        onUnlinkFromJournals={handleOpenUnlinkGoodModal}
        // --- 3-Way JPGL MODAL-BASED LINKING ---
        // Prop name in GoodsOptionsMenu: onOpenLinkGoodToPartnersModal
        // Handler in page.tsx: handleOpenLinkGoodToPartnersViaJournalModal
        // Condition in page.tsx: canLinkGoodToPartnersViaJournal
        onOpenLinkGoodToPartnersModal={
          // Renamed for clarity in GoodsOptionsMenu component
          canLinkGoodToPartnersViaJournal // This is the boolean condition from page.tsx
            ? handleOpenLinkGoodToPartnersViaJournalModal
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
            ? handleOpenUnlinkGoodFromPartnersViaJournalModal
            : undefined
        }
        canOpenUnlinkGoodFromPartnersModal={canUnlinkGoodFromPartnersViaJournal} // Renamed for clarity
      />
    </div>
  );
}
