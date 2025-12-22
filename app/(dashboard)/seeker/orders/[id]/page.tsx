import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import Image from "next/image";
import { 
    Clock, 
    CheckCircle2, 
    Truck, 
    Package, 
    MapPin, 
    Phone, 
    MessageSquare,
    IndianRupee,
    AlertCircle
} from "lucide-react";
import { PaymentButton } from "@/components/orders/payment-button";
import Link from "next/link";
import dynamic from "next/dynamic";

const BookingChat = dynamic(() => import("@/components/chat-interface"), { ssr: false });

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const { id } = await params;
  const { db } = await getDb();
  
  // Aggregate to get Provider details
  const orders = await db.collection("orders").aggregate([
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
  ]).toArray();

  const order = orders[0];

  if (!order) {
    redirect("/dashboard/seeker");
  }

  if (order.seeker_id.toString() !== session.user.id) {
    redirect("/dashboard/seeker");
  }

  // Derived Values
  const totalAmount = (order.total_price || 0) + (order.delivery_charge || 0);

  // Status Helper
  const steps = [
      { id: "paid", label: "Paid", icon: IndianRupee },
      { id: "processing", label: "Processing", icon: Package },
      { id: "ready", label: "Ready", icon: CheckCircle2 },
      { id: "out_for_delivery", label: "Out for Delivery", icon: Truck },
      { id: "delivered", label: "Delivered", icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === order.process_status);
  const isCancelled = !!order.cancellation_status;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8 pb-20">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div>
               <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
                   Order #{id.slice(-6)}
                   {isCancelled && <span className="badge badge-error">Cancelled</span>}
               </h1>
               <p className="text-muted-foreground text-sm">
                   Placed on {new Date(order.createdAt).toLocaleDateString()}
               </p>
           </div>
           
           {/* Actions */}
           <div className="flex gap-3">
               {/* Chat Button */}
               {/* Note: We will render chat below, but maybe a quick link or indicator here? */}
           </div>
       </div>

       {/* Status Stepper (Hidden if Cancelled) */}
       {!isCancelled && (
           <div className="w-full bg-card/50 border border-border rounded-2xl p-6 overflow-x-auto">
               <ul className="steps steps-horizontal w-full min-w-[500px]">
                   <li className={`step ${order.payment_status === "unpaid" ? "step-primary" : "step-primary"}`}>Created</li>
                   {steps.map((step, idx) => {
                       // Simple logic: if payment_status is 'paid', assume step 0 is done.
                       // Use process_status for others.
                       // This is rough visualization logic.
                       let isActive = false;
                       if(step.id === "paid" && order.payment_status === "paid") isActive = true;
                       // If process status index >= this step index, it's active?
                       // Need refined logic based on enum order.
                       // For MVP, simplistic check:
                       const processOrder = ["invoiced", "processing", "ready", "out_for_delivery", "delivered"];
                       const orderIdx = processOrder.indexOf(order.process_status || "invoiced");
                       const stepIdx = processOrder.indexOf(step.id);
                       
                       if(order.payment_status === "paid" && step.id === "paid") isActive = true;
                       else if(order.payment_status === "paid" && stepIdx <= orderIdx && stepIdx > -1) isActive = true;
                       
                       return (
                           <li key={step.id} className={`step ${isActive ? "step-primary" : ""}`}>
                               <div className="flex flex-col items-center gap-1">
                                    <span className="text-xs font-bold">{step.label}</span>
                               </div>
                           </li>
                       )
                   })}
               </ul>
           </div>
       )}

       <div className="grid md:grid-cols-3 gap-6">
           {/* Left Column: Details */}
           <div className="md:col-span-2 space-y-6">
                {/* Items List */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-4 bg-muted/30 border-b border-border font-bold">
                        Items & Charges
                    </div>
                    <div className="divide-y divide-border/50">
                        {order.items.map((item: any, i: number) => (
                            <div key={i} className="p-4 flex gap-4 items-center hover:bg-muted/10 transition-colors">
                                <div className="h-16 w-16 bg-muted rounded-xl relative overflow-hidden shrink-0 border border-border">
                                    {item.photoUrl ? (
                                        <Image src={item.photoUrl} alt={item.name} fill className="object-cover" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No img</div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.quantity} x ₹{item.unit_price}</p>
                                </div>
                                <div className="font-mono font-bold">
                                    ₹{item.line_total}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 bg-muted/10 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>₹{order.subtotal}</span>
                        </div>
                        {order.delivery_charge > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Delivery</span>
                                <span>₹{order.delivery_charge}</span>
                            </div>
                        )}
                        {order.discount > 0 && (
                            <div className="flex justify-between text-green-500">
                                <span>Discount</span>
                                <span>-₹{order.discount}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-2 border-t border-border/50">
                            <span>Total</span>
                            <span className="text-primary">₹{totalAmount}</span>
                        </div>
                    </div>
                </div>

                {/* Notifications / Alerts */}
                {order.payment_status === "unpaid" && !isCancelled && (
                    <div className="alert alert-warning shadow-lg rounded-xl">
                        <AlertCircle className="stroke-current shrink-0 h-6 w-6" />
                        <div>
                            <h3 className="font-bold">Payment Pending</h3>
                            <div className="text-xs">Please pay to start processing your laundry.</div>
                        </div>
                        <div className="flex-none">
                            <PaymentButton orderId={id} amount={totalAmount} />
                        </div>
                    </div>
                )}
                
                {/* Chat */}
                <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="font-bold mb-4">Chat with Provider</h3>
                    <div className="h-[400px]">
                        <BookingChat bookingId={order.booking_id.toString()} selfRole="seeker" />
                    </div>
                </div>
           </div>

           {/* Right Column: Info & Actions */}
           <div className="space-y-6">
               {/* Provider Card */}
               <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                   <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Service Provider</h3>
                   <div className="flex items-center gap-3">
                       <div className="avatar placeholder">
                           <div className="bg-neutral text-neutral-content rounded-full w-12">
                               <span className="text-lg">{order.provider.businessName?.[0] || "P"}</span>
                           </div>
                       </div>
                       <div>
                           <p className="font-bold">{order.provider.businessName || order.provider.name}</p>
                           <p className="text-xs text-muted-foreground flex items-center gap-1">
                               <MapPin className="w-3 h-3" /> {order.provider.location || "Nearby"}
                           </p>
                       </div>
                   </div>
                   <div className="flex gap-2 text-xs">
                        {order.provider.phone && (
                            <a href={`tel:${order.provider.phone}`} className="btn btn-xs btn-outline rounded-lg gap-1">
                                <Phone className="w-3 h-3" /> Call
                            </a>
                        )}
                   </div>
               </div>

               {/* Timeline / Dates */}
               <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                   <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Timeline</h3>
                   <div className="space-y-3 text-sm">
                       <div className="flex justify-between">
                           <span className="text-muted-foreground">Order Created</span>
                           <span className="font-mono">{new Date(order.createdAt).toLocaleDateString()}</span>
                       </div>
                       {order.deadline && (
                            <div className="flex justify-between">
                                <span className="text-red-500 font-medium">Deadline</span>
                                <span className="font-mono font-bold">{new Date(order.deadline).toLocaleDateString()}</span>
                            </div>
                       )}
                   </div>
               </div>

               {/* Actions */}
               {(order.process_status === "out_for_delivery" || order.process_status === "delivered") && !order.otp_confirmed_at && (
                   <Link 
                     href={`/seeker/orders/${id}/confirm-delivery`}
                     className="btn btn-primary w-full rounded-xl shadow-lg shadow-primary/20 h-14"
                   >
                       <CheckCircle2 className="w-5 h-5 mr-2" /> 
                       Confirm Delivery
                   </Link>
               )}
           </div>
       </div>
    </div>
  );
}
