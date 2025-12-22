"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { PaymentButton } from "@/components/orders/payment-button";
import Link from "next/link";
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
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
  const { data: session, status } = useSession();
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive border border-destructive/20">
          <XCircle className="h-3 w-3" />
          Cancelled
        </span>
      );
    }

    if (order.otp_confirmed_at) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-600 border border-green-500/20">
          <CheckCircle2 className="h-3 w-3" />
          Delivered
        </span>
      );
    }

    switch (order.payment_status) {
      case "paid":
      case "held":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600 border border-blue-500/20">
            <Clock className="h-3 w-3" />
            In Progress
          </span>
        );
      case "released":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-600 border border-green-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case "unpaid":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600 border border-amber-500/20">
            <Clock className="h-3 w-3" />
            Pending Payment
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground border border-border">
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
      <div className="flex min-h-screen items-center justify-center bg-background/50">
         <div className="text-center">
             <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
             <p className="text-muted-foreground font-medium">Loading orders...</p>
         </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background/50 p-6 space-y-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-6">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              My Orders
            </h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
               View invoices and track the status of your laundry orders.
            </p>
          </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          <FilterButton 
             active={filter === "all"} 
             onClick={() => setFilter("all")} 
             label="All Orders" 
             count={orders.length} 
          />
           <FilterButton 
             active={filter === "paid"} 
             onClick={() => setFilter("paid")} 
             label="Active" 
             count={orders.filter(o => !o.cancellation_status && (o.payment_status === "paid" || o.payment_status === "held" || o.payment_status === "released")).length} 
          />
           <FilterButton 
             active={filter === "unpaid"} 
             onClick={() => setFilter("unpaid")} 
             label="Unpaid" 
             count={orders.filter(o => o.payment_status === "unpaid").length} 
          />
           <FilterButton 
             active={filter === "cancelled"} 
             onClick={() => setFilter("cancelled")} 
             label="Cancelled" 
             count={orders.filter(o => !!o.cancellation_status).length} 
          />
        </div>
        </header>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted shadow-sm">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-heading font-bold">No orders found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {filter === "all"
                ? "You haven't placed any orders yet"
                : `No ${filter} orders to display`}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
             <AnimatePresence>
            {filteredOrders.map((order) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-lg hover:border-primary/20"
              >
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  {/* Order Info */}
                  <div className="flex-1 space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                           <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
                              #{order._id.slice(-4).toUpperCase()}
                           </div>
                           <div>
                              <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                                Order #{order._id.slice(-8)}
                                {getStatusBadge(order)}
                              </h3>
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                <Calendar className="h-3.5 w-3.5" />
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
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Provider Info */}
                        {order.provider && (
                          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                               <User className="w-3.5 h-3.5" /> Provider
                            </p>
                            <div className="space-y-1">
                               <p className="text-sm font-bold text-foreground">
                                {order.provider.businessName || order.provider.name}
                              </p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {order.provider.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {order.provider.phone}
                                  </div>
                                )}
                                {order.provider.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate max-w-[150px]">{order.provider.email}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Order Items */}
                        <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                             <Package className="w-3.5 h-3.5" /> Items
                          </p>
                          <div className="space-y-2">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-muted-foreground">
                                  {item.name} <span className="text-foreground font-medium">× {item.quantity}</span>
                                </span>
                                <span className="font-mono font-medium">
                                  ₹{item.line_total}
                                </span>
                              </div>
                            ))}
                            {order.delivery_charge > 0 && (
                              <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
                                <span className="text-muted-foreground text-xs font-medium">
                                  Delivery Charge
                                </span>
                                <span className="font-mono font-medium">
                                  ₹{order.delivery_charge}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                  </div>

                  {/* Total & Payment Status */}
                  <div className="flex flex-col items-end gap-3 min-w-[140px]">
                    <div className="text-right p-4 rounded-2xl bg-primary/5 border border-primary/10 w-full">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Total Amount
                      </p>
                      <p className="text-3xl font-heading font-bold text-primary mt-1">
                        ₹{order.total_price + order.delivery_charge}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-2 w-full">
                         <div className="flex items-center justify-center gap-2 text-sm w-full py-2 bg-muted/30 rounded-xl border border-border/50 text-foreground font-medium capitalize">
                            <IndianRupee className="h-4 w-4" />
                             {order.payment_status}
                          </div>
                          
                          {order.payment_status === "unpaid" && !order.cancellation_status && (
                              <PaymentButton 
                                orderId={order._id} 
                                amount={order.total_price + order.delivery_charge} 
                              />
                          )}
                           
                           <Link
                              href={`/seeker/orders/${order._id}`}
                              className="btn btn-ghost btn-sm w-full text-xs"
                           >
                              View Details
                           </Link>
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

function FilterButton({ active, onClick, label, count }: { active: boolean, onClick: () => void, label: string, count: number }) {
   return (
      <button
            onClick={onClick}
            className={cn(
               "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all",
               active 
                 ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                 : "bg-background border border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {label} 
            {count > 0 && (
               <span className={cn("ml-1 px-1.5 py-0.5 rounded-full text-[10px]", active ? "bg-white/20 text-white" : "bg-muted-foreground/20 text-muted-foreground")}>
                  {count}
               </span>
            )}
          </button>
   )
}
