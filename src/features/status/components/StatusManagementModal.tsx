// src/features/status/components/StatusManagementModal.tsx

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IoClose, IoAdd, IoTrash, IoPencil } from "react-icons/io5";
import { z } from "zod";

import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./StatusManagementModal.module.css";
import { useStatusManagement } from "../hooks/useStatusManagement";

// Validation schema for status form
const statusSchema = z.object({
  name: z.string().min(1, "Status name is required").max(50, "Status name must be 50 characters or less"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex code").optional(),
  displayOrder: z.number().int().min(0).optional(),
});

type StatusFormData = z.infer<typeof statusSchema>;

interface StatusManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StatusManagementModal: React.FC<StatusManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  const {
    statuses,
    isLoading,
    createStatus,
    updateStatus,
    deleteStatus,
    checkStatusUsage,
    isCreating,
    isUpdating,
    isDeleting,
  } = useStatusManagement();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm<StatusFormData>({
    resolver: zodResolver(statusSchema),
  });

  // Handle form submission for create/update
  const handleFormSubmit = async (data: StatusFormData) => {
    try {
      if (editingStatus && data.name) {
        await updateStatus.mutateAsync({ 
          id: editingStatus, 
          name: data.name,
          description: data.description,
          color: data.color,
          displayOrder: data.displayOrder || 0 
        });
      } else if (data.name) {
        await createStatus.mutateAsync({
          name: data.name,
          description: data.description,
          color: data.color,
          displayOrder: data.displayOrder || 0
        });
      }
      handleCancelForm();
    } catch (error) {
      console.error("Error saving status:", error);
    }
  };

  // Handle delete with usage check
  const handleDelete = async (statusId: string) => {
    try {
      const usage = await checkStatusUsage(statusId);
      
      if (usage.totalUsage > 0) {
        alert(
          `Cannot delete this status. It is currently used by:\n` +
          `• ${usage.partners} partners\n` +
          `• ${usage.goods} goods/services\n` +
          `• ${usage.documents} documents`
        );
        return;
      }

      if (confirm("Are you sure you want to delete this status?")) {
        await deleteStatus.mutateAsync(statusId);
      }
    } catch (error) {
      console.error("Error deleting status:", error);
    }
  };

  // Handle edit
  const handleEdit = (status: any) => {
    setEditingStatus(status.id);
    setShowForm(true);
    reset({
      name: status.name,
      description: status.description || "",
      color: status.color || "#6366f1",
      displayOrder: status.displayOrder || 0,
    });
  };

  // Handle add new
  const handleAddNew = () => {
    setEditingStatus(null);
    setShowForm(true);
    reset({
      name: "",
      description: "",
      color: "#6366f1",
      displayOrder: 0,
    });
  };

  // Cancel form
  const handleCancelForm = () => {
    setShowForm(false);
    setEditingStatus(null);
    reset();
  };

  // Handle modal close
  const handleClose = () => {
    handleCancelForm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={baseStyles.modalOverlay}
          onClick={handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={`${baseStyles.modalContent} ${styles.statusModalContent}`}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
          >
            <button
              className={baseStyles.modalCloseButton}
              onClick={handleClose}
              aria-label="Close modal"
            >
              <IoClose />
            </button>

            <h2 className={baseStyles.modalTitle}>Manage Status Options</h2>

            <div className={styles.modalBody}>
              {/* Status List */}
              <div className={styles.statusList}>
                <div className={styles.statusListHeader}>
                  <h3>Current Statuses</h3>
                  {!showForm && (
                    <button
                      className={styles.addButton}
                      onClick={handleAddNew}
                      disabled={isLoading}
                    >
                      <IoAdd /> Add Status
                    </button>
                  )}
                </div>

                {isLoading ? (
                  <div className={styles.loading}>Loading statuses...</div>
                ) : (
                  <div className={styles.statusItems}>
                    {statuses?.map((status) => (
                      <div key={status.id} className={styles.statusItem}>
                        <div className={styles.statusInfo}>
                          <div 
                            className={styles.statusColor}
                            style={{ backgroundColor: status.color || "#6366f1" }}
                          />
                          <div className={styles.statusDetails}>
                            <div className={styles.statusName}>{status.name}</div>
                            {status.description && (
                              <div className={styles.statusDescription}>
                                {status.description}
                              </div>
                            )}
                          </div>
                          {status.isDefault && (
                            <div className={styles.defaultBadge}>Default</div>
                          )}
                        </div>
                        <div className={styles.statusActions}>
                          <button
                            className={styles.editButton}
                            onClick={() => handleEdit(status)}
                            disabled={isUpdating || isDeleting}
                            title="Edit status"
                          >
                            <IoPencil />
                          </button>
                          {!status.isDefault && (
                            <button
                              className={styles.deleteButton}
                              onClick={() => handleDelete(status.id)}
                              disabled={isUpdating || isDeleting}
                              title="Delete status"
                            >
                              <IoTrash />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Form */}
              {showForm && (
                <div className={styles.statusForm}>
                  <h3>{editingStatus ? "Edit Status" : "Add New Status"}</h3>
                  <form onSubmit={handleSubmit(handleFormSubmit)}>
                    <div className={styles.formGroup}>
                      <label htmlFor="name">Status Name *</label>
                      <input
                        id="name"
                        {...register("name")}
                        disabled={isCreating || isUpdating}
                        placeholder="e.g., Pending Review"
                      />
                      {errors.name && (
                        <span className={styles.errorText}>{errors.name.message}</span>
                      )}
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="description">Description</label>
                      <textarea
                        id="description"
                        {...register("description")}
                        disabled={isCreating || isUpdating}
                        placeholder="Optional description for this status"
                        rows={3}
                      />
                      {errors.description && (
                        <span className={styles.errorText}>{errors.description.message}</span>
                      )}
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label htmlFor="color">Color</label>
                        <input
                          type="color"
                          id="color"
                          {...register("color")}
                          disabled={isCreating || isUpdating}
                        />
                        {errors.color && (
                          <span className={styles.errorText}>{errors.color.message}</span>
                        )}
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="displayOrder">Display Order</label>
                        <input
                          type="number"
                          id="displayOrder"
                          {...register("displayOrder", { valueAsNumber: true })}
                          disabled={isCreating || isUpdating}
                          min="0"
                          placeholder="0"
                        />
                        {errors.displayOrder && (
                          <span className={styles.errorText}>{errors.displayOrder.message}</span>
                        )}
                      </div>
                    </div>

                    <div className={styles.formActions}>
                      <button
                        type="button"
                        onClick={handleCancelForm}
                        className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
                        disabled={isCreating || isUpdating}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`}
                        disabled={isCreating || isUpdating}
                      >
                        {isCreating || isUpdating
                          ? "Saving..."
                          : editingStatus
                          ? "Update Status"
                          : "Create Status"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StatusManagementModal;