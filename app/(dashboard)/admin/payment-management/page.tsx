"use client";

import { useState, useEffect } from "react";
import React from "react";
type ActionType = "refund" | "penalty";

type ActionState = {
  open: boolean;
  paymentId: string | null;
  type: ActionType | null;
};
  const [action, setAction] = useState<ActionState>({ open: false, paymentId: null, type: null });
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
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
          paymentId: action.paymentId,
          type: action.type,
          amount,
          reason,
        }),
      });
      if (!res.ok) throw new Error("Failed to process action");
      setActionSuccess(
        action.type === "refund"
          ? "Refund processed successfully."
          : "Penalty applied successfully."
      );
      fetchPayments();
      setTimeout(closeActionModal, 1200);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setActionError((err as { message?: string }).message || "Unknown error");
      } else {
        setActionError("Unknown error");
      }
    } finally {
      setActionLoading(false);
    }
  }
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
        <div className="space-y-4">
          {filteredPayments.map((payment) => (
            <div
              key={payment._id}
              className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          Order #{payment.order_id.slice(-8)}
                        </h3>
                        {getStatusBadge(payment.payment_status)}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {payment.seeker && (
                      <div className="rounded-xl border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Seeker</p>
                        <p className="mt-0.5 text-sm font-medium">
                          {payment.seeker.name}
                        </p>
                      </div>
                    )}
                    {payment.provider && (
                      <div className="rounded-xl border bg-background p-3">
                        <p className="text-xs text-muted-foreground">
                          Provider
                        </p>
                        <p className="mt-0.5 text-sm font-medium">
                          {payment.provider.businessName ||
                            payment.provider.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {payment.escrow_release_at && (
                    <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs">
                      <p className="font-medium text-amber-900">
                        Escrow release: {" "}
                        {new Date(payment.escrow_release_at).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {/* Refund/Penalty Controls */}
                  <div className="flex gap-2 mt-2">
                    {(payment.payment_status === "held" || payment.payment_status === "released") && (
                      <>
                        <button
                          className="btn btn-error btn-sm"
                          onClick={() => openActionModal(payment._id, "refund")}
                        >
                          Refund
                        </button>
                        <button
                          className="btn btn-warning btn-sm"
                          onClick={() => openActionModal(payment._id, "penalty")}
                        >
                          Penalty
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <div className="mt-1 flex items-baseline justify-end gap-1">
                    <IndianRupee className="h-5 w-5 text-emerald-600" />
                    <p className="text-2xl font-bold text-emerald-600">
                      {(
                        payment.total_price + payment.delivery_charge
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Refund/Penalty Modal */}
        {action.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
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
                    onChange={e => setAmount(Number(e.target.value))}
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
                    onChange={e => setReason(e.target.value)}
                    className="input input-bordered w-full"
                    required
                  />
                </div>
                {actionError && <div className="text-error">{actionError}</div>}
                {actionSuccess && <div className="text-success">{actionSuccess}</div>}
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
                    {actionLoading ? "Processing..." : action.type === "refund" ? "Refund" : "Apply Penalty"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      case "held":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
            <Clock className="h-3 w-3" />
            In Escrow
          </span>
        );
      case "released":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Released
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            Refunded
          </span>
        );
    }
  }

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

        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-emerald-600">
              <DollarSign className="h-5 w-5" />
              <p className="text-sm font-semibold">Total Revenue</p>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <IndianRupee className="h-6 w-6" />
              <p className="text-3xl font-bold">
                {totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-amber-600">
              <Clock className="h-5 w-5" />
              <p className="text-sm font-semibold">In Escrow</p>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <IndianRupee className="h-6 w-6" />
              <p className="text-3xl font-bold">
                {escrowAmount.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-blue-600">
              <TrendingUp className="h-5 w-5" />
              <p className="text-sm font-semibold">Total Transactions</p>
            </div>
            <p className="mt-2 text-3xl font-bold">{payments.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter("held")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "held"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            In Escrow (
            {payments.filter((p) => p.payment_status === "held").length})
          </button>
          <button
            onClick={() => setFilter("released")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "released"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Released (
            {payments.filter((p) => p.payment_status === "released").length})
          </button>
          <button
            onClick={() => setFilter("unpaid")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "unpaid"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Unpaid (
            {payments.filter((p) => p.payment_status === "unpaid").length})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "all"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            All ({payments.length})
          </button>
        </div>

        {/* Payments List */}
        <div className="space-y-4">
          {filteredPayments.map((payment) => (
            <div
              key={payment._id}
              className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          Order #{payment.order_id.slice(-8)}
                        </h3>
                        {getStatusBadge(payment.payment_status)}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {payment.seeker && (
                      <div className="rounded-xl border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Seeker</p>
                        <p className="mt-0.5 text-sm font-medium">
                          {payment.seeker.name}
                        </p>
                      </div>
                    )}
                    {payment.provider && (
                      <div className="rounded-xl border bg-background p-3">
                        <p className="text-xs text-muted-foreground">
                          Provider
                        </p>
                        <p className="mt-0.5 text-sm font-medium">
                          {payment.provider.businessName ||
                            payment.provider.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {payment.escrow_release_at && (
                    <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs">
                      <p className="font-medium text-amber-900">
                        Escrow release:{" "}
                        {new Date(payment.escrow_release_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <div className="mt-1 flex items-baseline justify-end gap-1">
                    <IndianRupee className="h-5 w-5 text-emerald-600" />
                    <p className="text-2xl font-bold text-emerald-600">
                      {(
                        payment.total_price + payment.delivery_charge
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
