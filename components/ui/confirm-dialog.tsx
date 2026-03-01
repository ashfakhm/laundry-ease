"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { reportError } from "@/lib/client-error";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "info",
  loading = false,
  children,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      reportError("ConfirmationError", error);
    } finally {
      setIsConfirming(false);
    }
  }, [onConfirm, onClose]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && !isConfirming) {
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleConfirm, isOpen, isConfirming, onClose]);

  const variantStyles = {
    danger: {
      icon: AlertTriangle,
      iconColor: "text-red-600",
      iconBg: "bg-red-100 dark:bg-red-900/20",
      confirmButton: "bg-red-600 hover:bg-red-700 text-white",
    },
    warning: {
      icon: AlertTriangle,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-100 dark:bg-amber-900/20",
      confirmButton: "bg-amber-600 hover:bg-amber-700 text-white",
    },
    info: {
      icon: Info,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-100 dark:bg-blue-900/20",
      confirmButton: "bg-primary hover:bg-primary/90 text-primary-foreground",
    },
  };

  const style = variantStyles[variant];
  const Icon = style.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                disabled={isConfirming || loading}
              >
                <X className="h-4 w-4" />
              </button>

              {/* Icon */}
              <div className={cn("mb-4 inline-flex rounded-full p-3", style.iconBg)}>
                <Icon className={cn("h-6 w-6", style.iconColor)} />
              </div>

              {/* Content */}
              <h3 className="mb-2 text-lg font-bold text-foreground">{title}</h3>
              <p className="mb-6 text-sm text-muted-foreground">{message}</p>
              
              {/* Custom children content */}
              {children && <div className="mb-6">{children}</div>}

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  disabled={isConfirming || loading}
                  className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelText}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isConfirming || loading}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    style.confirmButton
                  )}
                >
                  {isConfirming || loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Processing...
                    </span>
                  ) : (
                    confirmText
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// Hook for easier usage
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    variant?: "danger" | "warning" | "info";
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showConfirm = (config: Omit<typeof dialogState, "isOpen">) => {
    setDialogState({ ...config, isOpen: true });
  };

  const closeDialog = () => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  return {
    showConfirm,
    closeDialog,
    dialogProps: {
      ...dialogState,
      onClose: closeDialog,
    },
  };
}
