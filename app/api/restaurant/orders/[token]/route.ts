import { NextRequest } from "next/server";
import { getOrderByTrackingToken } from "@/lib/restaurant/orders";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return errorResponse("Missing tracking token", "BAD_REQUEST", 400);
    }

    const ip = getClientIp(req);
    // Allow polling every 5 seconds (120 requests per minute)
    checkRateLimit(`order_poll:${ip}`, 120, 60);

    const order = await getOrderByTrackingToken(token);
    if (!order) {
      return errorResponse("Order not found", "NOT_FOUND", 404);
    }

    // Public sanitized order payload
    const publicOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
      type: order.type,
      status: order.status,
      paymentStatus: order.paymentStatus,
      placedAt: order.placedAt,
      acceptedAt: order.acceptedAt,
      preparingAt: order.preparingAt,
      readyAt: order.readyAt,
      servedAt: order.servedAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      cancelReason: order.cancelReason,
      customerName: order.customerName,
      customerPhone: order.customerPhone ? `${order.customerPhone.slice(0, 5)}...${order.customerPhone.slice(-3)}` : null,
      notes: order.notes,
      subtotalPesewas: order.subtotalPesewas,
      discountPesewas: order.discountPesewas,
      taxPesewas: order.taxPesewas,
      totalPesewas: order.totalPesewas,
      paystackReference: order.paystackReference,
      table: order.table ? { label: order.table.label } : null,
      roomNumber: order.reservation?.rooms?.[0]?.room?.number || null,
      items: order.items.map((i) => ({
        id: i.id,
        name: i.item.name,
        quantity: i.quantity,
        unitPricePesewas: i.unitPriceSnapshot,
        totalPricePesewas: i.totalPricePesewas,
        selectedModifiers: i.selectedModifiersSnapshot,
        notes: i.notes,
        station: i.station,
      })),
    };

    return successResponse({ order: publicOrder });
  } catch (err) {
    return handleRouteError(err);
  }
}
