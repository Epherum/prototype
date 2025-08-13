// src/components/modals/ManageRoleModal.tsx

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoClose } from "react-icons/io5";
import type { RoleFormState } from "@/features/users/useRoleManagement"; // Import the type for our form state
import type { PermissionClient } from "@/lib/types/models.client";

import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./ManageUserModal.module.css"; // Re-using styles for consistency
import roleStyles from "./ManageRoleModal.module.css";

// --- 1. DEFINE THE PROPS INTERFACE ---
// This modal is a "presentational" component. It receives everything it needs as props.
interface ManageRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  formState: RoleFormState;
  isEditMode: boolean;
  allPermissions?: PermissionClient[];
  isLoadingPermissions: boolean;
  isSubmitting: boolean;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  handlePermissionToggle: (permissionId: string) => void;
  handleSubmit: () => void;
}

const MANAGE_ROLE_MODAL_Z_INDEX = 1050; // Higher than ManageUserModal

export const ManageRoleModal: React.FC<ManageRoleModalProps> = ({
  // --- 2. DESTRUCTURE THE ACTUAL PROPS ---
  isOpen,
  onClose,
  formState,
  isEditMode,
  allPermissions,
  isLoadingPermissions,
  isSubmitting,
  handleInputChange,
  handlePermissionToggle,
  handleSubmit,
}) => {
  const modalTitle = isEditMode ? `Edit Role` : "Create New Role";

  const handleActualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={baseStyles.modalOverlay}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ zIndex: MANAGE_ROLE_MODAL_Z_INDEX }}
        >
          <motion.div
            className={`${baseStyles.modalContent} ${roleStyles.roleModalContent}`}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <button
              className={baseStyles.modalCloseButton}
              onClick={onClose}
              aria-label="Close modal"
            >
              <IoClose />
            </button>
            <h2 className={baseStyles.modalTitle}>{modalTitle}</h2>
            {isLoadingPermissions ? (
              <p>Loading permissions...</p>
            ) : (
              <form onSubmit={handleActualSubmit}>
                <div className={styles.formGroup}>
                  <label htmlFor="roleName">Role Name *</label>
                  <input
                    type="text"
                    id="roleName"
                    name="name"
                    value={formState.name}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="roleDescription">Description</label>
                  <textarea
                    id="roleDescription"
                    name="description"
                    value={formState.description}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    rows={2}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Permissions *</label>
                  <div className={roleStyles.permissionsGrid}>
                    {allPermissions?.map((p) => (
                      <div key={p.id} className={styles.roleCheckboxWrapper}>
                        <input
                          type="checkbox"
                          id={`perm-${p.id}`}
                          checked={formState.permissionIds.includes(p.id)}
                          onChange={() => handlePermissionToggle(p.id)}
                          disabled={isSubmitting}
                        />
                        <label
                          htmlFor={`perm-${p.id}`}
                          className={roleStyles.permissionLabel}
                        >
                          <span className={roleStyles.actionText}>
                            {p.action}
                          </span>
                          <span className={roleStyles.resourceText}>
                            {p.resource}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={baseStyles.modalActions}>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`}
                    disabled={
                      isSubmitting || formState.permissionIds.length === 0
                    }
                  >
                    {isSubmitting ? "Saving..." : "Save Role"}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
