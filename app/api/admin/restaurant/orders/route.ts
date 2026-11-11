import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import {
  createRestaurantOrder,
  getRestaurantOrders,
} from "@/lib/restaurant/orders";
import { RestaurantOrderType, RestaurantOrderStatus, PrepStation } from "@prisma/client";
import { z } from "zod";

const createOrderSchema = z.object({
  type: z.nativeEnum(RestaurantOrderType).default(RestaurantOrderType.DINE_IN),
  tableId: z.string().uuid().optional(),
  reservationId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      itemId: z.string().uuid("Invalid item ID"),
      quantity: z.number().int().positive("Quantity must be a positive integer"),
      modifiers: z.array(
        z.object({
          optionId: z.string().uuid(),
        })
      ).optional(),
      notes: z.string().optional(),
    })
  ).min(1, "Order must have at least one item"),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as RestaurantOrderStatus | null;
    const type = searchParams.get("type") as RestaurantOrderType | null;
    const tableId = searchParams.get("tableId") || undefined;
    const station = searchParams.get("station") as PrepStation | null;
    const search = searchParams.get("search") || undefined;

    const orders = await getRestaurantOrders({
      status: status || undefined,
      type: type || undefined,
      tableId,
      station: station || undefined,
      search,
    });

    return successResponse({ orders });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const body = await req.json();
    const parsed = createOrderSchema.parse(body);

    const order = await createRestaurantOrder({
      ...parsed,
      user: session,
    });

    return successResponse({ order }, "Restaurant order created successfully", 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
