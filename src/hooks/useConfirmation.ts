// src/hooks/useConfirmation.ts
"use client";

import { useState, useCallback } from "react";
import type { ConfirmationType } from "@/components/notifications/ConfirmationModal";

interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmationType;
}

interface ConfirmationState extends ConfirmationOptions {
  isOpen: boolean;
  onConfirm: () => void;
}

export const useConfirmation = () => {
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    type: "info",
    onConfirm: () => {},
  });

  const showConfirmation = useCallback((
    options: ConfirmationOptions,
    onConfirm: () => void
  ) => {
    setConfirmation({
      isOpen: true,
      confirmText: "Confirm",
      cancelText: "Cancel",
      type: "info",
      ...options,
      onConfirm,
    });
  }, []);

  const hideConfirmation = useCallback(() => {
    setConfirmation(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  // Convenience methods
  const confirmDelete = useCallback((
    itemName: string,
    onConfirm: () => void,
    customMessage?: string
  ) => {
    showConfirmation({
      title: "Delete Confirmation",
      message: customMessage || `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
    }, onConfirm);
  }, [showConfirmation]);

  const confirmAction = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    options?: Partial<ConfirmationOptions>
  ) => {
    showConfirmation({
      title,
      message,
      ...options,
    }, onConfirm);
  }, [showConfirmation]);

  return {
    confirmation,
    showConfirmation,
    hideConfirmation,
    confirmDelete,
    confirmAction,
  };
};