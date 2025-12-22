import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import InvoiceReviewForm from "@/components/seeker/invoice-review-form";
import dynamic from "next/dynamic";
const BookingChat = dynamic(() => import("@/components/chat-interface"), { ssr: false });

export default async function InvoiceReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signin");
  const { db } = await getDb();
  // Find booking
  const booking = await db
    .collection("bookings")
    .findOne({ _id: new ObjectId(params.id) });

  if (!booking || booking.seeker_id.toString() !== session.user.id)
    redirect("/dashboard/seeker");

  const invoice = booking.invoice;
  if (!invoice) redirect("/dashboard/seeker"); // Or show "Invoice not ready"
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Review Invoice</h1>
      <InvoiceReviewForm invoice={invoice} bookingId={params.id} />
      <div className="mt-8">
        <h2 className="font-semibold text-lg mb-2">Chat with Provider</h2>
        <BookingChat bookingId={params.id} selfRole="seeker" />
      </div>
    </div>
  );
}
