import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export default async function CreateInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/signin");
  }

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
    .findOne({ _id: new ObjectId(params.id) });

  if (!booking || booking.provider_id.toString() !== provider._id.toString()) {
    redirect("/provider/bookings");
  }

  // Get seeker details
  const seeker = await db
    .collection("seekers")
    .findOne({ _id: new ObjectId(booking.seeker_id) });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Create Invoice
        </h1>
        <p className="mt-2 text-muted-foreground">
          Add items and photos for {seeker?.name || "customer"}
        </p>
      </header>

      <div className="bg-card border border-border rounded-2xl p-6">
        <p className="text-muted-foreground">
          Invoice form component will be implemented here.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Booking ID: {params.id}
        </p>
      </div>
    </div>
  );
}
