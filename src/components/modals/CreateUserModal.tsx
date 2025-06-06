// src/components/modals/CreateUserModal.tsx
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import baseStyles from "./ModalBase.module.css";
import formStyles from "./CreateUserModal.module.css";
import { IoClose, IoEye, IoEyeOff } from "react-icons/io5";
import { useUserManagement } from "@/hooks/useUserManagement"; // Adjust path

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  // onSuccess callback can be added if specific action needed after successful creation AND modal close
  // onSuccess?: (createdUser: any) => void;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    formState,
    handleInputChange,
    handleRoleSelectionChange, // This will need a multi-select component
    handleJournalRestrictionChange,
    handleSubmit,
    resetForm,
    companyRoles,
    topLevelJournals,
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

  // Effect to handle Escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Effect to handle body scroll lock
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Reset form and close modal on successful submission
  useEffect(() => {
    if (isSuccess) {
      // Potentially call onSuccess prop here
      onClose(); // Close the modal
      // Resetting form for next time it opens
      // It's important to reset AFTER closing animation might have finished or if onClose also triggers reset.
      // Or reset when modal fully closes (if AnimatePresence onExitComplete is used)
      // For simplicity, reset when success flag is seen and it's open.
      if (isOpen) {
        resetForm();
        createUserMutation.reset(); // Reset mutation state as well
      }
    }
  }, [isSuccess, onClose, resetForm, createUserMutation, isOpen]);

  // Reset form when modal is closed (if not reset on success already)
  useEffect(() => {
    if (!isOpen && !isSuccess) {
      // Ensure not to reset if it just became successful and is closing
      resetForm();
      createUserMutation.reset();
    }
  }, [isOpen, resetForm, createUserMutation, isSuccess]);

  const handleActualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    await handleSubmit(); // Call the hook's submit handler
  };

  const handleRolesChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(
      event.target.selectedOptions,
      (option) => option.value
    );
    handleRoleSelectionChange(selectedOptions);
  };

  if (
    (isLoadingRoles && isOpen) ||
    (isLoadingJournals && isOpen && !companyRoles?.length)
  ) {
    // Show loading only if modal is open and data is critical for display
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div className={baseStyles.modalOverlay} onClick={onClose}>
            <motion.div
              className={`${baseStyles.modalContent} ${formStyles.createUserModalContent}`}
              onClick={(e) => e.stopPropagation()}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
            >
              <div className={formStyles.loadingSpinner}></div>
              <p
                style={{ textAlign: "center", color: "var(--text-secondary)" }}
              >
                Loading necessary data...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={baseStyles.modalOverlay}
          onClick={onClose} // Close if overlay is clicked
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={`${baseStyles.modalContent} ${formStyles.createUserModalContent}`}
            onClick={(e) => e.stopPropagation()} // Prevent closing when content is clicked
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
                {/* Basic multi-select for roles. Consider a nicer component (e.g., react-select) for better UX. */}
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
                    className={formStyles.rolesSelect} // For potential height styling
                    disabled={
                      isSubmitting || isLoadingRoles || !companyRoles?.length
                    }
                    required={formState.roleAssignments.length === 0} // Make it required if no roles are selected yet
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
                        Restrict to Top-Level Journal (Optional)
                      </label>
                      <select
                        id={`journalRestriction-${assignment.roleId}`}
                        value={assignment.restrictedTopLevelJournalId || ""}
                        onChange={(e) =>
                          handleJournalRestrictionChange(
                            assignment.roleId,
                            e.target.value || null
                          )
                        }
                        disabled={
                          isSubmitting ||
                          isLoadingJournals ||
                          !topLevelJournals?.length
                        }
                      >
                        {topLevelJournals?.map((journal) => (
                          <option
                            key={journal.id || `none-${index}`}
                            value={journal.id}
                          >
                            {journal.name}
                          </option>
                        ))}
                      </select>
                      {topLevelJournals &&
                        topLevelJournals.length <= 1 &&
                        !isLoadingJournals &&
                        topLevelJournals[0]?.id === "" && ( // only "None" option
                          <p className={formStyles.inputHint}>
                            No top-level journals available for restriction in
                            this company.
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
                createUserMutation.isError &&
                !submissionError && (
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
                  } // Also disable if no roles selected
                >
                  {isSubmitting ? "Creating User..." : "Create User"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateUserModal;
