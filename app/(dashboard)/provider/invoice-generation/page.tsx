"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  FileText,
  Download,
  Calendar,
  IndianRupee,
  CheckCircle2,
} from "lucide-react";
import { reportError } from "@/lib/client-error";

type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Order = {
  _id: string;
  booking_id?: string | null;
  items: OrderItem[];
  total_price: number;
  delivery_charge: number;
  payment_status: string;
  process_status?: string;
  createdAt: string;
  otp_confirmed_at?: string;
  seeker?: {
    name: string;
    email: string;
    phone?: string;
  };
};

type ProviderProfile = {
  _id: string;
  name: string;
  businessName?: string;
  email: string;
  phone?: string;
  services?: Array<{ name: string; pricePerKg: number }>;
};

import { getProviderOrders } from "@/app/actions/order-actions";
import { getProviderProfile } from "@/app/actions/profile-actions";

const objectIdPattern = /^[a-f\d]{24}$/i;

function resolveInvoiceId(order: Order): string | null {
  if (order.booking_id && objectIdPattern.test(order.booking_id)) {
    return order.booking_id;
  }
  if (order._id && objectIdPattern.test(order._id)) {
    return order._id;
  }
  return null;
}

export default function InvoiceGenerationPage() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [_provider, setProvider] = useState<ProviderProfile | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [ordersRes, profileRes] = await Promise.all([
          getProviderOrders(),
          getProviderProfile(),
        ]);

        if (ordersRes.success && Array.isArray(ordersRes.data)) {
          setOrders(
            (ordersRes.data as Order[]).filter(
              (o) => o.otp_confirmed_at || o.process_status === "delivered",
            ),
          );
        } else if (!ordersRes.success) {
          reportError("OrderFetchError", ordersRes.error);
        }

        if (profileRes.success && profileRes.data) {
          setProvider(profileRes.data as ProviderProfile);
        } else if (!profileRes.success) {
          reportError("ProviderProfileFetchError", profileRes.error);
        }
      } catch (error) {
        reportError("DataFetchError", error);
      } finally {
        setLoading(false);
      }
    }

    if (status === "loading") return;
    if (!session) {
      setLoading(false);
      return;
    }

    fetchData();
  }, [session, status]);

  async function downloadInvoice(order: Order) {
    const invoiceId = resolveInvoiceId(order);
    if (!invoiceId) {
      setDownloadError("Missing booking reference for this invoice.");
      return;
    }
    setDownloadError(null);
    setDownloadingId(order._id);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) {
        let msg = "Failed to fetch PDF";
        try {
          const data = await res.json();
          msg = data?.error?.message || msg;
        } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${order._id.slice(-8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Unknown download error",
      );
      reportError("InvoiceDownloadError", err);
    } finally {
      setDownloadingId(null);
    }
  }

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
          <h1 className="text-2xl font-bold">Invoice Generation</h1>
          <p className="text-sm text-muted-foreground">
            Generate and download invoices for completed orders
          </p>
        </div>

        {downloadError && (
          <div className="mb-4 rounded-xl border border-destructive bg-destructive/10 p-4 text-destructive">
            <strong>Error:</strong> {downloadError}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="rounded-3xl border bg-card/80 p-12 text-center shadow-sm backdrop-blur">
            <FileText className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No completed orders</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Invoices will appear here once orders are delivered
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <div
                key={order._id}
                className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur"
              >
                {(() => {
                  const invoiceId = resolveInvoiceId(order);
                  const isDownloading = downloadingId === order._id;
                  const isDisabled = !invoiceId || isDownloading;

                  return (
                    <>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-emerald-600" />
                            <h3 className="font-semibold">
                              #{order._id.slice(-8)}
                            </h3>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Delivered
                        </span>
                      </div>

                      <div className="mt-4 rounded-xl border bg-background p-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          Customer
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {order.seeker?.name}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between rounded-xl border bg-background p-3">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Total Amount
                          </p>
                          <div className="mt-0.5 flex items-center gap-1">
                            <IndianRupee className="h-4 w-4 text-emerald-600" />
                            <span className="text-lg font-bold text-emerald-600">
                        {order.total_price}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => downloadInvoice(order)}
                          className={`inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                          disabled={isDisabled}
                          title={
                            !invoiceId
                              ? "Missing booking reference for this invoice"
                              : undefined
                          }
                        >
                          {isDownloading ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          {isDownloading ? "Downloading..." : "Download"}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
