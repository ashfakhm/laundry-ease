import { getSeekerBookings } from "@/lib/data/bookings";
import { Metadata } from "next";
import {
  Receipt,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  CreditCard,
  FileText,
  Calendar,
  ChevronRight,
  ShieldAlert,
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
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-foreground">
            Unable to load invoices
          </h2>
          <p className="mt-2 text-muted-foreground">
            {result.error || "Please try again later or contact support."}
          </p>
        </div>
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

  // Calculate stats
  const stats = {
    pending: pendingInvoices.length,
    paid: pastInvoices.length,
    total: bookingsWithInvoices.length,
  };

  return (
    <main className="min-h-screen bg-background/50 p-6 space-y-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-6">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              My Invoices
            </h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Manage payments and view your transaction history.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              icon={Clock}
              label="Pending"
              value={stats.pending}
              className="bg-amber-500/10 text-amber-600 border-amber-500/20"
            />
            <StatCard
              icon={CheckCircle2}
              label="Paid"
              value={stats.paid}
              className="bg-green-500/10 text-green-600 border-green-500/20"
            />
            <StatCard
              icon={Receipt}
              label="Total Invoices"
              value={stats.total}
              className="bg-background border-border"
            />
          </div>
        </header>

        {!hasInvoices ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-6">
              <Receipt className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold text-foreground">
              No invoices found
            </h3>
            <p className="mt-2 text-muted-foreground max-w-sm">
              Your invoice history is empty. Once you book a laundry service and
              the provider generates a bill, it will appear here for you to
              review and pay.
            </p>
            <Link
              href="/seeker"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:bg-primary/90"
            >
              <Search className="h-5 w-5" />
              Find Providers
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Pending Section */}
            {pendingInvoices.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-heading font-bold text-foreground">
                    Pending Payments
                  </h2>
                  <div className="h-px flex-1 bg-border ml-4"></div>
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
                  <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-heading font-bold text-foreground">
                    Payment History
                  </h2>
                  <div className="h-px flex-1 bg-border ml-4"></div>
                </div>

                <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
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
        )}
      </div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border p-4 transition-colors",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-current/10">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
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
    <div className="group relative bg-card border border-amber-500/30 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-linear-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Status Badge */}
      <div className="absolute top-6 right-6">
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-bold uppercase tracking-wider">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          Due Now
        </span>
      </div>

      <div className="relative z-10">
        <div className="mb-6">
          <p className="text-xs font-mono text-muted-foreground mb-2 tracking-wide uppercase">
            ID: {bookingId.slice(-6)}
          </p>
          <h3 className="text-xl font-bold text-foreground truncate max-w-[80%]">
            {providerName}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Calendar className="w-3 h-3" /> Date
            </div>
            <p className="font-semibold text-foreground text-sm">
              {format(
                new Date(booking.invoice?.createdAt || new Date()),
                "MMM dd",
              )}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="w-3 h-3" /> Items
            </div>
            <p className="font-semibold text-foreground text-sm">
              {itemCount} Service{itemCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Total Due</p>
            <p className="text-3xl font-black text-foreground tracking-tight">
              ₹{total}
            </p>
          </div>
          <Link
            href={`/seeker/bookings/${bookingId}/invoice-review`}
            className="h-12 px-6 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
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
        "group relative p-5 transition-colors hover:bg-muted/50",
        !isLast && "border-b border-border",
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Info */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex h-12 w-12 rounded-full bg-muted items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-foreground">{providerName}</h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground border border-border">
                {booking.status.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <span>ID: {bookingId.slice(-6)}</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>{format(date, "PPP")}</span>
            </div>
          </div>
        </div>

        {/* Right: Amount & Action */}
        <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto mt-2 md:mt-0">
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">
              {itemCount} items
            </p>
            <p className="text-lg font-bold text-foreground">₹{total}</p>
          </div>

          <Link
            href={`/seeker/orders/${booking.order_id || "#"}`}
            className="h-10 w-10 md:w-auto md:px-4 md:py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 transition-all text-sm font-medium border border-border"
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
