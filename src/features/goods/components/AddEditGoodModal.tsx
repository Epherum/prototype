// src/features/goods/components/AddEditGoodModal.tsx

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { IoClose } from "react-icons/io5";

// ✅ 1. Import new, robust types and schemas
import { createGoodSchema, CreateGoodPayload } from "@/lib/schemas/good.schema";
import { GoodClient } from "@/lib/types/models.client";

// ✅ 2. Use a consistent styling approach
import baseStyles from "@/features/shared/components/ModalBase.module.css";
import formStyles from "./AddEditGoodModal.module.css";

// ✅ 3. Update the props to use the new types
interface AddEditGoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateGoodPayload) => void;
  initialData: GoodClient | null;
  isSubmitting: boolean;
}

const AddEditGoodModal: React.FC<AddEditGoodModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
}) => {
  const isEditing = !!initialData;

  // ✅ 4. Setup react-hook-form with Zod resolver
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateGoodPayload>({
    resolver: zodResolver(createGoodSchema),
    defaultValues: {
      label: "",
      referenceCode: "",
      barcode: "",
      description: "",
      price: undefined,
      taxCodeId: undefined,
      unitCodeId: undefined,
      typeCode: "",
    },
  });

  // Effect for escape key & body scroll (Good practice, retained from your original)
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
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
          price: 0 as number, // Default to 0 if not provided
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
    onSubmit(data);
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
              {isEditing ? "Edit Good/Service" : "Add New Good/Service"}
            </h2>

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

              <div className={formStyles.formGroup}>
                <label htmlFor="price">Price</label>
                {/* ✅ 10. `valueAsNumber` automatically handles string-to-number conversion */}
                <input
                  type="number"
                  step="0.01"
                  id="price"
                  {...register("price", { valueAsNumber: true })}
                  disabled={isSubmitting}
                />
                {errors.price && (
                  <p className={formStyles.error}>{errors.price.message}</p>
                )}
              </div>

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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddEditGoodModal;
