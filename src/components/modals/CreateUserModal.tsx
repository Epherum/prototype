// src/components/modals/CreateUserModal.tsx
import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import baseStyles from "./ModalBase.module.css"; // Used by both
import styles from "./CreateUserModal.module.css"; // Specific to CreateUserModal
import { IoClose, IoEye, IoEyeOff } from "react-icons/io5";
import { useUserManagement } from "@/hooks/useUserManagement";
import JournalModal from "./JournalModal";
import { buildTree } from "@/lib/helpers";
import type { AccountNodeData, Journal } from "@/lib/types";
import { getJournalDisplayPath } from "@/lib/helpers";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Z-index constants for clarity and management
const CREATE_USER_MODAL_Z_INDEX = 1000;
const JOURNAL_MODAL_Z_INDEX = 1050; // Must be higher

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
    allCompanyJournalsData, // Already exposed from the hook
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

  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [currentRoleIdForRestriction, setCurrentRoleIdForRestriction] =
    useState<string | null>(null);

  // console.log("[CreateUserModal] allCompanyJournalsData:",allCompanyJournalsData);
  // console.log("[CreateUserModal] isLoadingJournals:", isLoadingJournals);

  const journalHierarchyForModal = useMemo((): AccountNodeData[] => {
    // console.log("[CreateUserModal useMemo] allCompanyJournalsData:", allCompanyJournalsData);
    if (
      isLoadingJournals ||
      !allCompanyJournalsData ||
      allCompanyJournalsData.length === 0
    ) {
      // console.log("[CreateUserModal useMemo] Returning empty array.");
      return [];
    }
    try {
      const hierarchy = buildTree(allCompanyJournalsData as Journal[]); // Ensure cast is valid
      // console.log("[CreateUserModal useMemo] Result from buildTree:", hierarchy);
      return hierarchy;
    } catch (error) {
      console.error("[CreateUserModal useMemo] Error in buildTree:", error);
      return [];
    }
  }, [allCompanyJournalsData, isLoadingJournals]);

  // console.log("[CreateUserModal] journalHierarchyForModal after useMemo:", journalHierarchyForModal);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isJournalModalOpen) {
          setIsJournalModalOpen(false); // Close JournalModal first
        } else if (isOpen) {
          onClose(); // Then CreateUserModal
        }
      }
    };
    // Listen if either modal could be open
    if (isOpen || isJournalModalOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, isJournalModalOpen]); // Add isJournalModalOpen dependency

  useEffect(() => {
    // Manage body overflow based on whether *any* modal is open
    if (isOpen || isJournalModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isJournalModalOpen]); // Add isJournalModalOpen dependency

  useEffect(() => {
    if (isSuccess && isOpen) {
      onClose();
      resetForm();
      createUserMutation.reset();
    }
  }, [isSuccess, onClose, resetForm, createUserMutation, isOpen]);

  useEffect(() => {
    if (!isOpen && !isSuccess) {
      // If modal is closed without success, reset
      resetForm();
      createUserMutation.reset();
      // Also ensure JournalModal is closed if CreateUserModal is closed
      if (isJournalModalOpen) setIsJournalModalOpen(false);
    }
  }, [isOpen, resetForm, createUserMutation, isSuccess, isJournalModalOpen]);

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

  const openJournalSelectionModal = (roleId: string) => {
    console.log(
      "[CreateUserModal] openJournalSelectionModal called for roleId:",
      roleId
    );
    if (isLoadingJournals || journalHierarchyForModal.length === 0) {
      console.warn(
        "[CreateUserModal] Journal data not ready or empty, JournalModal not opened."
      );
      alert(
        "Journal data is still loading or no journals are available. Please try again in a moment."
      );
      return;
    }
    setCurrentRoleIdForRestriction(roleId);
    setIsJournalModalOpen(true);
    console.log(
      "[CreateUserModal] isJournalModalOpen set to true. Hierarchy items:",
      journalHierarchyForModal.length
    );
  };

  const closeJournalSelectionModal = () => {
    setIsJournalModalOpen(false);
    setCurrentRoleIdForRestriction(null);
  };

  const handleJournalSelectedFromModal = (selectedJournalId: string | null) => {
    // This callback is `onConfirmSelection` from JournalModal.
    // It will pass the ID of the selected journal, or a root/default ID if nothing specific was chosen
    // and the user hit "Confirm Selection". In this restriction context, we only care about specific journals.
    console.log(
      "[CreateUserModal] Journal selected from modal:",
      selectedJournalId
    );

    if (
      currentRoleIdForRestriction &&
      selectedJournalId &&
      allCompanyJournalsData
    ) {
      // Ensure selectedJournalId is not a conceptual root passed by JournalModal if user selects nothing then confirms
      // (JournalModal's `onConfirmSelection` might pass ROOT_JOURNAL_ID or similar as a default)
      const selectedJournal = allCompanyJournalsData.find(
        (j) => j.id === selectedJournalId && j.id !== "ROOT_JOURNAL_ID" // Example conceptual root check
      );

      if (selectedJournal) {
        const displayName = getJournalDisplayPath(
          selectedJournal.id,
          allCompanyJournalsData // Correct type: JournalForAdminSelection[]
        );
        handleJournalRestrictionChange(
          currentRoleIdForRestriction,
          selectedJournal.id,
          selectedJournal.companyId,
          displayName
        );
      } else {
        // If selectedJournalId was a conceptual root or not found, treat as clearing/no selection.
        console.log(
          `[CreateUserModal] No specific journal selected (ID: ${selectedJournalId}) or not found. Clearing restriction.`
        );
        handleJournalRestrictionChange(
          currentRoleIdForRestriction,
          null,
          null,
          null
        );
      }
    } else if (currentRoleIdForRestriction) {
      // If selectedJournalId is null (e.g., user explicitly cleared or cancelled)
      handleJournalRestrictionChange(
        currentRoleIdForRestriction,
        null,
        null,
        null
      );
    }
    closeJournalSelectionModal(); // Close the modal in all cases after handling
  };

  const clearJournalRestriction = (roleId: string) => {
    handleJournalRestrictionChange(roleId, null, null, null);
  };

  const isLoadingCriticalData = isLoadingRoles || isLoadingJournals;

  // Use a React Fragment to return multiple top-level elements (CreateUserModal and JournalModal)
  return (
    <>
      <AnimatePresence>
        {isOpen && ( // This AnimatePresence controls CreateUserModal
          <motion.div
            className={baseStyles.modalOverlay}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ zIndex: CREATE_USER_MODAL_Z_INDEX }} // Apply z-index
          >
            <motion.div
              className={`${baseStyles.modalContent} ${styles.createUserModalContent}`}
              onClick={(e) => e.stopPropagation()}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              // No z-index here, relies on parent overlay's stacking context
            >
              <button
                className={baseStyles.modalCloseButton}
                onClick={onClose}
                aria-label="Close modal"
              >
                <IoClose />
              </button>
              <h2 className={baseStyles.modalTitle}>Create New User</h2>

              {isLoadingCriticalData ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "200px",
                  }}
                >
                  {/* Basic spinner or text */}
                  <p>Loading necessary data...</p>
                </div>
              ) : (
                <form
                  onSubmit={handleActualSubmit}
                  className={styles.createUserForm}
                >
                  {/* Name Field */}
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

                  {/* Email Field */}
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

                  {/* Password Field */}
                  <div className={styles.formGroup}>
                    <label htmlFor="password">Password *</label>
                    <div className={styles.passwordInputContainer}>
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
                        className={styles.passwordToggle}
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
                  <div className={styles.roleAssignmentsSection}>
                    <h3>Assign Roles *</h3>
                    {errorRoles && (
                      <p className={styles.errorMessage}>
                        Error loading roles: {errorRoles.message}
                      </p>
                    )}
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
                        disabled={
                          isSubmitting ||
                          isLoadingRoles ||
                          !companyRoles?.length
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
                          <p className={styles.inputHint}>
                            No roles available in this company.
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
                        {errorJournals && (
                          <p className={styles.errorMessage}>
                            Error loading journals: {errorJournals.message}
                          </p>
                        )}
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
                                disabled={
                                  isSubmitting ||
                                  isLoadingJournals ||
                                  journalHierarchyForModal.length === 0
                                }
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
                              className={styles.selectJournalButton}
                              disabled={
                                isSubmitting ||
                                isLoadingJournals ||
                                journalHierarchyForModal.length === 0
                              }
                            >
                              Set Journal Restriction
                            </button>
                          )}
                          {isLoadingJournals && <p>Loading journals...</p>}
                          {!isLoadingJournals &&
                            allCompanyJournalsData &&
                            allCompanyJournalsData.length > 0 &&
                            journalHierarchyForModal.length === 0 && (
                              <p className={styles.inputHint}>
                                Journals loaded, but hierarchy could not be
                                built.
                              </p>
                            )}
                          {!isLoadingJournals &&
                            (!allCompanyJournalsData ||
                              allCompanyJournalsData.length === 0) && (
                              <p className={styles.inputHint}>
                                No journals available in this company for
                                restriction.
                              </p>
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
                  {formState.roleAssignments.length === 0 &&
                    createUserMutation.isError &&
                    !submissionError && (
                      <p className={styles.errorMessage}>
                        Please assign at least one role to the user.
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
                      {isSubmitting ? "Creating User..." : "Create User"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* JournalModal is now a sibling to CreateUserModal's AnimatePresence block,
          but it has its own AnimatePresence for its own lifecycle.
          This is a common pattern for stacking modals. */}
      <AnimatePresence>
        {isJournalModalOpen && (
          <JournalModal
            isOpen={isJournalModalOpen} // Prop for JournalModal's internal logic
            onClose={closeJournalSelectionModal}
            // `onConfirmSelection` is the key for getting the selected journal ID
            // JournalModal's "Confirm" button should trigger this.
            // It should pass the ID of the selected journal, or null/ROOT_JOURNAL_ID if nothing specific selected.
            onConfirmSelection={handleJournalSelectedFromModal}
            hierarchy={journalHierarchyForModal} // This is the hierarchy built from allCompanyJournalsData
            isLoading={isLoadingJournals}
            modalTitle="Select Journal for Restriction"
            // These props are not primary for this use case, but JournalModal might expect them.
            // Provide stubs or ensure JournalModal handles their absence gracefully.
            onSetShowRoot={() =>
              console.log(
                "JournalModal: onSetShowRoot triggered (no-op for restriction selection)"
              )
            }
            onDeleteAccount={() =>
              console.log(
                "JournalModal: onDeleteAccount triggered (no-op for restriction selection)"
              )
            }
            onTriggerAddChild={() =>
              console.log(
                "JournalModal: onTriggerAddChild triggered (no-op for restriction selection)"
              )
            }
            onSelectForLinking={undefined} // Fix: explicitly pass undefined
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default CreateUserModal;
