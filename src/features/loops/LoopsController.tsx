//src/features/loops/LoopsController.tsx
import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { LoopWithConnections } from "@/lib/schemas/loop.schema";
import LoopManagementDashboard from "./components/LoopManagementDashboard";
import LoopDetailsModal from "./components/LoopDetailsModal";
import LoopBuilderModal from "./components/LoopBuilderModal";

interface LoopsControllerProps {
  className?: string;
}

const LoopsController: React.FC<LoopsControllerProps> = ({ className }) => {
  const [selectedLoop, setSelectedLoop] = useState<LoopWithConnections | null>(null);
  const [editingLoop, setEditingLoop] = useState<LoopWithConnections | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const handleCreateLoop = () => {
    setEditingLoop(null);
    setShowCreateModal(true);
  };

  const handleEditLoop = (loop: LoopWithConnections) => {
    setEditingLoop(loop);
    setShowCreateModal(true);
  };

  const handleViewLoopDetails = (loop: LoopWithConnections) => {
    setSelectedLoop(loop);
    setShowDetailsModal(true);
  };

  const handleCloseModals = () => {
    setShowCreateModal(false);
    setShowDetailsModal(false);
    setSelectedLoop(null);
    setEditingLoop(null);
  };

  const handleLoopSuccess = (loop: LoopWithConnections) => {
    // Optionally show the newly created/updated loop details
    setSelectedLoop(loop);
    setShowDetailsModal(true);
  };

  return (
    <div className={className}>
      <LoopManagementDashboard
        onCreateLoop={handleCreateLoop}
        onEditLoop={handleEditLoop}
        onViewLoopDetails={handleViewLoopDetails}
      />

      <AnimatePresence>
        {/* Loop Details Modal */}
        {showDetailsModal && selectedLoop && (
          <LoopDetailsModal
            loop={selectedLoop}
            isOpen={showDetailsModal}
            onClose={handleCloseModals}
            onEdit={handleEditLoop}
          />
        )}

        {/* Loop Builder Modal */}
        {showCreateModal && (
          <LoopBuilderModal
            isOpen={showCreateModal}
            onClose={handleCloseModals}
            editingLoop={editingLoop}
            onSuccess={handleLoopSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoopsController;