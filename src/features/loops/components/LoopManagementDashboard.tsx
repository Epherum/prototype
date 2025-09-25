//src/features/loops/components/LoopManagementDashboard.tsx
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IoAdd,
  IoSearch,
  IoFilterSharp,
  IoEye,
  IoCreate,
  IoTrash,
  IoPlay,
  IoPause,
  IoDocumentOutline,
  IoArrowBack
} from "react-icons/io5";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoopWithConnections } from "@/lib/schemas/loop.schema";
import { fetchLoops, deleteLoop, updateLoop } from "@/services/clientLoopService";
import { fetchJournalsForSelection } from "@/services/clientJournalService";
import { useAppStore } from "@/store/appStore";
import LoopVisualization from "./LoopVisualization";
import { useRouter } from "next/navigation";
import styles from "./LoopManagementDashboard.module.css";

interface LoopManagementDashboardProps {
  onCreateLoop: () => void;
  onEditLoop: (loop: LoopWithConnections) => void;
  onViewLoopDetails: (loop: LoopWithConnections) => void;
}

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "DRAFT";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All Loops" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DRAFT", label: "Draft" },
];

const LoopManagementDashboard: React.FC<LoopManagementDashboardProps> = ({
  onCreateLoop,
  onEditLoop,
  onViewLoopDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<"name" | "createdAt" | "updatedAt">("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // State for managing loop card interactions
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedJournalsPerLoop, setSelectedJournalsPerLoop] = useState<Record<string, string[]>>({});

  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);
  const router = useRouter();

  // Fetch loops with filtering
  const {
    data: loops = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["loops", statusFilter === "ALL" ? undefined : statusFilter, searchTerm],
    queryFn: () => fetchLoops(
      statusFilter === "ALL" ? undefined : statusFilter,
      searchTerm || undefined
    ),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch journals for loop path display
  const { data: allJournals = [] } = useQuery({
    queryKey: ["journals", "selection", user.restrictedTopLevelJournalId],
    queryFn: () => fetchJournalsForSelection(user.restrictedTopLevelJournalId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Create journal lookup map
  const journalMap = useMemo(() => {
    return allJournals.reduce((acc, journal) => {
      acc[journal.id] = journal;
      return acc;
    }, {} as Record<string, any>);
  }, [allJournals]);

  // Delete loop mutation
  const deleteLoopMutation = useMutation({
    mutationFn: deleteLoop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loops"] });
    },
  });

  // Update loop status mutation
  const updateLoopMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      updateLoop(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loops"] });
    },
  });

  // Filter and sort loops
  const filteredAndSortedLoops = useMemo(() => {
    let filtered = [...loops];

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "createdAt":
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case "updatedAt":
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [loops, sortBy, sortOrder]);

  const handleDeleteLoop = (loop: LoopWithConnections) => {
    if (window.confirm(`Are you sure you want to delete the loop "${loop.name}"? This action cannot be undone.`)) {
      deleteLoopMutation.mutate(loop.id);
    }
  };

  const handleToggleStatus = (loop: LoopWithConnections) => {
    const newStatus = loop.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    updateLoopMutation.mutate({
      id: loop.id,
      updates: { status: newStatus }
    });
  };

  // Remove the text-based path function since we'll use visual diagrams instead

  const handleGoBack = () => {
    router.push('/');
  };

  // Card expansion handlers
  const toggleCardExpanded = (loopId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(loopId)) {
        newSet.delete(loopId);
      } else {
        newSet.add(loopId);
      }
      return newSet;
    });
  };

  // Journal selection handlers
  const handleJournalSelect = (loopId: string, journalId: string) => {
    setSelectedJournalsPerLoop(prev => {
      const currentSelection = prev[loopId] || [];
      let newSelection: string[];

      // For swapping functionality, we always want multi-select behavior up to 2 selections
      if (currentSelection.includes(journalId)) {
        // If already selected, deselect it
        newSelection = currentSelection.filter(id => id !== journalId);
      } else {
        // If not selected, add it to selection
        newSelection = [...currentSelection, journalId];
      }

      // Limit to 2 selections for swapping
      if (newSelection.length > 2) {
        newSelection = [newSelection[newSelection.length - 2], newSelection[newSelection.length - 1]];
      }

      return {
        ...prev,
        [loopId]: newSelection,
      };
    });

    // Auto-expand card when journals are selected
    if (!expandedCards.has(loopId)) {
      setExpandedCards(prev => new Set([...prev, loopId]));
    }
  };

  const handleSwapJournals = async (loopId: string, journalId1: string, journalId2: string) => {
    const loop = loops.find(l => l.id === loopId);
    if (!loop) return;

    // Get current journal order from loop connections
    const sortedConnections = [...loop.journalConnections].sort((a, b) => a.sequence - b.sequence);
    const currentJournalIds = sortedConnections.map(conn => conn.fromJournalId);

    // Find positions of the two journals to swap
    const pos1 = currentJournalIds.indexOf(journalId1);
    const pos2 = currentJournalIds.indexOf(journalId2);

    if (pos1 === -1 || pos2 === -1) {
      console.error('Journals not found in loop');
      return;
    }

    // Create new journal order with swapped positions
    const newJournalIds = [...currentJournalIds];
    newJournalIds[pos1] = journalId2;
    newJournalIds[pos2] = journalId1;

    try {
      // Update the loop with new journal order
      await updateLoopMutation.mutateAsync({
        id: loopId,
        updates: { journalIds: newJournalIds }
      });

      // Clear selections after successful swap
      setSelectedJournalsPerLoop(prev => ({
        ...prev,
        [loopId]: [],
      }));
    } catch (error) {
      console.error('Failed to swap journals:', error);
      // Could add a toast notification here for better UX
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return styles.statusBadgeActive;
      case "INACTIVE":
        return styles.statusBadgeInactive;
      case "DRAFT":
        return styles.statusBadgeDraft;
      default:
        return styles.statusBadgeDefault;
    }
  };

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p>Error loading loops: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* Dashboard Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            onClick={handleGoBack}
            className={styles.backButton}
            title="Back to Main Page"
          >
            <IoArrowBack />
          </button>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>Journal Loops</h1>
            <p className={styles.subtitle}>
              Manage closed accounting circuits and journal-to-journal transaction flows
            </p>
          </div>
        </div>
        <button
          onClick={onCreateLoop}
          className={styles.createButton}
          disabled={isLoading}
        >
          <IoAdd />
          Create New Loop
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className={styles.controls}>
        <div className={styles.searchContainer}>
          <IoSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search loops by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterContainer}>
          <IoFilterSharp className={styles.filterIcon} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={styles.filterSelect}
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.sortContainer}>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split("-");
              setSortBy(field as any);
              setSortOrder(order as any);
            }}
            className={styles.sortSelect}
          >
            <option value="updatedAt-desc">Latest Updated</option>
            <option value="createdAt-desc">Recently Created</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="createdAt-asc">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Loop Cards Grid */}
      <div className={styles.loopsGrid}>
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={styles.loadingState}
            >
              <div className={styles.loadingSpinner}></div>
              <p>Loading loops...</p>
            </motion.div>
          ) : filteredAndSortedLoops.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={styles.emptyState}
            >
              <IoDocumentOutline className={styles.emptyIcon} />
              <h3>No Loops Found</h3>
              <p>
                {searchTerm || statusFilter !== "ALL"
                  ? "No loops match your current filters."
                  : "Create your first journal loop to get started."}
              </p>
              {!searchTerm && statusFilter === "ALL" && (
                <button onClick={onCreateLoop} className={styles.emptyCreateButton}>
                  <IoAdd />
                  Create New Loop
                </button>
              )}
            </motion.div>
          ) : (
            filteredAndSortedLoops.map((loop, index) => (
              <motion.div
                key={loop.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className={styles.loopCard}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderLeft}>
                    <h3 className={styles.loopName}>{loop.name}</h3>
                    <div className={`${styles.statusBadge} ${getStatusBadgeClass(loop.status)}`}>
                      {loop.status}
                    </div>
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      onClick={() => onViewLoopDetails(loop)}
                      className={styles.actionButton}
                      title="View Details"
                    >
                      <IoEye />
                    </button>
                    <button
                      onClick={() => onEditLoop(loop)}
                      className={styles.actionButton}
                      title="Edit Loop"
                    >
                      <IoCreate />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(loop)}
                      className={styles.actionButton}
                      title={loop.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      disabled={updateLoopMutation.isPending}
                    >
                      {loop.status === "ACTIVE" ? <IoPause /> : <IoPlay />}
                    </button>
                    <button
                      onClick={() => handleDeleteLoop(loop)}
                      className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                      title="Delete Loop"
                      disabled={deleteLoopMutation.isPending}
                    >
                      <IoTrash />
                    </button>
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.loopVisualization}>
                    <LoopVisualization
                      loop={loop}
                      journalMap={journalMap}
                      compact={true}
                      className={styles.cardVisualization}
                      selectedJournalIds={selectedJournalsPerLoop[loop.id] || []}
                      onJournalSelect={(journalId) =>
                        handleJournalSelect(loop.id, journalId)
                      }
                      onSwapJournals={(journalId1, journalId2) =>
                        handleSwapJournals(loop.id, journalId1, journalId2)
                      }
                      allowSwapping={true}
                    />
                  </div>

                  {loop.description && (
                    <div className={styles.loopDescription}>
                      {loop.description}
                    </div>
                  )}
                </div>

                {/* Expandable Details Section */}
                <AnimatePresence>
                  {expandedCards.has(loop.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className={styles.cardExpandedDetails}
                    >
                      <div className={styles.expandedContent}>
                        <h4 className={styles.expandedTitle}>Journal Details</h4>
                        <div className={styles.journalDetailsList}>
                          {loop.journalConnections
                            .sort((a, b) => a.sequence - b.sequence)
                            .map((connection, index) => {
                              const journalId = connection.fromJournalId;
                              const isSelected = (selectedJournalsPerLoop[loop.id] || []).includes(journalId);
                              const journal = allJournals.find(j => j.id === journalId);

                              return (
                                <motion.div
                                  key={connection.id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  className={`${styles.journalDetailItem} ${isSelected ? styles.selectedDetailItem : ''}`}
                                  onClick={() => {
                                    handleJournalSelect(loop.id, journalId);
                                  }}
                                >
                                  <div className={styles.journalDetailHeader}>
                                    <span className={styles.journalSequence}>{index + 1}.</span>
                                    <span className={styles.journalName}>
                                      {journal?.name || `Journal ${journalId}`}
                                    </span>
                                    <span className={styles.journalCode}>
                                      {journal?.code || journalId}
                                    </span>
                                    {journal?.isTerminal && (
                                      <span className={styles.terminalBadge}>T</span>
                                    )}
                                  </div>
                                  <div className={styles.journalConnections}>
                                    <span className={styles.connectionLabel}>
                                      Connects to: {connection.toJournal?.name || connection.toJournalId}
                                    </span>
                                  </div>
                                </motion.div>
                              );
                            })}
                        </div>

                        {/* Selection Help Text */}
                        {(selectedJournalsPerLoop[loop.id] || []).length > 0 && (
                          <div className={styles.selectionHelp}>
                            <p>
                              {(selectedJournalsPerLoop[loop.id] || []).length === 1
                                ? "Select another journal to swap positions"
                                : `${(selectedJournalsPerLoop[loop.id] || []).length} journals selected - click swap button to reorder`
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className={styles.cardFooter}>
                  <div className={styles.cardMeta}>
                    <span className={styles.metaItem}>
                      {loop.journalConnections.length} journals
                    </span>
                    <span className={styles.metaItem}>
                      Updated {new Date(loop.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleCardExpanded(loop.id)}
                    className={styles.expandButton}
                    title={expandedCards.has(loop.id) ? "Collapse details" : "Expand details"}
                  >
                    <IoDocumentOutline />
                    {expandedCards.has(loop.id) ? "Less" : "More"}
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LoopManagementDashboard;