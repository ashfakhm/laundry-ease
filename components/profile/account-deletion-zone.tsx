"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Trash2 } from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface AccountDeletionZoneProps {
  apiEndpoint: string;
}

export function AccountDeletionZone({ apiEndpoint }: AccountDeletionZoneProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const toast = useToast();

  const handleDelete = async () => {
    try {
      const res = await fetch(apiEndpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: password }),
      });

      if (!res.ok) {
        const err = await res.json();
        // Check for specific blockers
        if (err.error?.details?.blockers) {
          throw new Error(`Cannot delete account: ${err.error.details.blockers.join(", ")}`);
        }
        throw new Error(err.error?.message || err.message || "Failed to delete account");
      }

      toast.success("Account deleted successfully.");
      // The session should be invalidated now, prompt re-login or redirect via refresh
      window.location.href = "/login";
    } catch (error: any) {
      toast.error(error.message || "Failed to delete account");
      throw error; // Let ConfirmDialog catch it and handle loading state
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <SpotlightCard className="rounded-3xl bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900 overflow-hidden p-8 mt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 dark:bg-red-900/40 dark:text-red-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold font-heading text-red-700 dark:text-red-500">Danger Zone</h2>
          </div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Delete Account</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Once you delete your account, there is no going back. Please be certain.
                All your active orders and bookings must be completed or cancelled first.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDialogOpen(true)}
              className="shrink-0 h-10 px-6 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-500 font-medium rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </button>
          </div>
        </SpotlightCard>
      </motion.div>

      <ConfirmDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Account"
        message="Are you sure you want to delete your account? This action cannot be undone."
        confirmText="Yes, Delete My Account"
        variant="danger"
      >
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Current Password (Required for Email/Password sign in)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to confirm"
            className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
