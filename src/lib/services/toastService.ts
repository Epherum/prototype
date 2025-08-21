// src/lib/services/toastService.ts
import type { ToastType } from "@/contexts/ToastContext";

// Global toast service to be used outside of React components (like in Zustand stores)
class ToastService {
  private toastHandler: ((type: ToastType, title: string, message?: string, duration?: number) => void) | null = null;

  setToastHandler(handler: (type: ToastType, title: string, message?: string, duration?: number) => void) {
    this.toastHandler = handler;
  }

  success(title: string, message?: string, duration?: number) {
    this.toastHandler?.("success", title, message, duration);
  }

  error(title: string, message?: string, duration?: number) {
    this.toastHandler?.("error", title, message, duration);
  }

  warning(title: string, message?: string, duration?: number) {
    this.toastHandler?.("warning", title, message, duration);
  }

  info(title: string, message?: string, duration?: number) {
    this.toastHandler?.("info", title, message, duration);
  }
}

export const toastService = new ToastService();