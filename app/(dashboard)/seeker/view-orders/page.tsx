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
  Phone,
  Mail,
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
  provider?: {
    _id: string;
    name: string;
    businessName?: string;
    phone?: string;
    email?: string;
  } | null;
};

export default function ViewOrdersPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid" | "cancelled">(
    "all"
  );

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch("/api/orders/seeker");
        if (response.ok) {
          const data = await response.json();
          setOrders(data);
        } else {
          console.error("Failed to fetch orders");
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/50 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-400">
          <XCircle className="h-3 w-3" />
          Cancelled
        </span>
      );
    }

    if (order.otp_confirmed_at) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Delivered
        </span>
      );
    }

    switch (order.payment_status) {
      case "paid":
      case "held":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/50 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
            <Clock className="h-3 w-3" />
            In Progress
          </span>
        );
      case "released":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case "unpaid":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <Clock className="h-3 w-3" />
            Pending Payment
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-400">
            <XCircle className="h-3 w-3" />
            Refunded
          </span>
        );
      default:
        return null;
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "cancelled") return !!order.cancellation_status;
    if (filter === "paid")
      return (
        order.payment_status === "paid" ||
        order.payment_status === "held" ||
        order.payment_status === "released"
      );
    if (filter === "unpaid") return order.payment_status === "unpaid";
    return true;
  });

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">
            Loading your orders...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">My Orders</h1>
          <p className="text-sm text-muted-foreground">
            View and track all your laundry orders
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "all"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            All Orders ({orders.length})
          </button>
          <button
            onClick={() => setFilter("paid")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "paid"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Active (
            {
              orders.filter(
                (o) =>
                  !o.cancellation_status &&
                  (o.payment_status === "paid" ||
                    o.payment_status === "held" ||
                    o.payment_status === "released")
              ).length
            }
            )
          </button>
          <button
            onClick={() => setFilter("unpaid")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "unpaid"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Unpaid ({orders.filter((o) => o.payment_status === "unpaid").length}
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
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border bg-card/80 p-12 text-center shadow-sm backdrop-blur">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No orders found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {filter === "all"
                ? "You haven't placed any orders yet"
                : `No ${filter} orders to display`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order._id}
                className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur transition hover:shadow-md"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  {/* Order Info */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            Order #{order._id.slice(-8)}
                          </h3>
                          {getStatusBadge(order)}
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

                    {/* Provider Info */}
                    {order.provider && (
                      <div className="rounded-xl border bg-background p-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {order.provider.businessName || order.provider.name}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {order.provider.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {order.provider.phone}
                            </div>
                          )}
                          {order.provider.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {order.provider.email}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Order Items */}
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
                        {order.delivery_charge > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Delivery Charge
                            </span>
                            <span className="font-medium">
                              ₹{order.delivery_charge}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Total & Payment Status */}
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
