import { successResponse, errorResponse } from "@/lib/api/response";
import { invoiceCreateSchema } from "@/lib/api/schemas";
import { getDb } from "@/lib/mongodb";
import type { Booking, InvoiceData, InvoiceItem } from "@/types/bookings";
import type { Order } from "@/types/orders";
import type { Provider, Seeker } from "@/types/users";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { PDFFont } from "pdf-lib";
import { MONEY_EPSILON, round2 } from "@/lib/utils/monetary";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireProvider } from "@/lib/api/auth";
import { requireSameOrigin } from "@/lib/api/security";

type LegacyOrder = Omit<Order, "_id" | "booking_id" | "provider_id" | "seeker_id"> & {
  _id: string;
  booking_id?: string | ObjectId;
  provider_id: string | ObjectId;
  seeker_id: string | ObjectId;
};

const PAGE_SIZE: [number, number] = [420, 595];
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 40;
const LEFT_MARGIN = 40;
const RIGHT_MARGIN = 40;
const LINE_HEIGHT = 18;

function truncateText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  size: number,
): string {
  const safeText = text?.trim() || "-";
  if (font.widthOfTextAtSize(safeText, size) <= maxWidth) return safeText;
  const ellipsis = "...";
  const maxTextWidth = maxWidth - font.widthOfTextAtSize(ellipsis, size);
  let trimmed = safeText;
  while (
    trimmed.length > 0 &&
    font.widthOfTextAtSize(trimmed, size) > maxTextWidth
  ) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed.length > 0 ? `${trimmed}${ellipsis}` : ellipsis;
}

function wrapText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  size: number,
): string[] {
  const safeText = text?.trim();
  if (!safeText) return ["-"];
  const words = safeText.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  const pushLine = () => {
    if (line) {
      lines.push(line);
      line = "";
    }
  };

  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      pushLine();
      let chunk = "";
      for (const ch of word) {
        const candidate = chunk + ch;
        if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
          if (chunk) lines.push(chunk);
          chunk = ch;
        } else {
          chunk = candidate;
        }
      }
      if (chunk) lines.push(chunk);
      continue;
    }

    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      pushLine();
      line = word;
    }
  }

  pushLine();
  return lines;
}

function formatRupees(amount: number): string {
  return `Rs. ${round2(amount).toFixed(2)}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeInvoiceItems(rawItems: InvoiceItem[] | unknown[]): InvoiceItem[] {
  if (!Array.isArray(rawItems)) return [];
  const normalized: InvoiceItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const itemType =
      typeof item.itemType === "string" && item.itemType.trim()
        ? item.itemType.trim()
        : "Item";
    const quantity = isFiniteNumber(item.quantity) ? item.quantity : 0;
    const unitPrice = isFiniteNumber(item.unitPrice) ? item.unitPrice : 0;
    const photoUrl =
      typeof item.photoUrl === "string" && item.photoUrl.trim()
        ? item.photoUrl.trim()
        : undefined;
    if (quantity > 0 && unitPrice >= 0) {
      normalized.push({ itemType, quantity, unitPrice, photoUrl });
    }
  }
  return normalized;
}

function normalizeOrderItems(rawItems: Order["items"] | unknown[]): InvoiceItem[] {
  if (!Array.isArray(rawItems)) return [];
  const normalized: InvoiceItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const itemType =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : "Item";
    const quantity = isFiniteNumber(item.quantity) ? item.quantity : 0;
    const unitPrice = isFiniteNumber(item.unit_price) ? item.unit_price : 0;
    const photoUrl =
      typeof item.photoUrl === "string" && item.photoUrl.trim()
        ? item.photoUrl.trim()
        : undefined;
    if (quantity > 0 && unitPrice >= 0) {
      normalized.push({ itemType, quantity, unitPrice, photoUrl });
    }
  }
  return normalized;
}
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
      logger.error("INVOICES", "Invalid booking ID for invoice", {
        bookingId: id,
        userId: user?.id,
      });
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking ID"),
      );
    }
    if (!ObjectId.isValid(user.id)) {
      logger.error("INVOICES", "Invalid provider user ID for invoice", {
        userId: user?.id,
      });
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const { db } = await getDb();
    const requestId = new ObjectId(id);
    const providerId = new ObjectId(user.id);

    let booking = await db
      .collection<Booking>("bookings")
      .findOne({ _id: requestId });
    let order: Order | LegacyOrder | null = null;
    if (!booking) {
      order = await db
        .collection<Order>("orders")
        .findOne({ _id: requestId });
      if (!order) {
        order = await db.collection<LegacyOrder>("orders").findOne({ _id: id });
      }
      if (!order) {
        order = await db
          .collection<Order>("orders")
          .findOne({ booking_id: requestId });
      }
      if (!order) {
        order = await db
          .collection<LegacyOrder>("orders")
          .findOne({ booking_id: id });
      }
      if (!order) {
        logger.error("INVOICES", "Booking/order not found for invoice", {
          requestId: id,
          userId: user.id,
        });
        return errorResponse(
          new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
        );
      }
      if (String(order.provider_id) !== user.id) {
        logger.error(
          "INVOICES",
          "Provider not authorized for order invoice",
          { orderId: id, userId: user.id },
        );
        return errorResponse(
          new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
        );
      }
      const orderBookingId = order.booking_id
        ? String(order.booking_id)
        : null;
      if (orderBookingId && ObjectId.isValid(orderBookingId)) {
        booking = await db
          .collection<Booking>("bookings")
          .findOne({ _id: new ObjectId(orderBookingId) });
      } else {
        logger.error("INVOICES", "Order missing booking reference", {
          orderId: id,
          userId: user.id,
        });
      }
    }
    if (!booking && !order) {
      logger.error("INVOICES", "Booking not found for invoice", {
        bookingId: id,
        userId: user.id,
      });
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
      );
    }
    if (booking && String(booking.provider_id) !== user.id) {
      logger.error(
        "INVOICES",
        "Provider not authorized for this booking invoice",
        { bookingId: id, userId: user.id },
      );
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
      );
    }
    let invoice: InvoiceData | null = booking?.invoice ?? null;
    if (!invoice) {
      if (booking) {
        const invoiceDoc = await db.collection("invoices").findOne({
          booking_id: new ObjectId(String(booking._id)),
          provider_id: providerId,
        });
        if (invoiceDoc) {
          invoice = {
            items: Array.isArray(invoiceDoc.items) ? invoiceDoc.items : [],
            notes: invoiceDoc.notes || "",
            photos: invoiceDoc.photos || [],
            discount: invoiceDoc.discount,
            subtotal: invoiceDoc.subtotal,
            total: invoiceDoc.total,
            createdAt:
              invoiceDoc.createdAt || booking.updatedAt || booking.createdAt,
          };
        }
      }
    }

    if (!order && booking) {
      const bookingRef = String(booking._id);
      if (ObjectId.isValid(bookingRef)) {
        order = await db
          .collection<Order>("orders")
          .findOne({ booking_id: new ObjectId(bookingRef) });
      }
      if (!order) {
        order = await db
          .collection<LegacyOrder>("orders")
          .findOne({ booking_id: bookingRef });
      }
      if (order && String(order.provider_id) !== user.id) {
        logger.error(
          "INVOICES",
          "Provider not authorized for order invoice",
          { orderId: order._id, userId: user.id },
        );
        return errorResponse(
          new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
        );
      }
    }

    if (!invoice && order) {
      const orderItems = Array.isArray(order.items) ? order.items : [];
      const fallbackItems = normalizeOrderItems(orderItems);
      const itemsSubtotal = round2(
        fallbackItems.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        ),
      );
      const invoiceSubtotal = isFiniteNumber(order.subtotal)
        ? round2(order.subtotal)
        : itemsSubtotal;
      const invoiceDiscount = isFiniteNumber(order.discount)
        ? round2(order.discount)
        : 0;
      const invoiceTotal = round2(
        Math.max(0, invoiceSubtotal - invoiceDiscount),
      );
      invoice = {
        items: fallbackItems,
        notes: "",
        photos: [],
        subtotal: invoiceSubtotal,
        discount: invoiceDiscount,
        total: invoiceTotal,
        createdAt: order.createdAt || order.updatedAt || new Date(),
      };
    }
    if (!invoice) {
      logger.error("INVOICES", "No invoice found for booking", {
        bookingId: id,
        userId: user.id,
      });
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
      .collection<Provider>("providers")
      .findOne({ _id: providerId });
    if (!provider) {
      logger.error("INVOICES", "Provider not found for invoice", {
        providerId: user.id,
      });
    }

    const seekerRef = booking?.seeker_id ?? order?.seeker_id;
    const seekerId =
      seekerRef && ObjectId.isValid(String(seekerRef))
        ? new ObjectId(String(seekerRef))
        : null;
    const seeker = seekerId
      ? await db.collection<Seeker>("seekers").findOne(
          { _id: seekerId },
          {
            projection: { name: 1, email: 1, phone: 1 },
          },
        )
      : null;

    const orderItems = order ? normalizeOrderItems(order.items) : [];
    const invoiceItems = normalizeInvoiceItems(invoice.items || []);
    const effectiveItems = invoiceItems.length > 0 ? invoiceItems : orderItems;

    if (effectiveItems.length === 0) {
      logger.warn("INVOICES", "Invoice has no items; using placeholder", {
        bookingId: booking?._id,
        orderId: order?._id,
        userId: user.id,
      });
    }

    const itemsSubtotal = round2(
      effectiveItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      ),
    );
    const invoiceSubtotal = isFiniteNumber(invoice.subtotal)
      ? round2(invoice.subtotal)
      : itemsSubtotal;
    const invoiceDiscount = isFiniteNumber(invoice.discount)
      ? round2(invoice.discount)
      : isFiniteNumber(order?.discount)
        ? round2(order.discount)
        : 0;
    let invoiceTotal = isFiniteNumber(invoice.total)
      ? round2(invoice.total)
      : round2(Math.max(0, invoiceSubtotal - invoiceDiscount));
    let deliveryCharge = 0;
    let includeDeliveryLine = false;

    if (order) {
      const orderTotal = isFiniteNumber(order.total_price)
        ? round2(order.total_price)
        : null;
      let orderDelivery = isFiniteNumber(order.delivery_charge)
        ? round2(order.delivery_charge)
        : null;

      if (orderTotal !== null) {
        if (orderDelivery === null) {
          const diff = round2(orderTotal - invoiceTotal);
          if (diff > MONEY_EPSILON) {
            orderDelivery = diff;
          }
        } else if (orderDelivery > MONEY_EPSILON) {
          const computed = round2(invoiceTotal + orderDelivery);
          if (Math.abs(orderTotal - computed) > MONEY_EPSILON) {
            const diff = round2(orderTotal - invoiceTotal);
            if (diff >= 0) orderDelivery = diff;
          }
        }
        invoiceTotal = orderTotal;
      } else if (orderDelivery !== null && orderDelivery > MONEY_EPSILON) {
        invoiceTotal = round2(invoiceTotal + orderDelivery);
      }

      if (orderDelivery !== null && orderDelivery > MONEY_EPSILON) {
        deliveryCharge = orderDelivery;
        includeDeliveryLine = true;
      }
    }

    const invoiceRef = String(
      booking?._id || order?.booking_id || order?._id || id,
    );

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage(PAGE_SIZE); // A5 size (portrait)
    const { height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - MARGIN_TOP;
    const left = LEFT_MARGIN;
    const lineHeight = LINE_HEIGHT;
    const detailTextX = left + 20;
    const detailMaxWidth = PAGE_SIZE[0] - detailTextX - RIGHT_MARGIN;
    const itemColX = left;
    const qtyColX = left + 160;
    const unitColX = left + 200;
    const totalColX = left + 260;
    const itemMaxWidth = qtyColX - itemColX - 10;

    const newPage = () => {
      page = pdfDoc.addPage(PAGE_SIZE);
      y = height - MARGIN_TOP;
    };

    const ensureSpace = (linesNeeded = 1) => {
      if (y - lineHeight * linesNeeded < MARGIN_BOTTOM) {
        newPage();
      }
    };

    const drawItemsHeader = (label: string) => {
      ensureSpace(3);
      page.drawText(label, {
        x: left,
        y,
        size: 12,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= lineHeight;
      page.drawText("Item", { x: itemColX, y, size: 11, font });
      page.drawText("Qty", { x: qtyColX, y, size: 11, font });
      page.drawText("Unit", { x: unitColX, y, size: 11, font });
      page.drawText("Total", { x: totalColX, y, size: 11, font });
      y -= lineHeight;
    };

    // Header
    page.drawText("INVOICE", {
      x: left,
      y,
      size: 20,
      font,
      color: rgb(0, 0.5, 0.2),
    });
    y -= lineHeight * 2;
    page.drawText(`Invoice #: ${invoiceRef.slice(-8)}`, {
      x: left,
      y,
      size: 12,
      font,
    });
    y -= lineHeight;
    page.drawText(
      `Date: ${new Date(
        invoice.createdAt ||
          booking?.updatedAt ||
          booking?.createdAt ||
          order?.updatedAt ||
          order?.createdAt ||
          new Date(),
      ).toLocaleDateString()}`,
      { x: left, y, size: 12, font },
    );
    y -= lineHeight;
    if (booking?.status === "completed" && booking.arrivedAt) {
      page.drawText(
        `Delivery: ${new Date(booking.arrivedAt).toLocaleDateString()}`,
        { x: left, y, size: 12, font },
      );
      y -= lineHeight;
    } else if (order?.otp_confirmed_at) {
      page.drawText(
        `Delivery: ${new Date(order.otp_confirmed_at).toLocaleDateString()}`,
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
    page.drawText(
      truncateText(
        provider?.businessName || provider?.name || "-",
        detailMaxWidth,
        font,
        12,
      ),
      {
        x: detailTextX,
        y,
        size: 12,
        font,
      },
    );
    y -= lineHeight;
    if (provider?.email) {
      page.drawText(
        truncateText(provider.email, detailMaxWidth, font, 10),
        { x: detailTextX, y, size: 10, font },
      );
      y -= lineHeight;
    }
    if (provider?.phone) {
      page.drawText(
        truncateText(provider.phone, detailMaxWidth, font, 10),
        { x: detailTextX, y, size: 10, font },
      );
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
    page.drawText(
      truncateText(seeker?.name || "-", detailMaxWidth, font, 12),
      {
        x: detailTextX,
        y,
        size: 12,
        font,
      },
    );
    y -= lineHeight;
    if (seeker?.email) {
      page.drawText(
        truncateText(seeker.email, detailMaxWidth, font, 10),
        { x: detailTextX, y, size: 10, font },
      );
      y -= lineHeight;
    }
    if (seeker?.phone) {
      page.drawText(
        truncateText(seeker.phone, detailMaxWidth, font, 10),
        { x: detailTextX, y, size: 10, font },
      );
      y -= lineHeight;
    }

    // Items
    y -= lineHeight;
    drawItemsHeader("Items:");
    if (effectiveItems.length === 0) {
      ensureSpace(1);
      page.drawText(
        truncateText("No itemized details available", itemMaxWidth, font, 10),
        { x: itemColX, y, size: 10, font },
      );
      y -= lineHeight;
    } else {
      for (const item of effectiveItems) {
        if (y - lineHeight < MARGIN_BOTTOM) {
          newPage();
          drawItemsHeader("Items (cont.):");
        }
        page.drawText(
          truncateText(item.itemType || "-", itemMaxWidth, font, 10),
          { x: itemColX, y, size: 10, font },
        );
        page.drawText(String(item.quantity), {
          x: qtyColX,
          y,
          size: 10,
          font,
        });
        page.drawText(formatRupees(item.unitPrice), {
          x: unitColX,
          y,
          size: 10,
          font,
        });
        page.drawText(formatRupees(round2(item.quantity * item.unitPrice)), {
          x: totalColX,
          y,
          size: 10,
          font,
        });
        y -= lineHeight;
      }
    }

    // Totals
    ensureSpace(4);
    y -= lineHeight;
    page.drawText(`Subtotal: ${formatRupees(invoiceSubtotal)}`, {
      x: left,
      y,
      size: 12,
      font,
    });
    y -= lineHeight;
    if (invoiceDiscount) {
      page.drawText(`Discount: -${formatRupees(invoiceDiscount)}`, {
        x: left,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
    }
    if (includeDeliveryLine) {
      page.drawText(`Delivery: ${formatRupees(deliveryCharge)}`, {
        x: left,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
    }
    page.drawText(`Total: ${formatRupees(invoiceTotal)}`, {
      x: left,
      y,
      size: 14,
      font,
      color: rgb(0, 0.5, 0.2),
    });
    y -= lineHeight * 2;

    // Notes
    if (invoice.notes) {
      ensureSpace(2);
      page.drawText("Notes:", { x: left, y, size: 11, font });
      y -= lineHeight;
      const noteLines = wrapText(invoice.notes, detailMaxWidth, font, 10);
      for (const line of noteLines) {
        ensureSpace(1);
        page.drawText(line, { x: detailTextX, y, size: 10, font });
        y -= lineHeight;
      }
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
        "Content-Disposition": `attachment; filename=invoice-${invoiceRef.slice(-8)}.pdf`,
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
        new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
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
      (sum: number, item: InvoiceItem) => sum + item.quantity * item.unitPrice,
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
