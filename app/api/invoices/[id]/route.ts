import { successResponse, errorResponse } from "@/lib/api/response";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
/**
 * GET /api/invoices/[id]
 * Returns a PDF invoice for a booking/order (provider only)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSameOrigin(req);
    const { user } = await requireProvider();
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking ID"),
      );
    }
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const { db } = await getDb();
    const bookingId = new ObjectId(id);
    const providerId = new ObjectId(user.id);

    // Find booking and invoice
    const booking = await db.collection("bookings").findOne({ _id: bookingId });
    if (!booking) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
      );
    }
    if (String(booking.provider_id) !== user.id) {
      return errorResponse(
        new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"),
      );
    }
    if (!booking.invoice) {
      return errorResponse(
        new AppError(
          ErrorCode.NOT_FOUND,
          404,
          "No invoice found for this booking",
        ),
      );
    }

    // Optionally, fetch provider details
    const provider = await db
      .collection("providers")
      .findOne({ _id: providerId });

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([420, 595]); // A5 size (portrait)
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - 40;
    const left = 40;
    const lineHeight = 18;

    // Header
    page.drawText("INVOICE", {
      x: left,
      y,
      size: 20,
      font,
      color: rgb(0, 0.5, 0.2),
    });
    y -= lineHeight * 2;
    page.drawText(`Invoice #: ${String(booking._id).slice(-8)}`, {
      x: left,
      y,
      size: 12,
      font,
    });
    y -= lineHeight;
    page.drawText(
      `Date: ${new Date(booking.invoice.createdAt).toLocaleDateString()}`,
      { x: left, y, size: 12, font },
    );
    y -= lineHeight;
    if (booking.status === "completed" && booking.arrivedAt) {
      page.drawText(
        `Delivery: ${new Date(booking.arrivedAt).toLocaleDateString()}`,
        { x: left, y, size: 12, font },
      );
      y -= lineHeight;
    }

    // Provider
    y -= lineHeight;
    page.drawText("Provider:", {
      x: left,
      y,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= lineHeight;
    page.drawText(provider?.businessName || provider?.name || "-", {
      x: left + 20,
      y,
      size: 12,
      font,
    });
    y -= lineHeight;
    if (provider?.email) {
      page.drawText(provider.email, { x: left + 20, y, size: 10, font });
      y -= lineHeight;
    }
    if (provider?.phone) {
      page.drawText(provider.phone, { x: left + 20, y, size: 10, font });
      y -= lineHeight;
    }

    // Seeker
    y -= lineHeight;
    page.drawText("Billed To:", {
      x: left,
      y,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= lineHeight;
    if (booking.seekerDetails) {
      page.drawText(booking.seekerDetails.name || "-", {
        x: left + 20,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
      if (booking.seekerDetails.email) {
        page.drawText(booking.seekerDetails.email, {
          x: left + 20,
          y,
          size: 10,
          font,
        });
        y -= lineHeight;
      }
      if (booking.seekerDetails.phone) {
        page.drawText(booking.seekerDetails.phone, {
          x: left + 20,
          y,
          size: 10,
          font,
        });
        y -= lineHeight;
      }
    }

    // Items
    y -= lineHeight;
    page.drawText("Items:", {
      x: left,
      y,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= lineHeight;
    page.drawText("Item", { x: left, y, size: 11, font });
    page.drawText("Qty", { x: left + 160, y, size: 11, font });
    page.drawText("Unit", { x: left + 200, y, size: 11, font });
    page.drawText("Total", { x: left + 260, y, size: 11, font });
    y -= lineHeight;
    for (const item of booking.invoice.items) {
      page.drawText(item.itemType, { x: left, y, size: 10, font });
      page.drawText(String(item.quantity), {
        x: left + 160,
        y,
        size: 10,
        font,
      });
      page.drawText(`₹${item.unitPrice}`, { x: left + 200, y, size: 10, font });
      page.drawText(`₹${item.quantity * item.unitPrice}`, {
        x: left + 260,
        y,
        size: 10,
        font,
      });
      y -= lineHeight;
    }

    // Totals
    y -= lineHeight;
    page.drawText(`Subtotal: ₹${booking.invoice.subtotal ?? "-"}`, {
      x: left,
      y,
      size: 12,
      font,
    });
    y -= lineHeight;
    if (booking.invoice.discount) {
      page.drawText(`Discount: -₹${booking.invoice.discount}`, {
        x: left,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
    }
    page.drawText(`Total: ₹${booking.invoice.total ?? "-"}`, {
      x: left,
      y,
      size: 14,
      font,
      color: rgb(0, 0.5, 0.2),
    });
    y -= lineHeight * 2;

    // Notes
    if (booking.invoice.notes) {
      page.drawText("Notes:", { x: left, y, size: 11, font });
      y -= lineHeight;
      page.drawText(booking.invoice.notes, { x: left + 20, y, size: 10, font });
      y -= lineHeight;
    }

    // Footer
    y = 40;
    page.drawText("Thank you for your business!", {
      x: left,
      y,
      size: 11,
      font,
      color: rgb(0, 0.4, 0.2),
    });

    const pdfBytes = await pdfDoc.save();
    // Convert Uint8Array to Buffer for Node.js Response compatibility
    const pdfBuffer = Buffer.from(pdfBytes);
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=invoice-${String(booking._id).slice(-8)}.pdf`,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }
    logger.error("INVOICES", "Error generating invoice PDF", error);
    return errorResponse(
      new AppError(
        ErrorCode.INTERNAL_ERROR,
        500,
        "Failed to generate invoice PDF",
      ),
    );
  }
}
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { requireProvider } from "@/lib/api/auth";
import { invoiceCreateSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import { requireSameOrigin } from "@/lib/api/security";

/**
 * POST /api/invoices/[id]
 * Save invoice data for a booking/order
 * Body: { items: [{ itemType, quantity, unitPrice, photoUrl? }], total, notes? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSameOrigin(req);
    const { user } = await requireProvider();

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking ID"),
      );
    }
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const body = await req.json();
    const parsed = invoiceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Invalid invoice data",
          parsed,
        ),
      );
    }

    const { db } = await getDb();
    const bookingId = new ObjectId(id);
    const providerId = new ObjectId(user.id);

    const booking = await db.collection("bookings").findOne({
      _id: bookingId,
    });
    if (!booking) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
      );
    }

    if (String(booking.provider_id) !== user.id) {
      return errorResponse(
        new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"),
      );
    }

    if (
      booking.status !== "confirmed" &&
      booking.status !== "invoice_created"
    ) {
      return errorResponse(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          "Invoice can only be created for confirmed bookings",
        ),
      );
    }

    const calculatedSubtotal = parsed.data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const cleanSubtotal =
      parsed.data.subtotal !== undefined
        ? parsed.data.subtotal
        : calculatedSubtotal;
    const cleanDiscount = parsed.data.discount || 0;
    const cleanTotal =
      parsed.data.total !== undefined
        ? Math.max(0, parsed.data.total)
        : Math.max(0, cleanSubtotal - cleanDiscount);

    const now = new Date();
    const invoicePayload = {
      items: parsed.data.items,
      notes: parsed.data.notes || "",
      photos: parsed.data.photos || [],
      discount: cleanDiscount,
      subtotal: cleanSubtotal,
      total: cleanTotal,
      createdAt: now,
    };

    await db.collection("invoices").updateOne(
      { booking_id: bookingId, provider_id: providerId },
      {
        $set: {
          ...invoicePayload,
          updatedAt: now,
        },
        $setOnInsert: {
          booking_id: bookingId,
          provider_id: providerId,
        },
      },
      { upsert: true },
    );

    await db.collection("bookings").updateOne(
      { _id: bookingId },
      {
        $set: {
          status: "invoice_created",
          invoice: invoicePayload,
          updatedAt: now,
        },
      },
    );

    return successResponse(
      {
        success: true,
      },
      200,
    );
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("INVOICES", "Error creating invoice", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to create invoice"),
    );
  }
}
