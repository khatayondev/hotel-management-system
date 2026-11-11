import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createRestaurantOrder } from "@/lib/restaurant/orders";
import { RestaurantOrderType, RestaurantPaymentStatus } from "@prisma/client";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import { initializePaystackTransaction } from "@/lib/payments";
import { normalizeGhanaPhone } from "@/lib/sms";
import { UserRole } from "@/lib/rbac";
import { env } from "@/lib/env";
import { z } from "zod";

const publicCreateOrderSchema = z.object({
  type: z.enum([RestaurantOrderType.DINE_IN, RestaurantOrderType.PICKUP]),
  tableId: z.string().uuid().optional(),
  qrToken: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
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
    // 1. Rate Limiting
    const ip = getClientIp(req);
    checkRateLimit(`restaurant_public_order:${ip}`, 30, 60);

    // 2. CSRF Validation
    validateCsrf(req);

    const body = await req.json();
    const parsed = publicCreateOrderSchema.parse(body);

    // 3. Resolve table if DINE_IN
    let resolvedTableId = parsed.tableId;
    if (parsed.type === RestaurantOrderType.DINE_IN) {
      if (!resolvedTableId && parsed.qrToken) {
        const table = await prisma.restaurantTable.findUnique({
          where: { qrToken: parsed.qrToken },
        });
        if (!table || !table.isActive) {
          return errorResponse("Dining table not found or inactive", "TABLE_NOT_FOUND", 400);
        }
        resolvedTableId = table.id;
      }
      if (!resolvedTableId) {
        return errorResponse("Dining table is required for dine-in orders", "TABLE_REQUIRED", 400);
      }
    }

    // 4. Validate customer info for PICKUP
    if (parsed.type === RestaurantOrderType.PICKUP) {
      if (!parsed.customerName?.trim() || !parsed.customerPhone?.trim()) {
        return errorResponse(
          "Customer name and phone number are required for pickup orders",
          "CUSTOMER_INFO_REQUIRED",
          400
        );
      }
    }

    const normPhone = parsed.customerPhone ? normalizeGhanaPhone(parsed.customerPhone) : undefined;

    // 5. Create Order via Order Engine (enforces closed hours & server pricing)
    const order = await createRestaurantOrder(
      {
        type: parsed.type,
        tableId: resolvedTableId,
        customerName: parsed.customerName?.trim() || undefined,
        customerPhone: normPhone,
        notes: parsed.notes?.trim() || undefined,
        items: parsed.items,
        paymentStatus:
          parsed.type === RestaurantOrderType.PICKUP
            ? RestaurantPaymentStatus.PENDING
            : RestaurantPaymentStatus.PENDING,
      },
      {
        userId: "guest",
        role: "GUEST" as unknown as UserRole,
        name: parsed.customerName || "Restaurant Guest",
        email: parsed.customerEmail || "guest@hotel.gh",
      }
    );

    // 6. If PICKUP, initialize Paystack transaction
    if (parsed.type === RestaurantOrderType.PICKUP) {
      const paystackReference = `RO-${order.orderNumber}-${Date.now().toString().slice(-4)}`;
      const customerEmail =
        parsed.customerEmail ||
        `guest.${normPhone ? normPhone.replace("+", "") : Date.now()}@aura.hotel`;

      const callbackUrl = `${env.APP_URL}/order/${order.trackingToken}?payment=success`;

      // Persist Payment record
      await prisma.payment.create({
        data: {
          reference: paystackReference,
          amountPesewas: order.totalPesewas,
          currency: "GHS",
          status: "PENDING",
          channel: "mobile_money",
        },
      });

      // Update order with paystack reference
      await prisma.restaurantOrder.update({
        where: { id: order.id },
        data: { paystackReference },
      });

      let authorizationUrl = `${callbackUrl}&ref=${paystackReference}`;
      try {
        const paystackRes = await initializePaystackTransaction({
          email: customerEmail,
          amountPesewas: order.totalPesewas,
          reference: paystackReference,
          callbackUrl,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            type: "RESTAURANT_PICKUP",
          },
        });
        if (paystackRes?.authorization_url) {
          authorizationUrl = paystackRes.authorization_url;
        }
      } catch (paystackErr) {
        // Fallback for offline/test environments
        console.warn("[Paystack Init Warning] Using fallback URL:", paystackErr);
      }

      return successResponse(
        {
          order,
          trackingToken: order.trackingToken,
          authorizationUrl,
          paystackReference,
        },
        "Pickup order placed. Please complete payment.",
        201
      );
    }

    // Dine-in order
    return successResponse(
      {
        order,
        trackingToken: order.trackingToken,
      },
      "Order placed successfully to your table",
      201
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
