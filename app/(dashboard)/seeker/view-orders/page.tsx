"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { PaymentButton } from "@/components/orders/payment-button";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  Calendar,
  Loader2,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { reportError } from "@/lib/client-error";

type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Order = {
  _id: string;
  booking_id?: string; // ObjectId string
  items: OrderItem[];
  total_price: number;
  delivery_charge: number;
  payment_status: "unpaid" | "paid" | "held" | "released" | "refunded";
  process_status?: string;
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
    profilePicture?: string;
    bannerImage?: string;
  } | null;
};

export default function ViewOrdersPage() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid" | "cancelled">(
    "all",
  );

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch("/api/orders/seeker", {
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          setOrders(data);
        } else {
          reportError("OrderFetchError", "Failed to fetch orders");
        }
      } catch (error) {
        reportError("OrderFetchError", error);
      } finally {
        setLoading(false);
      }
    }

    if (status === "loading") return;

    if (session) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [session, status]);

  function getStatusBadge(order: Order) {
    if (order.cancellation_status) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-destructive border border-destructive/20 shadow-sm">
          <XCircle className="h-3 w-3" />
          Cancelled
        </span>
      );
    }

    const status = order.process_status || "created";

    switch (status) {
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600 border border-emerald-500/20 shadow-sm">
            <CheckCircle2 className="h-3 w-3" />
            Delivered
          </span>
        );
      case "out_for_delivery":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-600 border border-purple-500/20 shadow-sm animate-pulse">
            <Truck className="h-3 w-3" />
            On the way
          </span>
        );
      case "ready":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 border border-indigo-500/20 shadow-sm">
            <Package className="h-3 w-3" />
            Ready for Pickup
          </span>
        );
      case "processing":
      case "washing":
      case "ironing":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-600 border border-blue-500/20 shadow-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </span>
        );
      default:
        if (order.payment_status === "paid")
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600 border border-emerald-500/20 shadow-sm">
              <CheckCircle2 className="h-3 w-3" />
              Placed
            </span>
          );
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-600 border border-amber-500/20 shadow-sm">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
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
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background/50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            Loading your orders...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-muted/30 p-6 space-y-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-8">
          <h1 className="font-heading text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" /> My Orders
          </h1>
          <p className="mt-2 text-muted-foreground font-medium">
            Track current orders and view past history.
          </p>

          {/* Filters */}
          <div className="mt-6 flex flex-wrap gap-2">
            <FilterButton
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="All Orders"
              count={orders.length}
            />
            <FilterButton
              active={filter === "paid"}
              onClick={() => setFilter("paid")}
              label="Active/Paid"
              count={
                orders.filter(
                  (o) =>
                    !o.cancellation_status &&
                    (o.payment_status === "paid" ||
                      o.payment_status === "held" ||
                      o.payment_status === "released"),
                ).length
              }
            />
            <FilterButton
              active={filter === "unpaid"}
              onClick={() => setFilter("unpaid")}
              label="Unpaid"
              count={orders.filter((o) => o.payment_status === "unpaid").length}
            />
            <FilterButton
              active={filter === "cancelled"}
              onClick={() => setFilter("cancelled")}
              label="Cancelled"
              count={orders.filter((o) => !!o.cancellation_status).length}
            />
          </div>
        </header>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl border border-dashed border-border bg-card/50 p-16 text-center"
          >
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted shadow-sm mb-6">
              <Package className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-heading font-bold text-foreground">
              No orders found
            </h3>
            <p className="mt-2 text-muted-foreground max-w-xs mx-auto">
              {filter === "all"
                ? "You haven't placed any orders yet. Start by finding a provider!"
                : `No ${filter} orders to display at the moment.`}
            </p>
            {filter === "all" && (
              <Link
                href="/seeker"
                className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
              >
                Find Providers <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </motion.div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence>
              {filteredOrders.map((order, i) => (
                <motion.div
                  key={order._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative rounded-3xl border border-border/60 bg-card p-0 shadow-sm transition-all hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 overflow-hidden"
                >
                  {/* Card Status Line */}
                  <div
                    className={cn(
                      "absolute top-0 left-0 w-1.5 h-full transition-colors",
                      order.payment_status === "paid"
                        ? "bg-emerald-500"
                        : order.cancellation_status
                          ? "bg-destructive"
                          : "bg-amber-500",
                    )}
                  />

                  <div className="p-6 md:p-8 pl-8 md:pl-10">
                    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                      {/* Left: Main Details */}
                      <div className="flex-1 space-y-6">
                        {/* Header: ID + Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-heading font-black text-2xl text-foreground tracking-tight">
                                #
                                {order.booking_id
                                  ? order.booking_id
                                      .toString()
                                      .slice(-6)
                                      .toUpperCase()
                                  : order._id.slice(-6).toUpperCase()}
                              </span>
                              {getStatusBadge(order)}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(order.createdAt).toLocaleDateString(
                                undefined,
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Middle: Provider & Items Grid */}
                        <div className="grid sm:grid-cols-2 gap-6">
                          {/* Provider Mini-Card */}
                          <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 flex items-start gap-4">
                            {/* Provider Profile Picture */}
                            <div className="relative h-10 w-10 rounded-full overflow-hidden border border-border/50 bg-background shadow-sm shrink-0">
                              {order.provider?.profilePicture ? (
                                <Image
                                  src={order.provider.profilePicture}
                                  alt={order.provider.name}
                                  fill
                                  sizes="40px"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full bg-background flex items-center justify-center text-lg font-bold text-primary">
                                  {order.provider?.businessName?.[0] ||
                                    order.provider?.name?.[0] ||
                                    "P"}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                                Provider
                              </p>
                              <p className="font-bold text-sm truncate">
                                {order.provider?.businessName ||
                                  order.provider?.name}
                              </p>
                              <Link
                                href={`/seeker/provider/${order.provider?._id}`}
                                className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1 mt-1"
                              >
                                View Profile{" "}
                                <ChevronRight className="w-2.5 h-2.5" />
                              </Link>
                            </div>
                          </div>

                          {/* Items Summary */}
                          <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 relative overflow-hidden">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5" /> Order Summary
                            </p>
                            <div className="space-y-1 text-sm font-medium">
                              {order.items.slice(0, 2).map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between items-center text-foreground/80"
                                >
                                  <span>
                                    {item.quantity}x {item.name}
                                  </span>
                                  <span className="text-muted-foreground">
                                    ₹{item.line_total}
                                  </span>
                                </div>
                              ))}
                              {order.items.length > 2 && (
                                <p className="text-xs text-muted-foreground pt-1 italic">
                                  + {order.items.length - 2} more items...
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions & Total - Sticky-ish behavior on Desktop */}
                      <div className="flex flex-col items-start lg:items-end gap-5 lg:min-w-[200px] border-t lg:border-t-0 lg:border-l border-border/50 pt-6 lg:pt-0 lg:pl-8">
                        <div className="w-full text-left lg:text-right">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Total Amount
                          </p>
                          <p className="text-3xl font-heading font-black text-foreground mt-1">
                            ₹
                            {Math.round(
                              order.total_price + order.delivery_charge,
                            )}
                          </p>
                          <p className="text-xs text-emerald-600 font-bold mt-1 flex lg:justify-end items-center gap-1">
                            {order.payment_status === "paid" ? (
                              <>
                                <ShieldCheck className="w-3 h-3" /> Paid via
                                Razorpay
                              </>
                            ) : order.payment_status === "unpaid" &&
                              !order.cancellation_status ? (
                              <span className="text-amber-600">
                                Payment Pending
                              </span>
                            ) : null}
                          </p>
                        </div>

                        <div className="w-full space-y-3">
                          {order.payment_status === "unpaid" &&
                            !order.cancellation_status && (
                              <PaymentButton
                                orderId={order._id}
                                amount={
                                  order.total_price + order.delivery_charge
                                }
                                className="w-full"
                              />
                            )}

                          <Link
                            href={`/seeker/orders/${order._id}`}
                            className={cn(
                              "flex items-center justify-center w-full rounded-xl py-2.5 text-sm font-bold transition-all border",
                              "border-border bg-background hover:bg-muted text-foreground hover:shadow-sm",
                            )}
                          >
                            View Order Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </main>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition-all shadow-sm border",
        active
          ? "bg-foreground text-background border-foreground shadow-md scale-105"
          : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            "ml-1 px-1.5 py-0.5 rounded-full text-[9px]",
            active
              ? "bg-background/20 text-background"
              : "bg-muted-foreground/10 text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
