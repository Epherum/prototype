// src/features/goods/components/AddEditGoodModal.tsx

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { IoClose, IoAdd } from "react-icons/io5";

// ✅ 1. Import new, robust types and schemas
import { createGoodSchema, updateGoodSchema, CreateGoodPayload, UpdateGoodPayload } from "@/lib/schemas/good.schema";
import { GoodClient } from "@/lib/types/models.client";
import { AccountNodeData } from "@/lib/types/ui";

// ✅ 2. Use a consistent styling approach
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import formStyles from "./AddEditGoodModal.module.css";
import { useStatuses } from "@/hooks/useStatuses";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { StatusManagementModal } from "@/features/status/components/StatusManagementModal";

// ✅ 3. Update the props to use the new types
interface AddEditGoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateGoodPayload) => void;
  initialData: GoodClient | null;
  isSubmitting: boolean;
  // ✨ NEW: Journal modal integration
  onOpenJournalSelector: (
    onSelectCallback: (journalNode: AccountNodeData) => void
  ) => void;
}

const AddEditGoodModal: React.FC<AddEditGoodModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
  onOpenJournalSelector,
}) => {
  const isEditing = !!initialData;
  
  // ✨ NEW: State for selected journal
  const [selectedJournal, setSelectedJournal] = useState<AccountNodeData | null>(null);
  
  // ✨ NEW: State for status management modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  
  // ✨ NEW: Hook to fetch statuses
  const { statuses, isLoading: statusesLoading } = useStatuses();

  // ✅ 4. Setup react-hook-form with Zod resolver - use correct schema based on mode
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateGoodPayload>({
    resolver: zodResolver(isEditing ? updateGoodSchema : createGoodSchema),
    defaultValues: {
      label: "",
      referenceCode: "",
      barcode: "",
      description: "",
      taxCodeId: undefined,
      unitCodeId: undefined,
      typeCode: "",
      journalId: "",
    },
  });

  // Handle journal selection from modal
  const handleJournalSelected = (journalNode: AccountNodeData) => {
    setSelectedJournal(journalNode);
    setValue("journalId", journalNode.id);
  };

  // Open journal selector
  const handleOpenJournalSelector = () => {
    onOpenJournalSelector(handleJournalSelected);
  };

  // Reset selected journal when modal opens/closes
  useEffect(() => {
    if (!isOpen || isEditing) {
      setSelectedJournal(null);
    }
  }, [isOpen, isEditing]);

  // Handle body scroll lock
  useBodyScrollLock(isOpen);

  // Effect for escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // ✅ 5. Replace manual form initialization with react-hook-form's `reset`
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // When editing, populate the form with initialData
        reset({
          label: initialData.label,
          // Per schema, these fields are not updatable, but we show them
          referenceCode: initialData.referenceCode || "",
          barcode: initialData.barcode || "",
          description: initialData.description || "",
          taxCodeId: initialData.taxCodeId ?? undefined,
          unitCodeId: initialData.unitCodeId ?? undefined,
          typeCode: initialData.typeCode || "",
          // ... map other fields
        });
      } else {
        // When adding, reset to default values
        reset();
      }
    }
  }, [initialData, isOpen, reset]);

  // ✅ 6. The `handleSubmit` from react-hook-form handles validation.
  // This function only runs if validation succeeds.
  // The 'data' is guaranteed to be `CreateGoodPayload`.
  const handleFormSubmit = (data: CreateGoodPayload) => {
    console.log('Form submitted with data:', data);
    console.log('Is editing:', isEditing);
    onSubmit(data);
  };

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
        >
          <motion.div
            className={`${baseStyles.modalContent} ${formStyles.addEditGoodModalContent}`}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
          >
            <button
              className={baseStyles.modalCloseButton}
              onClick={onClose}
              aria-label="Close modal"
            >
              <IoClose />
            </button>
            <h2 className={baseStyles.modalTitle}>
              {isEditing ? "Edit Good/Service" : "Add New Good/Service"}
            </h2>

            <div className={baseStyles.modalBody}>
              {/* ✅ 7. The form now uses the `handleSubmit` wrapper */}
              <form
                onSubmit={handleSubmit(handleFormSubmit)}
                className={formStyles.goodForm}
                noValidate
              >
              <div className={formStyles.formGroup}>
                <label htmlFor="label">Label *</label>
                {/* ✅ 8. Use `register` instead of manual value/onChange */}
                <input
                  id="label"
                  {...register("label")}
                  disabled={isSubmitting}
                />
                {/* ✅ 9. Display validation errors from the Zod schema */}
                {errors.label && (
                  <p className={formStyles.error}>{errors.label.message}</p>
                )}
              </div>

              <div className={formStyles.formGroup}>
                <label htmlFor="referenceCode">Reference Code</label>
                <input
                  id="referenceCode"
                  {...register("referenceCode")}
                  disabled={isEditing || isSubmitting}
                />
                {errors.referenceCode && (
                  <p className={formStyles.error}>
                    {errors.referenceCode.message}
                  </p>
                )}
              </div>

              <div className={formStyles.formGroup}>
                <label htmlFor="barcode">Barcode</label>
                <input
                  id="barcode"
                  {...register("barcode")}
                  disabled={isEditing || isSubmitting}
                />
                {errors.barcode && (
                  <p className={formStyles.error}>{errors.barcode.message}</p>
                )}
              </div>

              <div className={formStyles.formGroup}>
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  {...register("description")}
                  disabled={isSubmitting}
                />
                {errors.description && (
                  <p className={formStyles.error}>
                    {errors.description.message}
                  </p>
                )}
              </div>


              {/* Status field - only show in edit mode */}
              {isEditing && (
                <div className={formStyles.formGroup}>
                  <div className={formStyles.labelWithButton}>
                    <label htmlFor="statusId">Status</label>
                    <button
                      type="button"
                      onClick={() => setShowStatusModal(true)}
                      className={formStyles.manageStatusButton}
                      disabled={isSubmitting}
                      title="Manage statuses"
                    >
                      <IoAdd size={14} />
                    </button>
                  </div>
                  <select
                    id="statusId"
                    {...register("statusId")}
                    disabled={isSubmitting || statusesLoading}
                    defaultValue={initialData?.statusId || ""}
                  >
                    <option value="">Select status...</option>
                    {statuses?.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                  {errors.statusId && (
                    <p className={formStyles.error}>
                      {errors.statusId.message}
                    </p>
                  )}
                </div>
              )}

              {/* ✨ NEW: Journal selection for new goods */}
              {!isEditing && (
                <div className={formStyles.formGroup}>
                  <label>Journal Assignment *</label>
                  <div className={formStyles.journalSelectionContainer}>
                    {selectedJournal ? (
                      <div className={formStyles.selectedJournalDisplay}>
                        <span className={formStyles.selectedJournalName}>
                          {selectedJournal.name} ({selectedJournal.id})
                        </span>
                        <button
                          type="button"
                          onClick={handleOpenJournalSelector}
                          className={formStyles.changeJournalButton}
                          disabled={isSubmitting}
                        >
                          Change Journal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleOpenJournalSelector}
                        className={formStyles.selectJournalButton}
                        disabled={isSubmitting}
                      >
                        Select Journal
                      </button>
                    )}
                  </div>
                  {errors.journalId && (
                    <p className={formStyles.error}>
                      {errors.journalId.message}
                    </p>
                  )}
                </div>
              )}

              {/* Other fields follow the same pattern */}

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
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      
      {/* Status Management Modal */}
      <StatusManagementModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
      />
    </>
  );
};

export default AddEditGoodModal;
