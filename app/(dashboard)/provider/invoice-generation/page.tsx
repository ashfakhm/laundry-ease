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
  items: OrderItem[];
  total_price: number;
  delivery_charge: number;
  payment_status: string;
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

export default function InvoiceGenerationPage() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [_provider, setProvider] = useState<ProviderProfile | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [ordersRes, profileRes] = await Promise.all([
          getProviderOrders(),
          getProviderProfile(),
        ]);

        if (ordersRes.success && Array.isArray(ordersRes.data)) {
          setOrders(
            (ordersRes.data as Order[]).filter((o) => o.otp_confirmed_at),
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
    try {
      const res = await fetch(`/api/invoices/${order._id}`);
      if (!res.ok) throw new Error("Failed to fetch PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${order._id.slice(-8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      reportError("InvoiceDownloadError", err);
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
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-semibold">#{order._id.slice(-8)}</h3>
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
                        {order.total_price + order.delivery_charge}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadInvoice(order)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
