// src/features/partners/components/AddEditPartnerModal.tsx

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IoClose, IoAdd } from "react-icons/io5";
import { PartnerType } from "@prisma/client";

import baseStyles from "@/features/shared/components/ModalBase.module.css";
import formStyles from "./AddEditPartnerModal.module.css";
import { useStatuses } from "@/hooks/useStatuses";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { StatusManagementModal } from "@/features/status/components/StatusManagementModal";

// ✅ Use both create and update schemas
import {
  createPartnerSchema,
  updatePartnerSchema,
  CreatePartnerPayload,
  UpdatePartnerPayload,
} from "@/lib/schemas/partner.schema";
import { PartnerClient } from "@/lib/types/models.client";
import { AccountNodeData } from "@/lib/types/ui";

interface AddEditPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ✅ REFINED: onSubmit now expects either create or update payload type.
  onSubmit: (data: CreatePartnerPayload | UpdatePartnerPayload) => void;
  initialData?: PartnerClient | null;
  isSubmitting?: boolean;
  // ✨ NEW: Journal modal integration
  onOpenJournalSelector: (
    onSelectCallback: (journalNode: AccountNodeData) => void
  ) => void;
}

const AddEditPartnerModal: React.FC<AddEditPartnerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
  onOpenJournalSelector,
}) => {
  const isEditMode = Boolean(initialData);
  
  // ✨ NEW: State for selected journal
  const [selectedJournal, setSelectedJournal] = useState<AccountNodeData | null>(null);
  
  // ✨ NEW: State for status management modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  
  // ✨ NEW: Hook to fetch statuses
  const { statuses, isLoading: statusesLoading } = useStatuses();

  // ✅ CORE CHANGE: The form uses appropriate schema based on edit mode.
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreatePartnerPayload>({
    // Use appropriate schema for validation based on edit mode.
    resolver: zodResolver(isEditMode ? updatePartnerSchema : createPartnerSchema),
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
    if (!isOpen || isEditMode) {
      setSelectedJournal(null);
    }
  }, [isOpen, isEditMode]);

  // Effect to reset the form when the modal opens or initialData changes.
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // If editing, reset the form with existing data
        reset(initialData);
      } else {
        // If adding, reset to default new partner values
        reset({
          name: "",
          partnerType: "LEGAL_ENTITY",
          notes: "",
          taxId: "",
          registrationNumber: "",
          journalId: "",
        });
      }
    }
  }, [isOpen, initialData, reset]);

  // Effect to handle Escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Handle body scroll lock
  useBodyScrollLock(isOpen);

  const partnerTypeOptions = Object.values(PartnerType).map((pt) => (
    <option key={pt} value={pt}>
      {pt
        .replace(/_/g, " ")
        .toLocaleLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase())}
    </option>
  ));

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
              className={`${baseStyles.modalContent} ${formStyles.addEditPartnerModalContent}`}
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
                {isEditMode ? "Edit Partner" : "Add New Partner"}
              </h2>

              <div className={baseStyles.modalBody}>
                {/* ✅ The `handleSubmit` function from react-hook-form now passes a fully-typed `CreatePartnerPayload` to our `onSubmit` prop. */}
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className={formStyles.partnerForm}
                >
                <div className={formStyles.formGroup}>
                  <label htmlFor="name">Name *</label>
                  <input
                    id="name"
                    {...register("name")}
                    disabled={isSubmitting}
                  />
                  {errors.name && (
                    <p className={formStyles.errorText}>{errors.name.message}</p>
                  )}
                </div>

                {/* Conditionally render based on edit mode */}
                {isEditMode ? (
                  <div className={formStyles.formGroup}>
                    <label>Partner Type</label>
                    <input
                      type="text"
                      value={initialData?.partnerType
                        .replace(/_/g, " ")
                        .toLocaleLowerCase()
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                      readOnly
                      disabled
                      className={formStyles.readOnlyInput}
                    />
                  </div>
                ) : (
                  <div className={formStyles.formGroup}>
                    <label htmlFor="partnerType">Partner Type *</label>
                    <select
                      id="partnerType"
                      {...register("partnerType")}
                      disabled={isSubmitting}
                    >
                      {partnerTypeOptions}
                    </select>
                    {errors.partnerType && (
                      <p className={formStyles.errorText}>
                        {errors.partnerType.message}
                      </p>
                    )}
                  </div>
                )}

                <div className={formStyles.formGroup}>
                  <label htmlFor="notes">Notes</label>
                  <textarea
                    id="notes"
                    {...register("notes")}
                    disabled={isSubmitting}
                  />
                  {errors.notes && (
                    <p className={formStyles.errorText}>{errors.notes.message}</p>
                  )}
                </div>

                <div className={formStyles.formGroup}>
                  <label htmlFor="taxId">Tax ID</label>
                  <input
                    id="taxId"
                    {...register("taxId")}
                    disabled={isSubmitting}
                  />
                  {errors.taxId && (
                    <p className={formStyles.errorText}>{errors.taxId.message}</p>
                  )}
                </div>

                <div className={formStyles.formGroup}>
                  <label htmlFor="registrationNumber">Registration Number</label>
                  <input
                    id="registrationNumber"
                    {...register("registrationNumber")}
                    disabled={isSubmitting}
                  />
                  {errors.registrationNumber && (
                    <p className={formStyles.errorText}>
                      {errors.registrationNumber.message}
                    </p>
                  )}
                </div>

                {/* Status field - only show in edit mode */}
                {isEditMode && (
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
                      <p className={formStyles.errorText}>
                        {errors.statusId.message}
                      </p>
                    )}
                  </div>
                )}

                {/* ✨ NEW: Journal selection for new partners */}
                {!isEditMode && (
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
                      <p className={formStyles.errorText}>
                        {errors.journalId.message}
                      </p>
                    )}
                  </div>
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
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? isEditMode
                          ? "Saving..."
                          : "Adding..."
                        : isEditMode
                        ? "Save Changes"
                        : "Add Partner"}
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

export default AddEditPartnerModal;
