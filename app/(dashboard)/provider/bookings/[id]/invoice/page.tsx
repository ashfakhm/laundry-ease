import { redirect } from "next/navigation";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { InvoiceForm } from "@/components/providers/invoice-form";
import OrderChat from "@/components/order-chat";
import { requireProvider } from "@/lib/api/auth";

export default async function CreateInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let providerId: ObjectId;
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) redirect("/auth");
    providerId = new ObjectId(user.id);
  } catch {
    redirect("/auth");
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    redirect("/provider/bookings");
  }

  const { db } = await getDb();

  const provider = await db
    .collection("providers")
    .findOne({ _id: providerId });

  if (!provider) {
    redirect("/provider/profile");
  }

  const booking = await db
    .collection("bookings")
    .findOne({ _id: new ObjectId(id) });

  if (!booking || booking.provider_id.toString() !== provider._id.toString()) {
    redirect("/provider/bookings");
  }

  const seeker = await db
    .collection("seekers")
    .findOne({ _id: new ObjectId(booking.seeker_id) });

  // Look up order by booking_id — chat is only available after order is created
  const order = await db
    .collection("orders")
    .findOne({ booking_id: new ObjectId(id) }, { projection: { _id: 1 } });

  const orderId = order?._id?.toString() ?? null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Create Invoice
        </h1>
        <p className="mt-2 text-muted-foreground">
          Add items and photos for {seeker?.name || "customer"}
        </p>
      </header>
      <div className="bg-card border border-border rounded-2xl p-6 mb-8">
        <InvoiceForm bookingId={id} />
        <p className="text-sm text-muted-foreground mt-2">Booking ID: {id}</p>
      </div>
      <div className="mt-8">
        <h2 className="font-semibold text-lg mb-2">Chat with Seeker</h2>
        {orderId ? (
          <OrderChat orderId={orderId} selfRole="provider" />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Chat will be available after the invoice is created and the order
              is generated.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
