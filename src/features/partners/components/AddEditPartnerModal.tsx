// src/features/partners/components/AddEditPartnerModal.tsx

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IoClose } from "react-icons/io5";
import { PartnerType } from "@prisma/client";

import baseStyles from "@/features/shared/components/ModalBase.module.css";
import formStyles from "./AddEditPartnerModal.module.css";

// ✅ Use only the most complete schema and payload type
import {
  createPartnerSchema,
  CreatePartnerPayload,
} from "@/lib/schemas/partner.schema";
import { PartnerClient } from "@/lib/types/models.client";

interface AddEditPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ✅ REFINED: onSubmit now expects the single, complete payload type.
  onSubmit: (data: CreatePartnerPayload) => void;
  initialData?: PartnerClient | null;
  isSubmitting?: boolean;
}

const AddEditPartnerModal: React.FC<AddEditPartnerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
}) => {
  const isEditMode = Boolean(initialData);

  // ✅ CORE CHANGE: The form is now typed ONLY with the complete payload type.
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePartnerPayload>({
    // Always use the full schema for validation. Zod handles partials correctly.
    resolver: zodResolver(createPartnerSchema),
  });

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
          isUs: false,
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

  // Effect to handle body scroll lock
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const partnerTypeOptions = Object.values(PartnerType).map((pt) => (
    <option key={pt} value={pt}>
      {pt
        .replace(/_/g, " ")
        .toLocaleLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase())}
    </option>
  ));

  return (
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

              <div
                className={`${formStyles.formGroup} ${formStyles.formGroupCheckbox}`}
              >
                <input
                  type="checkbox"
                  id="isUs"
                  {...register("isUs")}
                  disabled={isSubmitting}
                />
                <label htmlFor="isUs">This is 'Us' (Our Company)</label>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddEditPartnerModal;
