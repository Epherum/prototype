// src/components/modals/AddEditGoodModal.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import baseStyles from "./ModalBase.module.css"; // Shared modal shell styles
import formStyles from "./AddEditGoodModal.module.css"; // Create this CSS Module
import { IoClose } from "react-icons/io5";
import type {
  Good,
  CreateGoodClientData,
  UpdateGoodClientData,
} from "@/lib/types";

interface AddEditGoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    data: CreateGoodClientData | UpdateGoodClientData,
    id?: string
  ) => void;
  initialData?: Good | null;
  isSubmitting?: boolean;
  // You might need to pass lists for TaxCodes and UnitsOfMeasure if they are selectable
  // taxCodes?: TaxCodeType[];
  // unitsOfMeasure?: UnitOfMeasureType[];
}

const AddEditGoodModal: React.FC<AddEditGoodModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
}) => {
  const isEditMode = Boolean(initialData);
  const [formData, setFormData] = useState<Partial<CreateGoodClientData>>({});

  useEffect(() => {
    // Escape key & body scroll
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    // Form data initialization
    if (isOpen) {
      if (isEditMode && initialData) {
        // Map initialData (which is of type Good from frontend) to form data
        const {
          id,
          taxCode,
          unitOfMeasure,
          name,
          code,
          unit_code,
          ...editableData
        } = initialData;
        setFormData({
          ...editableData,
          label: initialData.label || initialData.name || "", // Prefer label if present
          referenceCode: initialData.referenceCode || initialData.code,
          taxCodeId: initialData.taxCodeId, // Use the ID
          unitCodeId: initialData.unitCodeId, // Use the ID
        });
      } else {
        setFormData({}); // Clear for add mode
      }
    }
  }, [isOpen, initialData, isEditMode]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    let processedValue: string | number | boolean | null = value;

    if (type === "checkbox" && e.target instanceof HTMLInputElement) {
      processedValue = e.target.checked;
    } else if (
      type === "number" ||
      name === "taxCodeId" ||
      name === "unitCodeId" ||
      name === "price"
    ) {
      processedValue = value === "" ? null : parseFloat(value); // Convert to number or null
      if (isNaN(processedValue as number)) processedValue = null; // If not a valid number, set to null
    } else {
      processedValue = value === "" ? null : value; // Set to null if empty for optional text fields
    }

    setFormData((prev) => ({ ...prev, [name]: processedValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.label) {
      alert("Label is required for a good/service.");
      return;
    }

    const dataToSubmit = { ...formData };
    // Ensure numeric fields are numbers or null
    if (dataToSubmit.taxCodeId !== undefined)
      dataToSubmit.taxCodeId = dataToSubmit.taxCodeId
        ? Number(dataToSubmit.taxCodeId)
        : null;
    if (dataToSubmit.unitCodeId !== undefined)
      dataToSubmit.unitCodeId = dataToSubmit.unitCodeId
        ? Number(dataToSubmit.unitCodeId)
        : null;
    if (dataToSubmit.price !== undefined)
      dataToSubmit.price = dataToSubmit.price
        ? Number(dataToSubmit.price)
        : null;

    if (isEditMode && initialData?.id) {
      onSubmit(dataToSubmit as UpdateGoodClientData, initialData.id);
    } else {
      onSubmit(dataToSubmit as CreateGoodClientData);
    }
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
              {isEditMode ? "Edit Good/Service" : "Add New Good/Service"}
            </h2>

            <form onSubmit={handleSubmit} className={formStyles.goodForm}>
              <div className={formStyles.formGroup}>
                <label htmlFor="label">Label *</label>
                <input
                  type="text"
                  id="label"
                  name="label"
                  value={formData.label || ""}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className={formStyles.formGroup}>
                <label htmlFor="referenceCode">Reference Code</label>
                <input
                  type="text"
                  id="referenceCode"
                  name="referenceCode"
                  value={formData.referenceCode || ""}
                  onChange={handleChange}
                  disabled={isEditMode || isSubmitting}
                />
                {/* Typically, ref code is not editable after creation */}
              </div>
              <div className={formStyles.formGroup}>
                <label htmlFor="typeCode">
                  Type Code (e.g., SERVICE, PRODUCT)
                </label>
                <input
                  type="text"
                  id="typeCode"
                  name="typeCode"
                  value={formData.typeCode || ""}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              <div className={formStyles.formGroup}>
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description || ""}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              <div className={formStyles.formGroup}>
                <label htmlFor="price">Price</label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={
                    formData.price === null || formData.price === undefined
                      ? ""
                      : formData.price
                  }
                  onChange={handleChange}
                  step="0.01"
                  disabled={isSubmitting}
                />
              </div>

              {/* Placeholders for TaxCodeId and UnitCodeId - these would ideally be dropdowns */}
              <div className={formStyles.formGroup}>
                <label htmlFor="taxCodeId">Tax Code ID (Numeric)</label>
                <input
                  type="number"
                  id="taxCodeId"
                  name="taxCodeId"
                  value={
                    formData.taxCodeId === null ||
                    formData.taxCodeId === undefined
                      ? ""
                      : formData.taxCodeId
                  }
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {/* Replace with <select> if you fetch tax codes */}
              </div>
              <div className={formStyles.formGroup}>
                <label htmlFor="unitCodeId">Unit of Measure ID (Numeric)</label>
                <input
                  type="number"
                  id="unitCodeId"
                  name="unitCodeId"
                  value={
                    formData.unitCodeId === null ||
                    formData.unitCodeId === undefined
                      ? ""
                      : formData.unitCodeId
                  }
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {/* Replace with <select> if you fetch units */}
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
                    : "Add Good/Service"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddEditGoodModal;
