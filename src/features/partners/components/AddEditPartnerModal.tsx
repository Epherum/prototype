// src/components/modals/AddEditPartnerModal.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import baseStyles from "@/features/shared/components/ModalBase.module.css"; // Shared styles
import formStyles from "./AddEditPartnerModal.module.css"; // Styles specific to this modal's form
import { IoClose } from "react-icons/io5";
import type {
  Partner,
  PartnerTypeClient,
  CreatePartnerClientData,
  UpdatePartnerClientData,
} from "@/lib/types";
import { PartnerType } from "@prisma/client"; // For the enum values

interface AddEditPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    data: CreatePartnerClientData | UpdatePartnerClientData,
    id?: string
  ) => void;
  initialData?: Partner | null;
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
  const [formData, setFormData] = useState<Partial<CreatePartnerClientData>>(
    {}
  );

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

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && initialData) {
        const { id, partnerType, ...editableData } = initialData;
        setFormData(editableData as UpdatePartnerClientData);
      } else {
        setFormData({ partnerType: PartnerType.LEGAL_ENTITY }); // Default
      }
    }
  }, [isOpen, initialData, isEditMode]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value || null })); // Set to null if empty to clear optional fields
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (isEditMode && initialData?.id) {
      onSubmit(formData as UpdatePartnerClientData, initialData.id);
    } else {
      if (!formData.name || !formData.partnerType) {
        alert("Name and Partner Type are required.");
        return;
      }
      onSubmit(formData as CreatePartnerClientData);
    }
  };

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
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={`${baseStyles.modalContent} ${formStyles.addEditPartnerModalContent}`} // Specific class for width, etc.
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
            <h2 className={baseStyles.modalTitle}>
              {isEditMode ? "Edit Partner" : "Add New Partner"}
            </h2>

            <form onSubmit={handleSubmit} className={formStyles.partnerForm}>
              {/* Name Field */}
              <div className={formStyles.formGroup}>
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name || ""}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* Partner Type Field (conditional) */}
              {!isEditMode ? (
                <div className={formStyles.formGroup}>
                  <label htmlFor="partnerType">Partner Type *</label>
                  <select
                    id="partnerType"
                    name="partnerType"
                    value={formData.partnerType || ""}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="" disabled>
                      Select Type...
                    </option>
                    {partnerTypeOptions}
                  </select>
                </div>
              ) : (
                initialData?.partnerType && (
                  <div className={formStyles.formGroup}>
                    <label>Partner Type</label>
                    <input
                      type="text"
                      value={initialData.partnerType
                        .replace(/_/g, " ")
                        .toLocaleLowerCase()
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                      readOnly
                      disabled
                      className={formStyles.readOnlyInput}
                    />
                  </div>
                )
              )}

              {/* Notes Field */}
              <div className={formStyles.formGroup}>
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes || ""}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>

              {/* Tax ID Field */}
              <div className={formStyles.formGroup}>
                <label htmlFor="taxId">Tax ID</label>
                <input
                  type="text"
                  id="taxId"
                  name="taxId"
                  value={formData.taxId || ""}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>

              {/* Registration Number Field */}
              <div className={formStyles.formGroup}>
                <label htmlFor="registrationNumber">Registration Number</label>
                <input
                  type="text"
                  id="registrationNumber"
                  name="registrationNumber"
                  value={formData.registrationNumber || ""}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>

              {/* isUs Checkbox */}
              <div
                className={`${formStyles.formGroup} ${formStyles.formGroupCheckbox}`}
              >
                <input
                  type="checkbox"
                  id="isUs"
                  name="isUs"
                  checked={formData.isUs || false}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                <label htmlFor="isUs">This is 'Us' (Our Company)</label>
              </div>

              {/* Placeholder for more fields like logoUrl, photoUrl, bioFatherName, etc. */}
              {/* Example:
              <div className={formStyles.formGroup}>
                <label htmlFor="logoUrl">Logo URL</label>
                <input type="url" id="logoUrl" name="logoUrl" value={formData.logoUrl || ""} onChange={handleChange} disabled={isSubmitting} />
              </div>
              */}

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
