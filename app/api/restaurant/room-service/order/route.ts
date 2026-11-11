import { NextRequest } from "next/server";
import { validateRoomServiceToken } from "@/lib/restaurant/room-service";
import { createRestaurantOrder } from "@/lib/restaurant/orders";
import { RestaurantOrderType, RestaurantPaymentStatus } from "@prisma/client";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import { successResponse, handleRouteError } from "@/lib/api-response";
import { UserRole } from "@/lib/rbac";
import { z } from "zod";

const roomServiceOrderSchema = z.object({
  verificationToken: z.string().min(10, "Valid room service token required"),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        quantity: z.number().int().positive(),
        selectedModifierOptionIds: z.array(z.string().uuid()).optional(),
        notes: z.string().max(200).optional(),
      })
    )
    .min(1, "Order must contain at least one item"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    checkRateLimit(`rs_order_route:${ip}`, 20, 60);
    validateCsrf(req);

    const body = await req.json();
    const parsed = roomServiceOrderSchema.parse(body);

    // 1. Validate Room Service session token
    const guestSession = validateRoomServiceToken(parsed.verificationToken);

    // 2. Create Restaurant Order with ROOM_SERVICE type & folio charge
    const orderNotes = [
      `Delivery to Room ${guestSession.roomNumber}`,
      parsed.notes?.trim(),
    ]
      .filter(Boolean)
      .join(" • ");

    const order = await createRestaurantOrder(
      {
        type: RestaurantOrderType.ROOM_SERVICE,
        reservationId: guestSession.reservationId,
        customerName: guestSession.guestName,
        customerPhone: guestSession.guestPhone,
        notes: orderNotes,
        items: parsed.items,
        paymentStatus: RestaurantPaymentStatus.CHARGED_TO_ROOM,
      },
      {
        userId: "guest",
        role: "GUEST" as unknown as UserRole,
        name: guestSession.guestName,
        email: "roomservice@aura.hotel",
      }
    );

    return successResponse(
      {
        order,
        trackingToken: order.trackingToken,
        roomNumber: guestSession.roomNumber,
        chargedToFolio: true,
      },
      `Room service order placed! Charged to Room ${guestSession.roomNumber} folio.`,
      201
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
