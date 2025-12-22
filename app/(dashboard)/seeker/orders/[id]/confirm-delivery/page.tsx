import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import DeliveryOtpForm from "@/components/seeker/delivery-otp-form";

export default async function DeliveryOtpPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signin");
  const { db } = await getDb();
  // Only allow seeker to confirm delivery
  const order = await db
    .collection("orders")
    .findOne({ _id: new ObjectId(params.id) });
  if (!order || order.seeker_id.toString() !== session.user.id)
    redirect("/dashboard/seeker");
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Confirm Delivery</h1>
      <DeliveryOtpForm orderId={params.id} />
    </div>
  );
}
