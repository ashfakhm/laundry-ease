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
    if (!ObjectId.isValid(user.id)) redirect("/signin");
    seekerId = user.id;
  } catch {
    redirect("/signin");
  }

  if (!ObjectId.isValid(id)) {
    redirect("/dashboard/seeker");
  }

  const { db } = await getDb();
  // Find booking
  const booking = await db
    .collection("bookings")
    .findOne({ _id: new ObjectId(id) });

  if (!booking || booking.seeker_id.toString() !== seekerId)
    redirect("/dashboard/seeker");

  const invoice = booking.invoice;
  if (!invoice) redirect("/dashboard/seeker"); // Or show "Invoice not ready"

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
