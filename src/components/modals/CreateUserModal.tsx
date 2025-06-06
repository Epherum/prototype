// File: src/components/modals/CreateUserModal.tsx
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import baseStyles from "./ModalBase.module.css";
import formStyles from "./CreateUserModal.module.css";
import { IoClose, IoEye, IoEyeOff } from "react-icons/io5";
import { useUserManagement } from "@/hooks/useUserManagement";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    formState,
    handleInputChange,
    handleRoleSelectionChange,
    handleJournalRestrictionChange,
    handleSubmit,
    resetForm,
    companyRoles,
    availableJournalsForRestriction, // UPDATED: Was topLevelJournals
    isLoadingRoles,
    errorRoles,
    isLoadingJournals,
    errorJournals,
    createUserMutation,
    showPassword,
    setShowPassword,
  } = useUserManagement();

  const {
    isPending: isSubmitting,
    isSuccess,
    error: submissionError,
  } = createUserMutation;

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isSuccess) {
      onClose();
      if (isOpen) {
        // Should be closed by onClose, but defensive
        resetForm();
        createUserMutation.reset();
      }
    }
  }, [isSuccess, onClose, resetForm, createUserMutation, isOpen]);

  useEffect(() => {
    if (!isOpen && !isSuccess) {
      resetForm();
      createUserMutation.reset();
    }
  }, [isOpen, resetForm, createUserMutation, isSuccess]);

  const handleActualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    await handleSubmit();
  };

  const handleRolesChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(
      event.target.selectedOptions,
      (option) => option.value
    );
    handleRoleSelectionChange(selectedOptions);
  };

  // Combined loading check for initial critical data
  const isLoadingCriticalData =
    isLoadingRoles ||
    (isLoadingJournals && !availableJournalsForRestriction?.length);

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
        >
          <motion.div
            className={`${baseStyles.modalContent} ${formStyles.createUserModalContent}`}
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
            <h2 className={baseStyles.modalTitle}>Create New User</h2>

            {isLoadingCriticalData && isOpen ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "200px",
                }}
              >
                <div className={formStyles.loadingSpinner}></div>{" "}
                {/* Make sure this class provides a spinner */}
                <p
                  style={{
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    marginLeft: "10px",
                  }}
                >
                  Loading necessary data...
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleActualSubmit}
                className={formStyles.createUserForm}
              >
                {/* Name Field */}
                <div className={formStyles.formGroup}>
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

                {/* Email Field */}
                <div className={formStyles.formGroup}>
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

                {/* Password Field */}
                <div className={formStyles.formGroup}>
                  <label htmlFor="password">Password *</label>
                  <div className={formStyles.passwordInputContainer}>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formState.password}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={formStyles.passwordToggle}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      disabled={isSubmitting}
                    >
                      {showPassword ? <IoEyeOff /> : <IoEye />}
                    </button>
                  </div>
                </div>

                {/* Role Assignments Section */}
                <div className={formStyles.roleAssignmentsSection}>
                  <h3>Assign Roles *</h3>
                  {errorRoles && (
                    <p className={formStyles.errorMessage}>
                      Error loading roles: {errorRoles.message}
                    </p>
                  )}
                  <div className={formStyles.formGroup}>
                    <label htmlFor="roles">
                      Roles (Ctrl/Cmd + click for multiple)
                    </label>
                    <select
                      id="roles"
                      name="roles"
                      multiple
                      value={formState.roleAssignments.map((ra) => ra.roleId)}
                      onChange={handleRolesChange}
                      className={formStyles.rolesSelect}
                      disabled={
                        isSubmitting || isLoadingRoles || !companyRoles?.length
                      }
                      required={formState.roleAssignments.length === 0}
                    >
                      {companyRoles?.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    {companyRoles &&
                      companyRoles.length === 0 &&
                      !isLoadingRoles && (
                        <p className={formStyles.inputHint}>
                          No roles available in this company.
                        </p>
                      )}
                  </div>

                  {/* Dynamically render journal restriction dropdowns for selected roles */}
                  {formState.roleAssignments.map((assignment, index) => (
                    <div
                      key={assignment.roleId}
                      className={formStyles.assignedRoleItem}
                    >
                      <p className={formStyles.assignedRoleHeader}>
                        Journal Restriction for:{" "}
                        {assignment.roleName || assignment.roleId}
                      </p>
                      {errorJournals && (
                        <p className={formStyles.errorMessage}>
                          Error loading journals: {errorJournals.message}
                        </p>
                      )}
                      <div className={formStyles.formGroup}>
                        <label
                          htmlFor={`journalRestriction-${assignment.roleId}`}
                        >
                          Restrict to Journal (Optional)
                        </label>
                        <select
                          id={`journalRestriction-${assignment.roleId}`}
                          value={assignment.restrictedTopLevelJournalId || ""}
                          onChange={(e) =>
                            handleJournalRestrictionChange(
                              assignment.roleId,
                              e.target.value || null // Pass null if "" (None option) is selected
                            )
                          }
                          disabled={
                            isSubmitting ||
                            isLoadingJournals ||
                            !availableJournalsForRestriction?.length
                          }
                        >
                          {/* Iterate over availableJournalsForRestriction which includes "None" and all company journals with display paths */}
                          {availableJournalsForRestriction?.map((journal) => (
                            <option
                              key={
                                journal.id ||
                                `none-option-${index}-${assignment.roleId}`
                              } // Ensure unique key
                              value={journal.id}
                            >
                              {journal.displayPath}{" "}
                              {/* Display the full hierarchical path */}
                            </option>
                          ))}
                        </select>
                        {availableJournalsForRestriction &&
                          availableJournalsForRestriction.length <= 1 && // Only "None" option
                          !isLoadingJournals && (
                            <p className={formStyles.inputHint}>
                              No journals available for restriction in this
                              company.
                            </p>
                          )}
                      </div>
                    </div>
                  ))}
                </div>

                {submissionError && (
                  <p className={formStyles.errorMessage}>
                    {submissionError.message || "An unexpected error occurred."}
                  </p>
                )}
                {formState.roleAssignments.length === 0 &&
                  createUserMutation.isError && // Show only if submit was attempted
                  !submissionError && ( // Don't show if there's a more specific submission error
                    <p className={formStyles.errorMessage}>
                      Please assign at least one role to the user.
                    </p>
                  )}

                {/* Action Buttons */}
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
                    {isSubmitting ? "Creating User..." : "Create User"}
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

export default CreateUserModal;
