import { getSeekerBookings } from "@/lib/data/bookings";
import { Metadata } from "next";
import { Receipt, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export const metadata: Metadata = {
  title: "My Invoices | LaundryEase",
  description: "View and pay your laundry invoices.",
};

export default async function SeekerInvoicesPage() {
  const result = await getSeekerBookings();

  if (!result.success || !result.data) {
    return (
      <main className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">Unable to load invoices</h2>
        <p className="text-muted-foreground mt-2">{result.error}</p>
      </main>
    );
  }

  // Filter bookings that have an invoice
  const bookingsWithInvoices = result.data.filter(
    (b) => b.invoice || b.status === "invoice_created" || b.status === "confirmed" 
    // "confirmed" means paid usually, or ready to process. 
    // Actually, "confirmed" status in this system means confirmed by provider, then invoices are created. 
    // Status flow: requested -> accepted -> confirmed -> invoice_created -> paid (order created).
    // So bookings with "invoice_created" are pending payment. 
    // Paid invoices convert to Orders usually, so they might not be in bookings collection anymore or status changes.
    // But let's check: if "invoice" field exists, we show it.
  ).sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

  const pendingInvoices = bookingsWithInvoices.filter(b => b.status === "invoice_created");
  const pastInvoices = bookingsWithInvoices.filter(b => b.status !== "invoice_created");

  return (
    <main className="min-h-screen bg-background/50 p-6 space-y-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
             <Receipt className="h-8 w-8 text-primary" />
             My Invoices
          </h1>
          <p className="mt-2 text-muted-foreground">
            Review and pay for your laundry services.
          </p>
        </header>

        {bookingsWithInvoices.length === 0 ? (
           <div className="text-center py-20 px-6 bg-card rounded-3xl border border-dashed border-border">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                 <Receipt className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-xl font-bold text-foreground">No Invoices Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto mt-2">
                 Invoices will appear here once your provider processes your laundry request.
              </p>
              <Link href="/seeker" className="btn btn-primary mt-6 rounded-xl">
                 Find Providers
              </Link>
           </div>
        ) : (
          <div className="space-y-10">
            {/* Pending Invoices Section */}
            {pendingInvoices.length > 0 && (
              <section>
                 <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-amber-600 dark:text-amber-500">
                    <Clock className="w-5 h-5" /> Pending Payment
                 </h2>
                 <div className="grid md:grid-cols-2 gap-4">
                    {pendingInvoices.map(booking => (
                        <InvoiceCard key={String(booking._id)} booking={booking} isPending={true} />
                    ))}
                 </div>
              </section>
            )}

            {/* Past/Paid Invoices Section (if any remain in bookings) */}
            {pastInvoices.length > 0 && (
               <section>
                 <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-5 h-5" /> History
                 </h2>
                 <div className="grid md:grid-cols-2 gap-4">
                    {pastInvoices.map(booking => (
                        <InvoiceCard key={String(booking._id)} booking={booking} isPending={false} />
                    ))}
                 </div>
               </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function InvoiceCard({ booking, isPending }: { booking: any, isPending: boolean }) {
  const total = booking.invoice?.total || 0;
  const itemCount = booking.invoice?.items?.length || 0;
  
  return (
    <div className={cn(
        "group relative overflow-hidden rounded-2xl border p-6 transition-all hover:shadow-lg",
        isPending ? "bg-card border-amber-500/50 shadow-amber-500/10" : "bg-card/50 border-border opacity-75 hover:opacity-100"
    )}>
       <div className="flex justify-between items-start mb-4">
          <div>
             <h3 className="font-bold text-lg">{booking.provider?.businessName || booking.provider?.name || "Provider"}</h3>
             <p className="text-xs text-muted-foreground">Booking ID: {booking._id.slice(-6).toUpperCase()}</p>
          </div>
          <div className={cn("px-3 py-1 rounded-full text-xs font-bold capitalize", 
              isPending ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-secondary text-secondary-foreground"
          )}>
               {isPending ? "Payment Due" : booking.status.replace("_", " ")}
          </div>
       </div>

       <div className="flex justify-between items-end">
           <div>
               <p className="text-sm text-muted-foreground mb-1">{itemCount} Items</p>
               <p className="text-xs text-muted-foreground">
                   {format(new Date(booking.invoice?.createdAt || booking.updatedAt), "PPP")}
               </p>
           </div>
           <div className="text-right">
               <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
               <p className="text-2xl font-black font-heading tracking-tight">₹{total}</p>
           </div>
       </div>

       <div className="mt-6 pt-4 border-t border-border flex gap-3">
          {isPending ? (
             <Link 
               href={`/seeker/bookings/${booking._id}/invoice-review`}
               className="flex-1 btn btn-primary h-11 rounded-xl font-bold shadow-lg shadow-primary/20 group-hover:scale-[1.02] transition-transform"
             >
                Review & Pay
             </Link>
          ) : (
             <Link 
               href={`/seeker/orders/${booking.order_id || "#"}`} // Assuming order_id might be linked, else just view booking
               className="flex-1 btn btn-ghost btn-sm h-11 rounded-xl text-muted-foreground border border-border"
             >
                View Order
             </Link>
          )}
       </div>
    </div>
  );
}
