import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import Image from "next/image";
import {
  CheckCircle2,
  Truck,
  Package,
  MapPin,
  Phone,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  Receipt,
  Store,
} from "lucide-react";
import { PaymentButton } from "@/components/orders/payment-button";
import Link from "next/link";
import BookingChat from "@/components/chat-interface";
import { PostDeliveryActions } from "@/components/orders/post-delivery-actions";
import { LiveStatusRefresh } from "@/components/orders/live-status-refresh";
import { cn } from "@/lib/utils";
import { requireSeeker } from "@/lib/api/auth";

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  type OrderItem = {
    name?: string;
    quantity?: number;
    unit_price?: number;
    line_total?: number;
    photoUrl?: string;
  };

  let seekerId: string;
  try {
    const { user } = await requireSeeker();
    if (!ObjectId.isValid(user.id)) redirect("/signin");
    seekerId = user.id;
  } catch {
    redirect("/signin");
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    redirect("/dashboard/seeker");
  }
  const { db } = await getDb();

  // Aggregate to get Provider details
  const orders = await db
    .collection("orders")
    .aggregate([
      { $match: { _id: new ObjectId(id) } },
      {
        $lookup: {
          from: "providers",
          localField: "provider_id",
          foreignField: "_id",
          as: "provider",
        },
      },
      { $unwind: "$provider" },
    ])
    .toArray();

  const order = orders[0];

  if (!order) {
    redirect("/dashboard/seeker");
  }

  // Check reviewed
  const existingReview = await db
    .collection("reviews")
    .findOne({ order_id: new ObjectId(id) });
  const hasReviewed = !!existingReview;

  if (order.seeker_id.toString() !== seekerId) {
    redirect("/dashboard/seeker");
  }

  // Derived Values
  const totalAmount = (order.total_price || 0) + (order.delivery_charge || 0);

  // Status Logic
  const isCancelled = !!order.cancellation_status;
  const processStatus = order.process_status || "invoiced";
  // Any post-payment escrow state should still be treated as “paid” in the UI.
  const isPaid = ["paid", "held", "released", "refunded"].includes(
    order.payment_status
  );
  const isDelivered = !!order.otp_confirmed_at || processStatus === "delivered";
  const isTrackingActive = !isCancelled && !isDelivered;

  // Tracker Logic
  const trackerSteps = [
    { id: "placed", label: "Order Placed", desc: "Order confirmed" },
    { id: "processing", label: "Processing", desc: "Cleaning in progress" },
    { id: "ready", label: "Ready", desc: "Prepared for delivery" },
    {
      id: "out_for_delivery",
      label: "Out for Delivery",
      desc: "Rider is on the way",
    },
    { id: "delivered", label: "Delivered", desc: "Successfully delivered" },
  ];

  let trackerActiveIndex = 0;
  if (["processing", "washing", "ironing"].includes(processStatus))
    trackerActiveIndex = 1;
  else if (processStatus === "ready") trackerActiveIndex = 2;
  else if (processStatus === "out_for_delivery") trackerActiveIndex = 3;
  else if (processStatus === "delivered" || isDelivered) trackerActiveIndex = 4;

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* Top Banner / Header */}
      <div className="border-b border-border sticky top-0 z-30 shadow-sm shadow-black/5 backdrop-blur-xl bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/seeker/view-orders"
                  className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors uppercase tracking-wider"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" /> Back to Orders
                </Link>
              </div>
              <h1 className="text-2xl font-heading font-black tracking-tight text-foreground flex items-center gap-2">
                Order #{order.booking_id?.toString().slice(-6).toUpperCase()}
                {isPaid && <ShieldCheck className="w-5 h-5 text-emerald-500" />}
              </h1>
              <p className="text-sm text-muted-foreground font-medium">
                Placed on{" "}
                {new Date(order.createdAt).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm",
                  isPaid
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                )}
              >
                {isPaid ? "Paid" : "Payment Pending"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* LEFT COLUMN: Tracker & Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Status Tracker Card */}
            {!isCancelled && (
              <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-xl shadow-black/5 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-primary to-purple-600 opacity-20" />
                <h2 className="text-lg font-bold font-heading mb-8 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" /> Tracking
                </h2>
                <LiveStatusRefresh enabled={isTrackingActive} />

                <div className="relative">
                  {/* Desktop Horizontal Line */}
                  <div className="hidden md:block absolute top-5 left-0 w-full h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-1000 ease-out"
                      style={{
                        width: `${
                          (trackerActiveIndex / (trackerSteps.length - 1)) * 100
                        }%`,
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-0 relative">
                    {trackerSteps.map((step, idx) => {
                      const isCompleted = idx <= trackerActiveIndex;
                      const isCurrent = idx === trackerActiveIndex;

                      return (
                        <div
                          key={step.id}
                          className="flex md:flex-col items-center md:items-center gap-4 md:gap-3 relative group"
                        >
                          {/* Mobile Vertical Line */}
                          {idx !== trackerSteps.length - 1 && (
                            <div
                              className={cn(
                                "md:hidden absolute left-4.25 top-10 -bottom-6 w-0.5 z-0",
                                isCompleted ? "bg-primary" : "bg-muted"
                              )}
                            />
                          )}

                          <div
                            className={cn(
                              "w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-bold border-4 transition-all duration-500 relative z-10",
                              isCompleted
                                ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110"
                                : "bg-card border-muted text-muted-foreground"
                            )}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <div className="flex-1 md:text-center">
                            <p
                              className={cn(
                                "text-sm font-bold transition-colors",
                                isCurrent
                                  ? "text-primary"
                                  : isCompleted
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              )}
                            >
                              {step.label}
                            </p>
                            <p className="text-[10px] md:text-xs text-muted-foreground font-medium hidden md:block">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Order Items Card */}
            <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border/50 flex items-center justify-between">
                <h2 className="text-lg font-bold font-heading flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" /> Order Items
                </h2>
                <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
                  {order.items.length} Items
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {order.items.map((item: OrderItem, i: number) => (
                  <div
                    key={i}
                    className="p-4 sm:p-5 flex items-center gap-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="h-16 w-16 bg-muted rounded-xl relative overflow-hidden shrink-0 border border-border/50 shadow-sm group">
                      {item.photoUrl ? (
                        <Image
                          src={item.photoUrl}
                          alt={item.name || "Order item image"}
                          width={64}
                          height={64}
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground/30">
                          <Package className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base text-foreground truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        Quantity: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-base">₹{item.line_total}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} x ₹{item.unit_price}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Post Delivery Actions (Reviews) */}
            <div className="bg-transparent">
              <PostDeliveryActions
                orderId={id}
                providerId={order.provider._id.toString()}
                seekerId={seekerId}
                deliveredAt={order.otp_confirmed_at}
                isDelivered={isDelivered}
                hasReviewed={hasReviewed}
              />
            </div>

            {/* 4. Chat Section */}
            {!isCancelled &&
              !order.otp_confirmed_at &&
              processStatus !== "delivered" && (
                <div className="space-y-4 pt-4">
                  <h2 className="font-bold text-lg flex items-center gap-2 pl-2">
                    <MessageSquare className="w-5 h-5 text-primary" /> Chat with{" "}
                    {order.provider.businessName || order.provider.name}
                  </h2>
                  <p className="text-sm text-muted-foreground pl-9 -mt-3 mb-2">
                    Directly message the provider for updates or special
                    instructions.
                  </p>
                  <div className="h-125 border border-border/50 rounded-3xl overflow-hidden shadow-xl shadow-black/5 bg-card">
                    <BookingChat
                      bookingId={order.booking_id.toString()}
                      selfRole="seeker"
                    />
                  </div>
                </div>
              )}
          </div>

          {/* RIGHT COLUMN: Summary & Actions (Sticky) */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
            {/* 1. Payment Summary Card */}
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-xl shadow-black/5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" /> Summary
                </h3>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono text-foreground font-medium">
                    ₹{order.subtotal}
                  </span>
                </div>
                {order.delivery_charge > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Fee</span>
                    <span className="font-mono text-foreground font-medium">
                      ₹{order.delivery_charge}
                    </span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="font-mono font-bold">
                      -₹{order.discount}
                    </span>
                  </div>
                )}

                <div className="pt-4 mt-2 border-t border-dashed border-border flex justify-between items-end">
                  <span className="font-bold text-foreground">
                    Total Amount
                  </span>
                  <span className="font-heading font-black text-2xl text-primary">
                    ₹{totalAmount}
                  </span>
                </div>
              </div>

              {order.payment_status === "unpaid" && !isCancelled ? (
                <div className="mt-6">
                  <PaymentButton orderId={id} amount={totalAmount} />
                  <p className="text-[10px] text-center text-muted-foreground mt-3 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Secure payment via
                    Razorpay
                  </p>
                </div>
              ) : (
                <div className="mt-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-2 text-emerald-700 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Payment Completed
                </div>
              )}
            </div>

            {/* 2. Provider Card */}
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
              <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <Store className="w-4 h-4" /> Service Provider
              </h3>

              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-border bg-muted shadow-lg shrink-0">
                  {order.provider.profilePicture ? (
                    <Image
                      src={order.provider.profilePicture}
                      alt={order.provider.businessName || order.provider.name}
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center text-lg font-bold text-white">
                      {order.provider.businessName?.[0] ||
                        order.provider.name?.[0] ||
                        "P"}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-bold text-base">
                    {order.provider.businessName || order.provider.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Verified Partner
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <a
                  href={`tel:${order.provider.phone}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Phone className="w-4 h-4 text-foreground" />
                  </div>
                  <span className="text-sm font-medium">
                    {order.provider.phone}
                  </span>
                </a>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                  <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm">
                    <MapPin className="w-4 h-4 text-foreground" />
                  </div>
                  <span className="text-sm font-medium line-clamp-1">
                    {order.provider.location || "Location unavailable"}
                  </span>
                </div>
              </div>

              <Link
                href={`/seeker/provider/${order.provider_id}`}
                className="block mt-4 text-center text-xs font-bold text-primary hover:underline"
              >
                View Provider Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
