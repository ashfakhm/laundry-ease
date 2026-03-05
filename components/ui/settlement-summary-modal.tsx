"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle,
  AlertTriangle,
  Building2,
  User,
  CreditCard,
  Smartphone,
  Landmark,
  Wallet,
  Mail,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/utils/monetary";

export interface SettlementProviderDetails {
  name?: string;
  upiId?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
  accountHolderName?: string | null;
  email?: string;
  phone?: string;
  manualTransferRequired?: boolean;
}

export interface SettlementSeekerDetails {
  name?: string;
  paymentMethod?: string | null;
  vpa?: string | null;
  bank?: string | null;
  wallet?: string | null;
  card?: {
    network?: string;
    last4?: string;
    issuer?: string;
  } | null;
  email?: string;
  phone?: string;
  manualTransferRequired?: boolean;
}

export interface SettlementSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerDetails?: SettlementProviderDetails | null;
  seekerDetails?: SettlementSeekerDetails | null;
  providerAmount: number;
  seekerAmount: number;
  hasManualTransfers: boolean;
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/40 border border-border/40 px-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium break-all">{value}</p>
      </div>
    </div>
  );
}

function PartyCard({
  title,
  amount,
  isManual,
  icon: Icon,
  iconBg,
  amountColor,
  children,
}: {
  title: string;
  amount: number;
  isManual: boolean;
  icon: React.ElementType;
  iconBg: string;
  amountColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 space-y-3",
        isManual
          ? "border-amber-300 bg-amber-50/60 dark:border-amber-700/60 dark:bg-amber-950/20"
          : "border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/10",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn("rounded-xl p-2", iconBg)}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-base font-extrabold", amountColor)}>
            {formatInr(amount)}
          </span>
          {isManual ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/60">
              <AlertTriangle className="h-3 w-3" />
              Manual
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/50">
              <CheckCircle className="h-3 w-3" />
              Auto
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function SettlementSummaryModal({
  isOpen,
  onClose,
  providerDetails,
  seekerDetails,
  providerAmount,
  seekerAmount,
  hasManualTransfers,
}: SettlementSummaryModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-6 py-4 backdrop-blur-sm">
                <div>
                  <h2 className="text-lg font-bold">Settlement Summary</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Complaint resolved — review transfer details below
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Manual transfer warning banner */}
                {hasManualTransfers && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700/60 dark:bg-amber-950/30">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Some transfers require <strong>manual action</strong>.
                      Please process the amounts marked{" "}
                      <span className="font-bold">Manual</span> via UPI or bank
                      transfer immediately.
                    </p>
                  </div>
                )}

                {/* Provider payout */}
                {providerDetails && providerAmount > 0.01 && (
                  <PartyCard
                    title="Provider Payout"
                    amount={providerAmount}
                    isManual={!!providerDetails.manualTransferRequired}
                    icon={Building2}
                    iconBg="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    amountColor="text-emerald-600 dark:text-emerald-400"
                  >
                    {providerDetails.name && (
                      <DetailRow
                        icon={User}
                        label="Provider Name"
                        value={providerDetails.name}
                      />
                    )}
                    {providerDetails.upiId && (
                      <DetailRow
                        icon={Smartphone}
                        label="UPI ID"
                        value={providerDetails.upiId}
                      />
                    )}
                    {providerDetails.accountNumber && (
                      <DetailRow
                        icon={Landmark}
                        label="Account Number"
                        value={providerDetails.accountNumber}
                      />
                    )}
                    {providerDetails.ifsc && (
                      <DetailRow
                        icon={Building2}
                        label="IFSC Code"
                        value={providerDetails.ifsc}
                      />
                    )}
                    {providerDetails.accountHolderName && (
                      <DetailRow
                        icon={User}
                        label="Account Holder"
                        value={providerDetails.accountHolderName}
                      />
                    )}
                    {providerDetails.email && (
                      <DetailRow
                        icon={Mail}
                        label="Email"
                        value={providerDetails.email}
                      />
                    )}
                    {providerDetails.phone && (
                      <DetailRow
                        icon={Phone}
                        label="Phone"
                        value={providerDetails.phone}
                      />
                    )}
                  </PartyCard>
                )}

                {/* Seeker refund */}
                {seekerDetails && seekerAmount > 0.01 && (
                  <PartyCard
                    title="Seeker Refund"
                    amount={seekerAmount}
                    isManual={!!seekerDetails.manualTransferRequired}
                    icon={User}
                    iconBg="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    amountColor="text-blue-600 dark:text-blue-400"
                  >
                    {seekerDetails.name && (
                      <DetailRow
                        icon={User}
                        label="Seeker Name"
                        value={seekerDetails.name}
                      />
                    )}
                    {seekerDetails.paymentMethod && (
                      <DetailRow
                        icon={CreditCard}
                        label="Payment Method"
                        value={seekerDetails.paymentMethod.toUpperCase()}
                      />
                    )}
                    {seekerDetails.vpa && (
                      <DetailRow
                        icon={Smartphone}
                        label="UPI ID"
                        value={seekerDetails.vpa}
                      />
                    )}
                    {seekerDetails.bank && (
                      <DetailRow
                        icon={Landmark}
                        label="Bank"
                        value={seekerDetails.bank}
                      />
                    )}
                    {seekerDetails.wallet && (
                      <DetailRow
                        icon={Wallet}
                        label="Wallet"
                        value={seekerDetails.wallet}
                      />
                    )}
                    {seekerDetails.card && (
                      <DetailRow
                        icon={CreditCard}
                        label="Card"
                        value={[
                          seekerDetails.card.network,
                          seekerDetails.card.last4
                            ? `****${seekerDetails.card.last4}`
                            : null,
                          seekerDetails.card.issuer
                            ? `(${seekerDetails.card.issuer})`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      />
                    )}
                    {seekerDetails.email && (
                      <DetailRow
                        icon={Mail}
                        label="Email"
                        value={seekerDetails.email}
                      />
                    )}
                    {seekerDetails.phone && (
                      <DetailRow
                        icon={Phone}
                        label="Phone"
                        value={seekerDetails.phone}
                      />
                    )}
                  </PartyCard>
                )}

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
