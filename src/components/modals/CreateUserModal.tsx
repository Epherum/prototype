// src/components/modals/ManageUserModal.tsx

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import baseStyles from "@/features/shared/components/ModalBase.module.css"; // Assuming shared base styles
import styles from "./CreateUserModal.module.css"; // Reuse the same styles
import { IoClose, IoEye, IoEyeOff } from "react-icons/io5";
import { useUserManagement } from "@/hooks/useUserManagement";
import JournalModal from "../../features/journals/components/JournalModal";
import { buildTree, getJournalDisplayPath } from "@/lib/helpers";
import type { AccountNodeData } from "@/lib/types";

interface ManageUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userIdToEdit?: string; // If provided, we're in "edit" mode
}

const MANAGE_USER_MODAL_Z_INDEX = 1000;
const JOURNAL_MODAL_Z_INDEX = 1050; // Must be higher

const ManageUserModal: React.FC<ManageUserModalProps> = ({
  isOpen,
  onClose,
  userIdToEdit,
}) => {
  // CORRECTED: Destructuring from the new, refactored useUserManagement hook
  const {
    formState,
    isEditMode,
    isLoading, // This combines all loading states
    isSubmitting,
    isSuccess,
    submissionError,
    resetMutation,
    assignableRoles, // Use this for the dropdown
    allCompanyJournalsData,
    handleInputChange,
    handleRoleSelectionChange,
    handleJournalRestrictionChange,
    handleSubmit,
    resetForm,
    showPassword,
    setShowPassword,
  } = useUserManagement(userIdToEdit);

  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [currentRoleIdForRestriction, setCurrentRoleIdForRestriction] =
    useState<string | null>(null);

  const journalHierarchyForModal = useMemo((): AccountNodeData[] => {
    if (!allCompanyJournalsData) return [];
    try {
      // Cast if buildTree is strict about its input type
      return buildTree(allCompanyJournalsData as any[]);
      // return buildTree(allCompanyJournalsData as JournalForAdminSelection[]);
    } catch (error) {
      console.error("Error building journal hierarchy:", error);
      return [];
    }
  }, [allCompanyJournalsData]);

  // Effect to handle closing the modal upon successful submission
  useEffect(() => {
    if (isSuccess && isOpen) {
      onClose();
    }
  }, [isSuccess, isOpen, onClose]);

  // Effect to reset the form state when the modal is closed
  useEffect(() => {
    if (!isOpen) {
      resetForm();
      if (resetMutation) {
        resetMutation();
      }
    }
  }, [isOpen, resetForm, resetMutation]);

  // Effect to handle body overflow
  useEffect(() => {
    if (isOpen || isJournalModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isJournalModalOpen]);

  // Effect for escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        isJournalModalOpen ? setIsJournalModalOpen(false) : onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isJournalModalOpen, onClose]);

  const handleActualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    handleSubmit();
  };

  const handleRolesChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(
      event.target.selectedOptions,
      (option) => option.value
    );
    handleRoleSelectionChange(selectedOptions);
  };

  const openJournalSelectionModal = (roleId: string) => {
    setCurrentRoleIdForRestriction(roleId);
    setIsJournalModalOpen(true);
  };

  const closeJournalSelectionModal = () => {
    setIsJournalModalOpen(false);
    setCurrentRoleIdForRestriction(null);
  };

  const handleJournalSelectedFromModal = (selectedJournalId: string | null) => {
    if (
      currentRoleIdForRestriction &&
      selectedJournalId &&
      allCompanyJournalsData
    ) {
      const selectedJournal = allCompanyJournalsData.find(
        (j) => j.id === selectedJournalId
      );
      if (selectedJournal) {
        const displayName = getJournalDisplayPath(
          selectedJournal.id,
          allCompanyJournalsData
        );
        handleJournalRestrictionChange(
          currentRoleIdForRestriction,
          selectedJournal.id,
          selectedJournal.companyId,
          displayName
        );
      }
    } else if (currentRoleIdForRestriction) {
      handleJournalRestrictionChange(
        currentRoleIdForRestriction,
        null,
        null,
        null
      );
    }
    closeJournalSelectionModal();
  };

  const clearJournalRestriction = (roleId: string) => {
    handleJournalRestrictionChange(roleId, null, null, null);
  };

  const modalTitle = isEditMode
    ? `Edit User: ${formState.name}`
    : "Create New User";
  const submitButtonText = isEditMode ? "Save Changes" : "Create User";
  const submittingButtonText = isEditMode ? "Saving..." : "Creating...";

  return (
    <>
      <AnimatePresence>
        {isOpen && (
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
                <form
                  onSubmit={handleActualSubmit}
                  className={styles.createUserForm}
                >
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
                      >
                        {showPassword ? <IoEyeOff /> : <IoEye />}
                      </button>
                    </div>
                  </div>

                  <div className={styles.roleAssignmentsSection}>
                    <h3>Assign Roles *</h3>
                    <div className={styles.formGroup}>
                      <label htmlFor="roles">
                        Roles (Ctrl/Cmd + click for multiple)
                      </label>
                      <select
                        id="roles"
                        name="roles"
                        multiple
                        value={formState.roleAssignments.map((ra) => ra.roleId)}
                        onChange={handleRolesChange}
                        className={styles.rolesSelect}
                        disabled={isSubmitting || assignableRoles.length === 0}
                        required={formState.roleAssignments.length === 0}
                      >
                        {assignableRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      {assignableRoles.length === 0 && !isLoading && (
                        <p className={styles.inputHint}>
                          You do not have permissions to assign any available
                          roles.
                        </p>
                      )}
                    </div>

                    {formState.roleAssignments.map((assignment) => (
                      <div
                        key={assignment.roleId}
                        className={styles.assignedRoleItem}
                      >
                        <p className={styles.assignedRoleHeader}>
                          Journal Restriction for:{" "}
                          {assignment.roleName || assignment.roleId}
                        </p>
                        <div className={styles.formGroup}>
                          {assignment.restrictedTopLevelJournalId ? (
                            <div className={styles.restrictionDisplay}>
                              <span>
                                Restricted to:{" "}
                                {assignment.restrictedJournalDisplayName ||
                                  assignment.restrictedTopLevelJournalId}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  openJournalSelectionModal(assignment.roleId)
                                }
                                className={styles.changeButton}
                                disabled={isSubmitting}
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  clearJournalRestriction(assignment.roleId)
                                }
                                className={styles.clearButton}
                                disabled={isSubmitting}
                              >
                                Clear
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                openJournalSelectionModal(assignment.roleId)
                              }
                              className={`${styles.actionButtonBase} ${styles.selectJournalButton}`}
                              disabled={isSubmitting}
                            >
                              Set Journal Restriction
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {submissionError && (
                    <p className={styles.errorMessage}>
                      {submissionError.message ||
                        "An unexpected error occurred."}
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
                      {isSubmitting ? submittingButtonText : submitButtonText}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isJournalModalOpen && (
          <JournalModal
            isOpen={isJournalModalOpen}
            onClose={closeJournalSelectionModal}
            onConfirmSelection={handleJournalSelectedFromModal}
            hierarchy={journalHierarchyForModal}
            isLoading={!allCompanyJournalsData}
            modalTitle="Select Journal for Restriction"
            // Pass stubs for unused props to satisfy the component's interface
            onSetShowRoot={() => {}}
            onDeleteAccount={() => {}}
            onTriggerAddChild={() => {}}
            onSelectForLinking={undefined}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default ManageUserModal;
