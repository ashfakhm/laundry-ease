"use client";

import { useState, useEffect } from "react";
import React from "react";
import Image from "next/image";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { reportError } from "@/lib/client-error";
import { unwrapApiArray } from "@/lib/client-api";

type ActionType = "refund" | "penalty";

type ActionState = {
  open: boolean;
  paymentId: string | null;
  type: ActionType | null;
};

type Payment = {
  _id: string;
  order_id: string;
  payment_status: "held" | "released" | "refunded" | "unpaid" | "paid";
  total_price: number;
  delivery_charge: number;
  createdAt: string;
  escrow_release_at?: string;
  seeker?: { name: string };
  provider?: { name: string; businessName?: string; profilePicture?: string };
};

export default function AdminPaymentManagementPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // Action Modal State
  const [action, setAction] = useState<ActionState>({
    open: false,
    paymentId: null,
    type: null,
  });
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  async function fetchPayments() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/payments", { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        setPayments(unwrapApiArray<Payment>(payload));
      }
    } catch (error) {
      reportError("PaymentFetchError", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPayments();
  }, []);

  function openActionModal(paymentId: string, type: ActionType) {
    setAction({ open: true, paymentId, type });
    setAmount(0);
    setReason("");
    setActionError(null);
    setActionSuccess(null);
  }

  function closeActionModal() {
    setAction({ open: false, paymentId: null, type: null });
    setAmount(0);
    setReason("");
    setActionError(null);
    setActionSuccess(null);
  }

  async function handleActionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!action.paymentId || !action.type) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: action.paymentId,
          action: action.type,
          amount,
          reason,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(
          (typeof payload?.error === "string" && payload.error) ||
            payload?.error?.message ||
            payload?.message ||
            "Failed to process action",
        );
      }
      setActionSuccess(
        action.type === "refund"
          ? "Refund processed successfully."
          : "Penalty applied successfully.",
      );
      fetchPayments();
      setTimeout(closeActionModal, 1200);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setActionError(
          (err as { message?: string }).message || "Unknown error",
        );
      } else {
        setActionError("Unknown error");
      }
    } finally {
      setActionLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "held":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Clock className="h-3 w-3" />
            In Escrow
          </span>
        );
      case "released":
      case "paid":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            {status === "released" ? "Released" : "Paid"}
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {status}
          </span>
        );
    }
  };

  const filteredPayments =
    filter === "all"
      ? payments
      : filter === "released"
        ? payments.filter(
            (p) =>
              p.payment_status === "released" || p.payment_status === "paid",
          )
        : payments.filter((p) => p.payment_status === filter);

  const totalRevenue = payments
    .filter(
      (p) => p.payment_status === "released" || p.payment_status === "paid",
    )
    .reduce((acc, curr) => acc + curr.total_price, 0);
  const settledTransactions = payments.filter(
    (p) => p.payment_status === "released" || p.payment_status === "paid",
  ).length;

  const escrowAmount = payments
    .filter((p) => p.payment_status === "held")
    .reduce((acc, curr) => acc + curr.total_price, 0);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">
            Loading payments...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Payment Management</h1>
          <p className="text-sm text-muted-foreground">
            Monitor payments and escrow transactions
          </p>
        </div>

        {/* Premium Stats Grid */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl border bg-card/50 p-6 shadow-sm backdrop-blur-md">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-100 text-emerald-700 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <DollarSign className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold tracking-wide uppercase">
                  Total Revenue
                </p>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-4xl font-bold text-foreground tracking-tight">
                  ₹{totalRevenue.toLocaleString()}
                </p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                <span>{settledTransactions} settled transactions</span>
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border bg-card/50 p-6 shadow-sm backdrop-blur-md">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-3 text-amber-700 dark:text-amber-300">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200/80 bg-amber-100 text-amber-700 shadow-sm dark:border-amber-800/60 dark:bg-amber-500/15 dark:text-amber-300">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold tracking-wide uppercase">
                  Escrow Balance
                </p>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-4xl font-bold text-foreground tracking-tight">
                  ₹{escrowAmount.toLocaleString()}
                </p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Funds held securely until delivery
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border bg-card/50 p-6 shadow-sm backdrop-blur-md">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-3 text-blue-700 dark:text-blue-300">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200/80 bg-blue-100 text-blue-700 shadow-sm dark:border-blue-800/60 dark:bg-blue-500/15 dark:text-blue-300">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold tracking-wide uppercase">
                  Transactions
                </p>
              </div>
              <p className="text-4xl font-bold text-foreground tracking-tight">
                {payments.length}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Total processed orders
              </p>
            </div>
          </div>
        </div>

        {/* Segmented Filters */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-xl bg-muted p-1 border border-border/50">
            {(["all", "held", "released", "unpaid"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`rounded-lg px-6 py-2.5 text-sm font-medium transition-all duration-200 ${
                  filter === status
                    ? "bg-background text-foreground shadow-sm scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                {status === "all"
                  ? "All"
                  : status === "held"
                    ? "In Escrow"
                    : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Premium Payments List */}
        <div className="space-y-4">
          {filteredPayments.map((payment) => (
            <div
              key={payment._id}
              className="group relative overflow-hidden rounded-2xl border bg-card/60 p-5 shadow-sm backdrop-blur-sm transition-all hover:bg-card/80 hover:shadow-md"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-linear-to-b from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-2">
                {/* ID & Status */}
                <div className="flex-1 space-y-2 min-w-50">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                      #
                      {(payment.order_id || payment._id || "")
                        .toString()
                        .slice(-6)
                        .toUpperCase()}
                    </span>
                    {getStatusBadge(payment.payment_status)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(payment.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Participants */}
                <div className="flex-1 grid grid-cols-2 gap-4">
                  {payment.seeker && (
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {payment.seeker.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">
                          From
                        </p>
                        <p className="text-sm font-medium truncate">
                          {payment.seeker.name}
                        </p>
                      </div>
                    </div>
                  )}
                  {payment.provider && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-100 text-xs font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {payment.provider.profilePicture ? (
                          <Image
                            src={payment.provider.profilePicture}
                            alt={
                              payment.provider.businessName ||
                              payment.provider.name
                            }
                            fill
                            sizes="32px"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (
                            payment.provider.businessName ||
                            payment.provider.name
                          )
                            .charAt(0)
                            .toUpperCase()
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">
                          To
                        </p>
                        <p className="text-sm font-medium truncate">
                          {payment.provider.businessName ||
                            payment.provider.name}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount & Countdown */}
                <div className="flex-1 flex items-center justify-end gap-6 text-right">
                  {payment.escrow_release_at &&
                    payment.payment_status === "held" && (
                      <div className="hidden lg:block text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                          Auto-Release In
                        </p>
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-200">
                          {/* Simple time logic here or keep it static/formatted */}
                          {new Date(
                            payment.escrow_release_at,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Amount
                    </p>
                    <p className="text-xl font-bold text-emerald-600 tabular-nums">
                      ₹{payment.total_price.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pl-4 border-l border-border/50 ml-4">
                  {(payment.payment_status === "held" ||
                    payment.payment_status === "released" ||
                    payment.payment_status === "paid") && (
                    <>
                      <button
                        className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        title="Refund"
                        onClick={() => openActionModal(payment._id, "refund")}
                      >
                        <span className="sr-only">Refund</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 7v6h6" />
                          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                        </svg>
                      </button>
                      <button
                        className="rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                        title="Penalty"
                        onClick={() => openActionModal(payment._id, "penalty")}
                      >
                        <span className="sr-only">Penalty</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                          <path d="M12 8v4" />
                          <path d="M12 16h.01" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Refund/Penalty Modal */}
        {action.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
              <h2 className="text-lg font-bold mb-2">
                {action.type === "refund" ? "Process Refund" : "Apply Penalty"}
              </h2>
              <form onSubmit={handleActionSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="input input-bordered w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="input input-bordered w-full"
                    required
                  />
                </div>
                {actionError && <div className="text-error">{actionError}</div>}
                {actionSuccess && (
                  <div className="text-success">{actionSuccess}</div>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={closeActionModal}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={actionLoading}
                  >
                    {actionLoading
                      ? "Processing..."
                      : action.type === "refund"
                        ? "Refund"
                        : "Apply Penalty"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
