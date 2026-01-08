import { auth } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { InvoiceForm } from "@/components/providers/invoice-form";
import { revalidatePath } from "next/cache";
import BookingChat from "../Chat";

export default async function CreateInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/signin");
  }

  const { id } = await params;

  const { db } = await getDb();

  // Get provider
  const provider = await db
    .collection("providers")
    .findOne({ email: session.user.email });

  if (!provider) {
    redirect("/provider/profile");
  }

  // Get booking
  const booking = await db
    .collection("bookings")
    .findOne({ _id: new ObjectId(id) });

  if (!booking || booking.provider_id.toString() !== provider._id.toString()) {
    redirect("/provider/bookings");
  }

  // Get seeker details
  const seeker = await db
    .collection("seekers")
    .findOne({ _id: new ObjectId(booking.seeker_id) });

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
        <BookingChat bookingId={id} selfRole="provider" />
      </div>
    </div>
  );
}
