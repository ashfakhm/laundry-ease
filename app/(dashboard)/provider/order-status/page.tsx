"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  IndianRupee,
  Calendar,
  User,
  TruckIcon,
  ShieldCheck,
  Send,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { reportError } from "@/lib/client-error";
import { unwrapApiArray, unwrapApiData } from "@/lib/client-api";
import OrderChat from "@/components/order-chat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Order = {
  _id: string;
  booking_id: string;
  items: OrderItem[];
  total_price: number;
  delivery_charge: number;
  payment_status: "unpaid" | "paid" | "held" | "released" | "refunded";
  payment_made_at?: string;
  escrow_started_at?: string;
  escrow_release_at?: string;
  otp_confirmed_at?: string;
  cancellation_status?: "cancelled_by_seeker" | "cancelled_by_provider";
  createdAt: string;
  seeker?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
};

type OrderWithProcessStatus = Order & {
  process_status?:
    | "invoiced"
    | "processing"
    | "washing"
    | "ironing"
    | "ready"
    | "out_for_delivery"
    | "delivered";
  allowedNextStates?: Array<
    | "processing"
    | "washing"
    | "ironing"
    | "ready"
    | "out_for_delivery"
    | "delivered"
  >;
  deadline?: string | Date;
};

const STATUS_LABELS: Record<
  NonNullable<OrderWithProcessStatus["process_status"]>,
  string
> = {
  invoiced: "Invoiced",
  processing: "Processing",
  washing: "Washing",
  ironing: "Ironing",
  ready: "Ready",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

function deriveAllowedNextStates(
  current: NonNullable<OrderWithProcessStatus["process_status"]>,
): Array<
  | "processing"
  | "washing"
  | "ironing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
> {
  // Matches server state machine (authoritative source); used as a safe fallback
  // before we get allowedNextStates from API.
  const transitions: Record<string, string[]> = {
    invoiced: ["processing"],
    processing: ["washing", "ready"],
    washing: ["ironing", "ready"],
    ironing: ["ready"],
    ready: ["out_for_delivery"],
    out_for_delivery: ["delivered"],
    delivered: [],
  };

  return (transitions[current] ?? []) as unknown as Array<
    | "processing"
    | "washing"
    | "ironing"
    | "ready"
    | "out_for_delivery"
    | "delivered"
  >;
}

function formatDateTime(value?: string | Date): string {
  if (!value) return "N/A";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function toEpochOrInfinity(value?: string | Date): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

export default function OrderStatusPage() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<OrderWithProcessStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "active" | "completed" | "cancelled"
  >("active");
  const [updating, setUpdating] = useState<string | null>(null);
  const [openChatId, setOpenChatId] = useState<string | null>(null);

  // OTP Modal State
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [selectedOrderForOtp, setSelectedOrderForOtp] = useState<string | null>(
    null,
  );
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldownMs, setResendCooldownMs] = useState(0);
  const [resendInfo, setResendInfo] = useState<string | null>(null);
  const toast = useToast();

  const resendCooldownSeconds = Math.ceil(resendCooldownMs / 1000);
  const resendDisabled = !!updating || resendCooldownMs > 0;

  async function updateStatus(
    orderId: string,
    newStatus: string,
    otp?: string,
  ) {
    if (newStatus === "delivered" && !otp) {
      // Open Modal
      setSelectedOrderForOtp(orderId);
      setOtpModalOpen(true);
      setOtpInput("");
      setOtpError(null);
      return;
    }

    setUpdating(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, otp }),
      });
      const payload = await res.json();

      if (res.ok) {
        const data = unwrapApiData<{
          allowedNextStates?: OrderWithProcessStatus["allowedNextStates"];
        }>(payload);
        // Update local order + allowedNextStates from server so UI stays in sync.
        setOrders((prev) =>
          prev.map((o) =>
            o._id === orderId
              ? {
                  ...o,
                  process_status:
                    newStatus as OrderWithProcessStatus["process_status"],
                  allowedNextStates: Array.isArray(data?.allowedNextStates)
                    ? data.allowedNextStates
                    : o.allowedNextStates,
                  otp_confirmed_at:
                    newStatus === "delivered"
                      ? new Date().toISOString()
                      : o.otp_confirmed_at,
                }
              : o,
          ),
        );
        // Close modal if open
        if (otpModalOpen) setOtpModalOpen(false);
      } else {
        const data = payload as {
          message?: string;
          allowedNextStates?: OrderWithProcessStatus["allowedNextStates"];
          currentStatus?: string;
        };
        // Keep UI consistent with backend: if backend tells us the allowed states,
        // store them so dropdown becomes correct immediately.
        if (
          res.status === 422 &&
          Array.isArray(data?.allowedNextStates) &&
          typeof data?.currentStatus === "string"
        ) {
          setOrders((prev) =>
            prev.map((o) =>
              o._id === orderId
                ? {
                    ...o,
                    process_status:
                      data.currentStatus as OrderWithProcessStatus["process_status"],
                    allowedNextStates: data.allowedNextStates,
                  }
                : o,
            ),
          );
        }

        if (otp) setOtpError(data.message || "Failed to verify OTP");
        else toast.error(data.message || "Failed to update status");
      }
    } catch (e) {
      reportError("OrderStatusUpdateError", e);
      if (otp) setOtpError("Network error");
    } finally {
      setUpdating(null);
    }
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderForOtp) return;
    if (otpInput.length !== 6) {
      setOtpError("Please enter a 6-digit OTP");
      return;
    }

    setUpdating(selectedOrderForOtp);
    setOtpError(null);

    fetch(`/api/orders/${selectedOrderForOtp}/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp: otpInput }),
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        const data = unwrapApiData<{ message?: string }>(payload);
        if (!res.ok) {
          setOtpError(data?.message || "Failed to verify OTP");
          return;
        }

        // Mark as delivered in UI immediately (escrow start happens server-side)
        setOrders((prev) =>
          prev.map((o) =>
            o._id === selectedOrderForOtp
              ? {
                  ...o,
                  process_status: "delivered",
                  otp_confirmed_at: new Date().toISOString(),
                  allowedNextStates: [],
                }
              : o,
          ),
        );

        toast.success(data?.message || "Delivery confirmed");
        setOtpModalOpen(false);
      })
      .catch(() => {
        setOtpError("Network error");
      })
      .finally(() => {
        setUpdating(null);
      });
  }

  async function handleResendOtp() {
    if (!selectedOrderForOtp) return;

    setUpdating(selectedOrderForOtp);
    setOtpError(null);
    setResendInfo(null);

    try {
      const res = await fetch(`/api/orders/${selectedOrderForOtp}/otp/resend`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      const data = unwrapApiData<{
        message?: string;
        retryAfterSeconds?: number;
      }>(payload);

      if (!res.ok) {
        // Respect backend rate limiting.
        const retryAfterSeconds =
          typeof data?.retryAfterSeconds === "number"
            ? data.retryAfterSeconds
            : 0;
        if (retryAfterSeconds > 0) {
          setResendCooldownMs(retryAfterSeconds * 1000);
          setResendInfo(
            `Please wait ${retryAfterSeconds}s before resending the OTP.`,
          );
        }

        toast.error(data?.message || "Failed to resend OTP. Try again.");
        return;
      }

      toast.success(data?.message || "OTP resent to customer");
      // UI cooldown mirrors server MIN_RESEND_INTERVAL_MS.
      setResendCooldownMs(60_000);
      setResendInfo("OTP resent. You can resend again in 60s.");
    } catch {
      toast.error("Network error while resending OTP");
    } finally {
      setUpdating(null);
    }
  }

  // Countdown for resend cooldown.
  useEffect(() => {
    if (resendCooldownMs <= 0) return;
    const t = setInterval(() => {
      setResendCooldownMs((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldownMs]);

  // Clear modal state when closing.
  useEffect(() => {
    if (otpModalOpen) return;
    setSelectedOrderForOtp(null);
    setOtpInput("");
    setOtpError(null);
    setResendCooldownMs(0);
    setResendInfo(null);
  }, [otpModalOpen]);

  // Auto-send OTP when modal opens so the seeker receives a fresh email
  // without the provider needing to click "Resend OTP" manually.
  useEffect(() => {
    if (!otpModalOpen || !selectedOrderForOtp) return;
    handleResendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpModalOpen, selectedOrderForOtp]);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch("/api/orders/provider", {
          cache: "no-store",
        });
        if (response.ok) {
          const payload = await response.json();
          const data = unwrapApiArray<OrderWithProcessStatus>(payload);
          setOrders(data);
        }
      } catch (error) {
        reportError("OrderFetchError", error);
      } finally {
        setLoading(false);
      }
    }

    if (status === "loading") return;
    if (!session) {
      setLoading(false);
      return;
    }

    let timerId: ReturnType<typeof setTimeout> | null = null;

    function scheduleNext(currentOrders: OrderWithProcessStatus[]) {
      if (timerId) clearTimeout(timerId);
      if (document.hidden) return;

      // Poll faster when there are orders actively being processed
      const hasActiveOrders = currentOrders.some(
        (o) =>
          !o.cancellation_status &&
          o.process_status !== "delivered" &&
          o.payment_status !== "released" &&
          o.payment_status !== "refunded",
      );
      const interval = hasActiveOrders ? 8_000 : 30_000;

      timerId = setTimeout(async () => {
        await fetchOrders();
        scheduleNext(orders);
      }, interval);
    }

    fetchOrders().then(() => scheduleNext(orders));

    function handleVisibilityChange() {
      if (!document.hidden) {
        if (timerId) clearTimeout(timerId);
        fetchOrders().then(() => scheduleNext(orders));
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  function getStatusBadge(order: Order) {
    if (order.cancellation_status) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
          <XCircle className="h-3 w-3" />
          Cancelled
        </span>
      );
    }

    if (order.otp_confirmed_at) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          Delivered
        </span>
      );
    }

    if (order.payment_status === "released") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </span>
      );
    }

    if (order.payment_status === "held" || order.payment_status === "paid") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
          <TruckIcon className="h-3 w-3" />
          In Progress
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
        <Clock className="h-3 w-3" />
        Pending Payment
      </span>
    );
  }

  const filteredOrders = useMemo(() => {
    const visibleOrders = orders.filter((order) => {
      if (filter === "all") return true;
      if (filter === "cancelled") return !!order.cancellation_status;
      if (filter === "completed")
        return order.payment_status === "released" || !!order.otp_confirmed_at;
      if (filter === "active")
        return (
          !order.cancellation_status &&
          order.payment_status !== "released" &&
          !order.otp_confirmed_at
        );
      return true;
    });

    return [...visibleOrders].sort((a, b) => {
      const deadlineDiff =
        toEpochOrInfinity(a.deadline) - toEpochOrInfinity(b.deadline);
      if (deadlineDiff !== 0) return deadlineDiff;

      const createdDiff =
        toEpochOrInfinity(a.createdAt) - toEpochOrInfinity(b.createdAt);
      if (createdDiff !== 0) return createdDiff;

      return a._id.localeCompare(b._id);
    });
  }, [orders, filter]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">
            Loading orders...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background relative">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Order Status</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage your active orders
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter("active")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "active"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Active (
            {
              orders.filter(
                (o) =>
                  !o.cancellation_status &&
                  o.payment_status !== "released" &&
                  !o.otp_confirmed_at,
              ).length
            }
            )
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "completed"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Completed (
            {
              orders.filter(
                (o) => o.payment_status === "released" || !!o.otp_confirmed_at,
              ).length
            }
            )
          </button>
          <button
            onClick={() => setFilter("cancelled")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "cancelled"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Cancelled ({orders.filter((o) => !!o.cancellation_status).length})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "all"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            All ({orders.length})
          </button>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border bg-card/80 p-12 text-center shadow-sm backdrop-blur">
            <Package className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No orders found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {filter === "all"
                ? "No orders yet"
                : `No ${filter} orders to display`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order._id}
                className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            Order #{order._id.slice(-8)}
                          </h3>
                          {/* Status Dropdown if Active */}
                          <div className="flex items-center gap-2">
                            {getStatusBadge(order)}
                            {!order.otp_confirmed_at &&
                              order.payment_status !== "released" &&
                              !order.cancellation_status && (
                                <Select
                                  value={order.process_status || "invoiced"}
                                  onValueChange={(value) =>
                                    updateStatus(order._id, value)
                                  }
                                  disabled={updating === order._id}
                                >
                                  <SelectTrigger className="h-8 w-40 text-xs">
                                    <SelectValue placeholder="Update status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(() => {
                                      const current = (order.process_status ||
                                        "invoiced") as NonNullable<
                                        OrderWithProcessStatus["process_status"]
                                      >;
                                      const allowed =
                                        order.allowedNextStates ??
                                        deriveAllowedNextStates(current);

                                      const options = [
                                        current,
                                        ...allowed,
                                      ] as Array<
                                        NonNullable<
                                          OrderWithProcessStatus["process_status"]
                                        >
                                      >;

                                      const unique = Array.from(
                                        new Set(options),
                                      );

                                      return unique.map((s) => (
                                        <SelectItem key={s} value={s}>
                                          {STATUS_LABELS[s]}
                                        </SelectItem>
                                      ));
                                    })()}
                                  </SelectContent>
                                </Select>
                              )}
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(order.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}
                        </div>
                      </div>
                    </div>

                    {order.seeker && (
                      <div className="rounded-xl border bg-background p-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {order.seeker.name}
                          </span>
                        </div>
                        {order.seeker.phone && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {order.seeker.phone}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="rounded-xl border bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Items
                      </p>
                      <div className="mt-2 space-y-1">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>
                              {item.name} × {item.quantity}
                            </span>
                            <span className="font-medium">
                              ₹{item.line_total}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {(order.deadline || order.otp_confirmed_at) && (
                      <div className="rounded-xl border bg-background p-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          Service Timeline
                        </p>
                        {order.deadline && (
                          <p className="mt-1 text-sm">
                            Deadline: {formatDateTime(order.deadline)}
                          </p>
                        )}
                        {order.otp_confirmed_at && (
                          <p className="mt-1 text-sm font-bold text-emerald-600">
                            Delivered: {formatDateTime(order.otp_confirmed_at)}
                          </p>
                        )}
                        {order.deadline && order.otp_confirmed_at && (
                          <p
                            className={`mt-1 text-xs font-medium ${
                              new Date(order.otp_confirmed_at).getTime() <=
                              new Date(order.deadline).getTime()
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }`}
                          >
                            {new Date(order.otp_confirmed_at).getTime() <=
                            new Date(order.deadline).getTime()
                              ? "Delivered on time"
                              : "Delivered after deadline"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Total Amount
                      </p>
                      <p className="text-2xl font-bold text-emerald-600">
                        ₹{order.total_price}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-background px-4 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <IndianRupee className="h-4 w-4" />
                        <span className="font-medium capitalize">
                          {order.payment_status}
                        </span>
                      </div>
                    </div>

                    {/* Chat toggle button */}
                    <button
                      onClick={() =>
                        setOpenChatId((prev) =>
                          prev === order._id ? null : order._id,
                        )
                      }
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                        openChatId === order._id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {openChatId === order._id ? "Close Chat" : "Chat"}
                    </button>
                  </div>
                </div>

                {/* Expandable Chat Panel */}
                {openChatId === order._id && (
                  <div className="mt-4 border-t pt-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="h-96 rounded-2xl border border-border/50 overflow-hidden bg-card">
                      <OrderChat orderId={order._id} selfRole="provider" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OTP Modal */}
      {otpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Verify Delivery
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              The delivery OTP is sent to the customer (Seeker) via email. Enter
              the 6-digit code to confirm delivery.
            </p>

            <button
              type="button"
              disabled={resendDisabled}
              onClick={handleResendOtp}
              className="mb-2 text-xs text-primary font-bold hover:underline flex items-center justify-center gap-1 mx-auto disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
              {resendCooldownMs > 0
                ? `Resend available in ${resendCooldownSeconds}s`
                : "Resend OTP"}
            </button>

            {resendInfo && (
              <p className="mb-4 text-[11px] text-muted-foreground text-center">
                {resendInfo}
              </p>
            )}

            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                className="input input-bordered w-full text-center text-2xl tracking-widest font-mono"
                value={otpInput}
                onChange={(e) =>
                  setOtpInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                }
                autoFocus
                disabled={!!updating}
              />

              {otpError && (
                <p className="text-xs text-error font-bold text-center">
                  {otpError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setOtpModalOpen(false);
                    setOtpError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!!updating || otpInput.length !== 6}
                >
                  Confirm Delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
