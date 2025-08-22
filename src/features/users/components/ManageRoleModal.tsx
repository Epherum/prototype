// src/components/modals/ManageRoleModal.tsx

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoClose } from "react-icons/io5";
import type { RoleFormState } from "@/features/users/useRoleManagement"; // Import the type for our form state
import type { PermissionClient } from "@/lib/types/models.client";

import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./ManageUserModal.module.css"; // Re-using styles for consistency
import roleStyles from "./ManageRoleModal.module.css";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

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
  // Handle body scroll lock
  useBodyScrollLock(isOpen);
  
  const modalTitle = isEditMode ? `Edit Role` : "Create New Role";

  // Group permissions by resource for better organization
  const groupedPermissions = useMemo(() => {
    if (!allPermissions) return {};
    
    return allPermissions.reduce((groups, permission) => {
      const resource = permission.resource;
      if (!groups[resource]) {
        groups[resource] = [];
      }
      groups[resource].push(permission);
      return groups;
    }, {} as Record<string, PermissionClient[]>);
  }, [allPermissions]);

  // Sort resources to show in a logical order
  const sortedResources = useMemo(() => {
    const resourceOrder = ['USER', 'ROLE', 'JOURNAL', 'PARTNER', 'GOODS', 'DOCUMENT'];
    const resources = Object.keys(groupedPermissions);
    
    return resourceOrder.filter(resource => resources.includes(resource))
      .concat(resources.filter(resource => !resourceOrder.includes(resource)));
  }, [groupedPermissions]);

  const handleActualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  const handleSelectAllForResource = (resource: string, select: boolean) => {
    const resourcePermissions = groupedPermissions[resource] || [];
    resourcePermissions.forEach(permission => {
      const isCurrentlySelected = formState.permissionIds.includes(permission.id);
      if (select && !isCurrentlySelected) {
        handlePermissionToggle(permission.id);
      } else if (!select && isCurrentlySelected) {
        handlePermissionToggle(permission.id);
      }
    });
  };

  const getResourceDisplayName = (resource: string) => {
    switch (resource) {
      case 'USER': return 'User Management';
      case 'ROLE': return 'Role Management';
      case 'JOURNAL': return 'Journal/Accounts';
      case 'PARTNER': return 'Partners';
      case 'GOODS': return 'Goods & Services';
      case 'DOCUMENT': return 'Documents';
      default: return resource.charAt(0) + resource.slice(1).toLowerCase();
    }
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
                  <div className={roleStyles.permissionsContainer}>
                    {sortedResources.map((resource) => {
                      const resourcePermissions = groupedPermissions[resource] || [];
                      const selectedCount = resourcePermissions.filter(p => 
                        formState.permissionIds.includes(p.id)
                      ).length;
                      const totalCount = resourcePermissions.length;
                      const allSelected = selectedCount === totalCount;
                      const someSelected = selectedCount > 0 && selectedCount < totalCount;

                      return (
                        <div key={resource} className={roleStyles.permissionGroup}>
                          <div className={roleStyles.groupHeader}>
                            <h4 className={roleStyles.groupTitle}>
                              {getResourceDisplayName(resource)}
                            </h4>
                            <div className={roleStyles.groupControls}>
                              <span className={roleStyles.selectionCount}>
                                {selectedCount}/{totalCount} selected
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSelectAllForResource(resource, !allSelected)}
                                className={roleStyles.selectAllButton}
                                disabled={isSubmitting}
                              >
                                {allSelected ? 'Deselect All' : 'Select All'}
                              </button>
                            </div>
                          </div>
                          <div className={roleStyles.permissionsGrid}>
                            {resourcePermissions.map((permission) => (
                              <div key={permission.id} className={styles.roleCheckboxWrapper}>
                                <input
                                  type="checkbox"
                                  id={`perm-${permission.id}`}
                                  checked={formState.permissionIds.includes(permission.id)}
                                  onChange={() => handlePermissionToggle(permission.id)}
                                  disabled={isSubmitting}
                                />
                                <label
                                  htmlFor={`perm-${permission.id}`}
                                  className={roleStyles.permissionLabel}
                                >
                                  <span className={roleStyles.actionText}>
                                    {permission.action}
                                  </span>
                                  {permission.description && (
                                    <span className={roleStyles.descriptionText}>
                                      {permission.description}
                                    </span>
                                  )}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
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
