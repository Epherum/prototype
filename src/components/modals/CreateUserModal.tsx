// src/components/modals/ManageUserModal.tsx

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "./CreateUserModal.module.css";
import { IoClose, IoEye, IoEyeOff } from "react-icons/io5";
import { useUserManagement } from "@/hooks/useUserManagement";

interface ManageUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userIdToEdit?: string; // If provided, we're in "edit" mode
}

const MANAGE_USER_MODAL_Z_INDEX = 1000;

const ManageUserModal: React.FC<ManageUserModalProps> = ({
  isOpen,
  onClose,
  userIdToEdit,
}) => {
  // Destructure only the necessary, non-role-related properties
  const {
    formState,
    isEditMode,
    isLoading,
    isSubmitting,
    isSuccess,
    submissionError,
    resetMutation,
    handleInputChange,
    handleSubmit,
    resetForm,
    showPassword,
    setShowPassword,
  } = useUserManagement(userIdToEdit);

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
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Effect for escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleActualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    handleSubmit();
  };

  const modalTitle = isEditMode
    ? `Edit User: ${formState.name}`
    : "Create New User";
  const submitButtonText = isEditMode ? "Save Changes" : "Create User";
  const submittingButtonText = isEditMode ? "Saving..." : "Creating...";

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
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <IoEyeOff /> : <IoEye />}
                    </button>
                  </div>
                </div>

                {/* --- ROLES SECTION REMOVED --- */}

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
                    disabled={isSubmitting} // The check for role assignments is now removed
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
  );
};

export default ManageUserModal;
