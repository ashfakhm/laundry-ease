import { getSeekerBookings } from "@/lib/data/bookings";
import { Metadata } from "next";
import {
  Receipt,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  CreditCard,
  FileText,
  Calendar,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface InvoiceBooking {
  _id: string | { toString(): string };
  status: string;
  updatedAt?: string | Date;
  createdAt: string | Date;
  order_id?: string;
  provider?: {
    businessName?: string;
    name?: string;
  } | null;
  invoice?: {
    total?: number;
    items?: Array<unknown>;
    createdAt?: string | Date;
  } | null;
}

// Force dynamic rendering
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Invoices | LaundryEase",
  description: "View and pay your laundry invoices.",
};

export default async function SeekerInvoicesPage() {
  const result = await getSeekerBookings();

  if (!result.success || !result.data) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center text-center">
        <div className="h-24 w-24 rounded-full bg-red-500/10 flex items-center justify-center mb-6 ring-4 ring-red-500/5">
          <AlertCircle className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">
          Unable to load invoices
        </h2>
        <p className="text-slate-400 mt-2 text-lg max-w-md mx-auto">
          {result.error}
        </p>
      </main>
    );
  }

  // Filter bookings that have an invoice
  const bookingsWithInvoices = result.data
    .filter(
      (b) =>
        b.invoice || b.status === "invoice_created" || b.status === "confirmed",
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    );

  const pendingInvoices = bookingsWithInvoices.filter(
    (b) => b.status === "invoice_created",
  );
  const pastInvoices = bookingsWithInvoices.filter(
    (b) => b.status !== "invoice_created",
  );

  const hasInvoices = bookingsWithInvoices.length > 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-2 bg-linear-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              My Invoices
            </h1>
            <p className="text-slate-400 text-lg">
              Manage payments and view your transaction history.
            </p>
          </div>
          {hasInvoices && (
            <div className="flex gap-3">
              <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-end">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  Total Pending
                </span>
                <span className="text-xl font-bold text-amber-500">
                  {pendingInvoices.length}
                </span>
              </div>
            </div>
          )}
        </header>

        {!hasInvoices ? (
          <div className="relative overflow-hidden rounded-3xl bg-slate-900/50 border border-slate-800 p-12 text-center md:p-20">
            <div className="absolute inset-0 bg-linear-to-b from-transparent to-slate-900/80 pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="mb-8 p-6 rounded-full bg-slate-800/50 ring-1 ring-white/10 shadow-2xl">
                <Receipt className="w-16 h-16 text-slate-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                No invoices found
              </h3>
              <p className="text-slate-400 max-w-lg mx-auto mb-10 text-lg leading-relaxed">
                Your invoice history is empty. Once you book a laundry service
                and the provider generates a bill, it will appear here for you
                to review and pay.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto">
                <Link
                  href="/seeker"
                  className="flex-1 btn bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-14 px-8 font-bold text-lg inline-flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                >
                  <Search className="h-5 w-5" />
                  Find Providers
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-8">
            {/* Main Content Area */}
            <div className="lg:col-span-12 space-y-12">
              {/* Pending Section */}
              {pendingInvoices.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                      <Clock className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      Pending Payments
                    </h2>
                    <div className="h-px flex-1 bg-slate-800 ml-4"></div>
                  </div>

                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {pendingInvoices.map((booking) => (
                      <PendingInvoiceCard
                        key={String(booking._id)}
                        booking={booking}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* History Section */}
              {pastInvoices.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      Payment History
                    </h2>
                    <div className="h-px flex-1 bg-slate-800 ml-4"></div>
                  </div>

                  <div className="bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden backdrop-blur-sm">
                    {pastInvoices.map((booking, index) => (
                      <HistoryInvoiceRow
                        key={String(booking._id)}
                        booking={booking}
                        isLast={index === pastInvoices.length - 1}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------
// SUB-COMPONENTS
// ----------------------------------------------------------------------

function PendingInvoiceCard({ booking }: { booking: InvoiceBooking }) {
  const total = booking.invoice?.total || 0;
  const itemCount = booking.invoice?.items?.length || 0;
  const bookingId = String(booking._id);
  const providerName =
    booking.provider?.businessName || booking.provider?.name || "Provider";

  return (
    <div className="group relative bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-xl shadow-amber-900/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-linear-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Status Badge */}
      <div className="absolute top-6 right-6">
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-wider">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          Due Now
        </span>
      </div>

      <div className="relative z-10">
        <div className="mb-6">
          <p className="text-xs font-mono text-slate-500 mb-2 tracking-wide uppercase">
            ID: {bookingId.slice(-6)}
          </p>
          <h3 className="text-xl font-bold text-white truncate max-w-[80%]">
            {providerName}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/50">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Calendar className="w-3 h-3" /> Date
            </div>
            <p className="font-semibold text-slate-200 text-sm">
              {format(
                new Date(booking.invoice?.createdAt || new Date()),
                "MMM dd",
              )}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/50">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <FileText className="w-3 h-3" /> Items
            </div>
            <p className="font-semibold text-slate-200 text-sm">
              {itemCount} Service{itemCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-slate-400 text-xs mb-1">Total Due</p>
            <p className="text-3xl font-black text-white tracking-tight">
              ₹{total}
            </p>
          </div>
          <Link
            href={`/seeker/bookings/${bookingId}/invoice-review`}
            className="btn h-12 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
          >
            Pay Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function HistoryInvoiceRow({
  booking,
  isLast,
}: {
  booking: InvoiceBooking;
  isLast: boolean;
}) {
  const total = booking.invoice?.total || 0;
  const itemCount = booking.invoice?.items?.length || 0;
  const bookingId = String(booking._id);
  const providerName =
    booking.provider?.businessName || booking.provider?.name || "Provider";
  const date = new Date(
    booking.invoice?.createdAt || booking.updatedAt || booking.createdAt,
  );

  return (
    <div
      className={cn(
        "group relative p-5 transition-colors hover:bg-white/2",
        !isLast && "border-b border-slate-800",
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Info */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex h-12 w-12 rounded-full bg-slate-800 items-center justify-center text-slate-500 group-hover:text-slate-300 transition-colors">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-slate-200">{providerName}</h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                {booking.status.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
              <span>ID: {bookingId.slice(-6)}</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>{format(date, "PPP")}</span>
            </div>
          </div>
        </div>

        {/* Right: Amount & Action */}
        <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto mt-2 md:mt-0">
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-0.5">{itemCount} items</p>
            <p className="text-lg font-bold text-white">₹{total}</p>
          </div>

          <Link
            href={`/seeker/orders/${booking.order_id || "#"}`}
            className="h-10 w-10 md:w-auto md:px-4 md:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all text-sm font-medium"
            title="View Details"
          >
            <span className="hidden md:inline">View Order</span>
            <ChevronRight className="w-4 h-4 md:hidden" />
            <ArrowRight className="w-4 h-4 hidden md:block" />
          </Link>
        </div>
      </div>
    </div>
  );
}
