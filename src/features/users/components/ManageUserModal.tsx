// src/features/users/components/ManageUserModal.tsx

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { IoClose, IoEye, IoEyeOff } from "react-icons/io5";
import { FaPlus, FaPencilAlt, FaTrash } from "react-icons/fa";

import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./ManageUserModal.module.css";

import { useUserManagement } from "../useUserManagement"; // Corrected Path
import { deleteRole } from "@/services/clientRoleService";
import type { AccountNodeData } from "@/lib/types";

interface ManageUserModalProps {
  isOpen: boolean; // Though always true when rendered, useful for AnimatePresence
  onClose: () => void;
  userIdToEdit?: string;
  onLaunchRoleCreate: () => void;
  onLaunchRoleEdit: (roleId: string) => void;
}

const MANAGE_USER_MODAL_Z_INDEX = 1000;

// Helper to flatten the journal hierarchy for the <select> dropdown
const renderJournalOptions = (
  nodes: AccountNodeData[],
  level = 0
): React.ReactNode[] => {
  let options: React.ReactNode[] = [];
  const indent = "\u00A0\u00A0\u00A0\u00A0".repeat(level);

  for (const node of nodes) {
    options.push(
      <option key={node.id} value={node.id}>
        {indent}
        {node.name}
      </option>
    );
    if (node.children && node.children.length > 0) {
      options = options.concat(renderJournalOptions(node.children, level + 1));
    }
  }
  return options;
};

export const ManageUserModal: React.FC<ManageUserModalProps> = ({
  isOpen,
  onClose,
  userIdToEdit,
  onLaunchRoleCreate,
  onLaunchRoleEdit,
}) => {
  const queryClient = useQueryClient();
  const {
    formState,
    isEditMode,
    isLoading,
    isSubmitting,
    submissionError,
    assignableRoles,
    assignableJournals,
    isCurrentUserRestricted,
    handleInputChange,
    handleRoleSelectionChange,
    handleJournalRestrictionChange,
    handleSubmit,
    showPassword,
    setShowPassword,
  } = useUserManagement(userIdToEdit, onClose); // Pass onClose as the onSuccess callback

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete the "${roleName}" role? This action cannot be undone.`
      )
    ) {
      try {
        await deleteRole(roleId);
        // Refresh the list of roles after a successful deletion
        await queryClient.invalidateQueries({ queryKey: ["allRoles"] });
      } catch (error: any) {
        alert(`Error: ${error.message}`);
      }
    }
  };

  const journalOptions = useMemo(() => {
    if (!assignableJournals) return [];
    return renderJournalOptions(assignableJournals);
  }, [assignableJournals]);

  const modalTitle = isEditMode
    ? `Edit User: ${formState.name || ""}`
    : "Create New User";

  const handleActualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    handleSubmit();
  };

  const handleRoleCheckboxChange = (roleId: string, isChecked: boolean) => {
    const currentRoleIds = formState.roleAssignments.map((ra) => ra.roleId);
    const newRoleIds = isChecked
      ? [...currentRoleIds, roleId]
      : currentRoleIds.filter((id) => id !== roleId);
    handleRoleSelectionChange(newRoleIds);
  };

  return (
    <motion.div
      className={baseStyles.modalOverlay}
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ zIndex: MANAGE_USER_MODAL_Z_INDEX }}
    >
      <motion.div
        className={`${baseStyles.modalContent} ${styles.createUserModalContent}`}
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

        {isLoading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "200px",
            }}
          >
            <p>Loading user data...</p>
          </div>
        ) : (
          <form onSubmit={handleActualSubmit} className={styles.createUserForm}>
            <div className={styles.formColumns}>
              {/* --- LEFT COLUMN: USER DETAILS --- */}
              <div className={styles.leftColumn}>
                <div className={styles.formGroup}>
                  <label htmlFor="name">Full Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formState.name}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    autoComplete="name"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formState.email}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    autoComplete="email"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="password">
                    Password{" "}
                    {isEditMode ? "(Leave blank to keep current)" : "*"}
                  </label>
                  <div className={styles.passwordInputContainer}>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formState.password || ""}
                      onChange={handleInputChange}
                      required={!isEditMode}
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={styles.passwordToggle}
                      disabled={isSubmitting}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <IoEyeOff /> : <IoEye />}
                    </button>
                  </div>
                </div>
              </div>

              {/* --- RIGHT COLUMN: ROLES & RESTRICTIONS --- */}
              <div className={styles.rightColumn}>
                <div className={styles.formGroup}>
                  <div className={styles.roleHeader}>
                    <label>Assign Roles *</label>
                    <button
                      type="button"
                      className={styles.createRoleButton}
                      onClick={onLaunchRoleCreate}
                      disabled={isSubmitting}
                    >
                      <FaPlus /> Create Role
                    </button>
                  </div>
                  <div className={styles.rolesContainer}>
                    {assignableRoles?.map((role) => (
                      <div key={role.id} className={styles.roleCheckboxWrapper}>
                        <input
                          type="checkbox"
                          id={`role-${role.id}`}
                          checked={formState.roleAssignments.some(
                            (ra) => ra.roleId === role.id
                          )}
                          onChange={(e) =>
                            handleRoleCheckboxChange(role.id, e.target.checked)
                          }
                          disabled={isSubmitting}
                        />
                        <label htmlFor={`role-${role.id}`}>{role.name}</label>
                        <div className={styles.roleActions}>
                          <button
                            type="button"
                            onClick={() => onLaunchRoleEdit(role.id)}
                            title={`Edit ${role.name}`}
                            disabled={isSubmitting}
                          >
                            <FaPencilAlt />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(role.id, role.name)}
                            title={`Delete ${role.name}`}
                            className={styles.deleteButton}
                            disabled={isSubmitting}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="journalRestriction">
                    Journal Restriction
                  </label>
                  <select
                    id="journalRestriction"
                    value={formState.restrictedTopLevelJournalId || ""}
                    onChange={(e) =>
                      handleJournalRestrictionChange(e.target.value || null)
                    }
                    disabled={isSubmitting} // The dropdown is no longer disabled for restricted users
                    className={styles.journalSelect}
                  >
                    {/* REFINED: Only show "No Restriction" if the admin is unrestricted */}
                    {!isCurrentUserRestricted && (
                      <option value="">No Restriction</option>
                    )}
                    {journalOptions}
                  </select>
                  {/* REFINED: Updated helper text */}
                  {isCurrentUserRestricted && (
                    <p className={styles.restrictionNotice}>
                      You can only assign a journal restriction at or below your
                      own level.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {submissionError && (
              <p className={styles.errorMessage}>
                {submissionError.message || "An unexpected error occurred."}
              </p>
            )}

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
                  isSubmitting || formState.roleAssignments.length === 0
                }
              >
                {isSubmitting
                  ? "Saving..."
                  : isEditMode
                  ? "Save Changes"
                  : "Create User"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
};

export default ManageUserModal;
