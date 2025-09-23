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
      acc[journal.id] = journal.name;
      return acc;
    }, {} as Record<string, string>);
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
                    />
                  </div>

                  {loop.description && (
                    <div className={styles.loopDescription}>
                      {loop.description}
                    </div>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <div className={styles.cardMeta}>
                    <span className={styles.metaItem}>
                      {loop.journalConnections.length} journals
                    </span>
                    <span className={styles.metaItem}>
                      Updated {new Date(loop.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
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