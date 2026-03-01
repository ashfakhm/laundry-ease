import { requireSeeker } from "@/lib/api/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import InvoiceReviewForm from "@/components/seeker/invoice-review-form";

export default async function InvoiceReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let seekerId: string;
  try {
    const { user } = await requireSeeker();
    if (!ObjectId.isValid(user.id)) redirect("/auth");
    seekerId = user.id;
  } catch {
    redirect("/auth");
  }

  if (!ObjectId.isValid(id)) {
    redirect("/seeker");
  }

  const { db } = await getDb();
  // Find booking
  const booking = await db
    .collection("bookings")
    .findOne({ _id: new ObjectId(id) });

  if (!booking || booking.seeker_id.toString() !== seekerId)
    redirect("/seeker");

  const invoice = booking.invoice;
  if (!invoice) redirect("/seeker"); // Or show "Invoice not ready"

  // Determine if this is a read-only view (invoice already processed)
  const isReadOnly = booking.status !== "invoice_created";

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold mb-4">
        {isReadOnly ? "Invoice Details" : "Review Invoice"}
      </h1>
      <InvoiceReviewForm
        invoice={invoice}
        bookingId={id}
        readOnly={isReadOnly}
      />
    </div>
  );
}
