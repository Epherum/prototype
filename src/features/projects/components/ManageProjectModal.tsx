import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoClose } from "react-icons/io5";
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import styles from "@/features/users/components/ManageUserModal.module.css";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface ManageProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSubmitting?: boolean;
  onSubmit: (formData: { name: string; template: string }) => void;
}

const MANAGE_PROJECT_MODAL_Z_INDEX = 1050;

const ManageProjectModal: React.FC<ManageProjectModalProps> = ({
  isOpen,
  onClose,
  isSubmitting,
  onSubmit,
}) => {
  // Handle body scroll lock
  useBodyScrollLock(isOpen);
  
  const [name, setName] = React.useState("");
  const [template, setTemplate] = React.useState("Template A");

  const handleActualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This would call the onSubmit prop in a real implementation.
    // For now, it just closes the modal.
    onClose();
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
          style={{ zIndex: MANAGE_PROJECT_MODAL_Z_INDEX }}
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
            <h2 className={baseStyles.modalTitle}>Create New Project</h2>

            <form
              onSubmit={handleActualSubmit}
              className={styles.createUserForm}
            >
              <div
                className={styles.leftColumn}
                style={{ gridColumn: "1 / -1" }}
              >
                <div className={styles.formGroup}>
                  <label htmlFor="projectName">Project Name *</label>
                  <input
                    type="text"
                    id="projectName"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isSubmitting}
                    placeholder="e.g., Q4 Infrastructure Upgrade"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="projectTemplate">
                    Project Mission Template
                  </label>
                  <select
                    id="projectTemplate"
                    name="template"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option>Template A</option>
                    <option>Template B</option>
                    <option>Template C</option>
                  </select>
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
                  disabled={isSubmitting || !name}
                >
                  {isSubmitting ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ManageProjectModal;
