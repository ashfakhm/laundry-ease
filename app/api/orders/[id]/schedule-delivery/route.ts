import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Order } from "@/types/orders";

// POST /api/orders/[id]/schedule-delivery
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { action, dateTime } = await req.json(); // action: 'propose' | 'confirm'

        if (!id || !action) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const { db } = await getDb();
        const order = await db.collection<Order>("orders").findOne({ _id: new ObjectId(id) });

        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        if (action === "propose") {
             if (!dateTime) return NextResponse.json({ error: "Date required" }, { status: 400 });
             
             await db.collection<Order>("orders").updateOne(
                 { _id: new ObjectId(id) },
                 { 
                     $set: { 
                         deliverySlot: {
                             proposedBy: "provider",
                             dateTime: new Date(dateTime),
                             proposedAt: new Date()
                         },
                         process_status: "ready" // Assuming proposing delivery means it's ready
                     } 
                 }
             );
             return NextResponse.json({ success: true, message: "Delivery proposed" });

        } else if (action === "confirm") {
            if (!order.deliverySlot) return NextResponse.json({ error: "No slot proposed" }, { status: 400 });

            await db.collection<Order>("orders").updateOne(
                { _id: new ObjectId(id) },
                { 
                    $set: { 
                        "deliverySlot.confirmedAt": new Date(),
                        process_status: "out_for_delivery" // Or waiting for pickup, but strict flow usually moves to out_for_delivery on confirmation or actual dispatch
                    } 
                }
            );
            return NextResponse.json({ success: true, message: "Delivery confirmed" });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("Scheduling Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
