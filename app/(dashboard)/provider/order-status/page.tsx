"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";

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
    | "processing"
    | "washing"
    | "ironing"
    | "ready"
    | "out_for_delivery"
    | "delivered";
  deadline?: Date;
};

export default function OrderStatusPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<OrderWithProcessStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "active" | "completed" | "cancelled"
  >("active");
  const [updating, setUpdating] = useState<string | null>(null);

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdating(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        // Optimistic update
        setOrders((prev) =>
          prev.map((o) =>
            o._id === orderId
              ? {
                  ...o,
                  process_status:
                    newStatus as OrderWithProcessStatus["process_status"],
                }
              : o
          )
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  }

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch("/api/orders/provider");
        if (response.ok) {
          const data = await response.json();
          setOrders(data);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchOrders();
    }
  }, [session]);

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

  const filteredOrders = orders.filter((order) => {
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
    <main className="min-h-[calc(100vh-4rem)] bg-background">
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
                  !o.otp_confirmed_at
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
                (o) => o.payment_status === "released" || !!o.otp_confirmed_at
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
                                <select
                                  className="text-xs border rounded px-1 py-0.5"
                                  value={order.process_status || "processing"}
                                  onChange={(e) =>
                                    updateStatus(order._id, e.target.value)
                                  }
                                  disabled={updating === order._id}
                                >
                                  <option value="processing">Processing</option>
                                  <option value="washing">Washing</option>
                                  <option value="ironing">Ironing</option>
                                  <option value="ready">Ready</option>
                                  <option value="out_for_delivery">
                                    Out for Delivery
                                  </option>
                                  <option value="delivered">Delivered</option>
                                </select>
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
                            }
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
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Total Amount
                      </p>
                      <p className="text-2xl font-bold text-emerald-600">
                        ₹{order.total_price + order.delivery_charge}
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
