import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import DeliveryOtpForm from "@/components/seeker/delivery-otp-form";

export default async function DeliveryOtpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signin");
  const { db } = await getDb();
  // Only allow seeker to confirm delivery
  const order = await db
    .collection("orders")
    .findOne({ _id: new ObjectId(id) });
  if (!order || order.seeker_id.toString() !== session.user.id)
    redirect("/dashboard/seeker");
  return (
    <div className="max-w-md mx-auto p-6">
      <div className="mb-4">
        <Link
          href="/seeker/view-orders"
          className="text-xs font-bold text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors uppercase tracking-wider"
        >
          <ChevronRight className="w-3 h-3 rotate-180" /> Back to Orders
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-4">Confirm Delivery</h1>
      <DeliveryOtpForm orderId={id} />
    </div>
  );
}
