import { prisma } from "../db";
import { AppError } from "../api-response";
import {
  RestaurantOrderType,
  RestaurantOrderStatus,
  RestaurantPaymentStatus,
  PrepStation,
  Prisma,
} from "@prisma/client";
import { generateNextReceiptNumber } from "../pos/receipt-counter";
import { formatPesewas } from "../money";
import { ROLES, type PermissionContextUser } from "../rbac";
import { getSettings, isRestaurantOpen } from "../settings";
import { sendSms } from "../sms";
import { logger } from "../logger";

// -------------------------------------------------------------
// State Machine Transitions
// -------------------------------------------------------------

/**
 * Valid transitions for restaurant orders:
 * PLACED    -> ACCEPTED | CANCELLED
 * ACCEPTED  -> PREPARING | CANCELLED
 * PREPARING -> READY | CANCELLED (requires MANAGER or OWNER_ADMIN)
 * READY     -> SERVED | CANCELLED (requires MANAGER or OWNER_ADMIN)
 * SERVED    -> COMPLETED | CANCELLED (requires MANAGER or OWNER_ADMIN)
 * COMPLETED -> (terminal)
 * CANCELLED -> (terminal)
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<
  RestaurantOrderStatus,
  RestaurantOrderStatus[]
> = {
  [RestaurantOrderStatus.PLACED]: [
    RestaurantOrderStatus.ACCEPTED,
    RestaurantOrderStatus.CANCELLED,
  ],
  [RestaurantOrderStatus.ACCEPTED]: [
    RestaurantOrderStatus.PREPARING,
    RestaurantOrderStatus.CANCELLED,
  ],
  [RestaurantOrderStatus.PREPARING]: [
    RestaurantOrderStatus.READY,
    RestaurantOrderStatus.CANCELLED,
  ],
  [RestaurantOrderStatus.READY]: [
    RestaurantOrderStatus.SERVED,
    RestaurantOrderStatus.CANCELLED,
  ],
  [RestaurantOrderStatus.SERVED]: [
    RestaurantOrderStatus.COMPLETED,
    RestaurantOrderStatus.CANCELLED,
  ],
  [RestaurantOrderStatus.COMPLETED]: [],
  [RestaurantOrderStatus.CANCELLED]: [],
};

export const STATUS_TIMESTAMP_FIELD_MAP: Record<
  Exclude<RestaurantOrderStatus, "PLACED">,
  keyof Prisma.RestaurantOrderUpdateInput
> = {
  [RestaurantOrderStatus.ACCEPTED]: "acceptedAt",
  [RestaurantOrderStatus.PREPARING]: "preparingAt",
  [RestaurantOrderStatus.READY]: "readyAt",
  [RestaurantOrderStatus.SERVED]: "servedAt",
  [RestaurantOrderStatus.COMPLETED]: "completedAt",
  [RestaurantOrderStatus.CANCELLED]: "cancelledAt",
};

// -------------------------------------------------------------
// Input Types
// -------------------------------------------------------------

export interface SelectedModifierInput {
  optionId: string;
}

export interface CreateOrderItemInput {
  itemId: string;
  quantity: number;
  modifiers?: Array<SelectedModifierInput | string>;
  selectedModifierOptionIds?: string[];
  notes?: string;
}

export interface CreateRestaurantOrderInput {
  type: RestaurantOrderType;
  tableId?: string;
  reservationId?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  items: CreateOrderItemInput[];
  user?: PermissionContextUser;
  paymentStatus?: RestaurantPaymentStatus;
  paystackReference?: string;
  skipOpeningHoursCheck?: boolean;
  now?: Date;
}

export interface UpdateOrderStatusInput {
  orderId: string;
  newStatus: RestaurantOrderStatus;
  user: PermissionContextUser;
}

export interface CancelOrderInput {
  orderId: string;
  reason: string;
  user: PermissionContextUser;
}

// -------------------------------------------------------------
// 1. Create Restaurant Order (Server-Side Pricing & Availability)
// -------------------------------------------------------------

/**
 * Creates a restaurant order with strictly server-computed pricing.
 * Validates:
 * - Each item is currently available (`isAvailable === true`)
 * - Quantities are positive integers
 * - Modifier options are available and satisfy group rules (min/maxSelect)
 * - Server recomputes all unit prices, modifier deltas, and totals
 * - Daily sequential order number via atomic ReceiptCounter (RO-YYYYMMDD-000001)
 * - Writes to AuditLog
 */
export async function createRestaurantOrder(
  input: CreateRestaurantOrderInput,
  fallbackUser?: PermissionContextUser
) {
  const user = input.user || fallbackUser;
  if (!user) {
    throw new AppError("Authentication required to create restaurant order", 401, "UNAUTHORIZED");
  }

  const { type, tableId, reservationId, customerName, customerPhone, notes, items } = input;

  // 0. Verify restaurant opening hours
  // Opening hours are enforced on public guest orders, or when a specific timestamp (input.now) is provided/tested.
  // Internal staff on duty (WAITER, FRONT_DESK, MANAGER, OWNER_ADMIN) can place POS/service orders anytime unless explicitly testing hours.
  const isGuestOrPublic = !user.role || (user.role as string) === "GUEST";
  const shouldCheckHours = !input.skipOpeningHoursCheck && (Boolean(input.now) || isGuestOrPublic);

  if (shouldCheckHours) {
    const settings = await getSettings();
    const { isOpen, openTime, closeTime } = isRestaurantOpen(settings, input.now || new Date());
    if (!isOpen) {
      throw new AppError(
        `The restaurant is currently closed. Opening hours are ${openTime} to ${closeTime}.`,
        400,
        "RESTAURANT_CLOSED"
      );
    }
  }

  if (!items || items.length === 0) {
    throw new AppError("Order must contain at least one item", 400, "EMPTY_ORDER");
  }

  // 1. Validate Table if DINE_IN
  if (type === RestaurantOrderType.DINE_IN && tableId) {
    const table = await prisma.restaurantTable.findUnique({
      where: { id: tableId },
    });
    if (!table || !table.isActive) {
      throw new AppError("Selected table is invalid or inactive", 400, "INVALID_TABLE");
    }
  }

  // 2. Fetch all menu items referenced in the order with modifier groups and options
  const itemIds = items.map((i) => i.itemId);
  const dbItems = await prisma.menuItem.findMany({
    where: { id: { in: itemIds } },
    include: {
      modifierGroups: {
        include: {
          options: true,
        },
      },
    },
  });

  const dbItemMap = new Map(dbItems.map((item) => [item.id, item]));

  // 3. Process each item, validate availability and recompute prices server-side
  let subtotalPesewas = 0;
  const processedOrderItems: Array<{
    itemId: string;
    quantity: number;
    unitPriceSnapshot: number;
    selectedModifiersSnapshot: Array<{
      optionId: string;
      optionName: string;
      priceDeltaPesewas: number;
    }>;
    totalPricePesewas: number;
    notes?: string;
    station: PrepStation;
  }> = [];

  for (const itemInput of items) {
    const dbItem = dbItemMap.get(itemInput.itemId);
    if (!dbItem) {
      throw new AppError(`Menu item ${itemInput.itemId} does not exist`, 404, "ITEM_NOT_FOUND");
    }

    if (!dbItem.isAvailable) {
      throw new AppError(
        `Menu item "${dbItem.name}" is currently unavailable and cannot be ordered`,
        400,
        "ITEM_UNAVAILABLE"
      );
    }

    if (!Number.isInteger(itemInput.quantity) || itemInput.quantity <= 0) {
      throw new AppError("Item quantity must be a positive integer", 400, "INVALID_QUANTITY");
    }

    // Process Modifiers
    let modifierTotalDeltaPesewas = 0;
    const selectedModifiersSnapshot: Array<{
      optionId: string;
      optionName: string;
      priceDeltaPesewas: number;
    }> = [];

    const rawModifiers = itemInput.selectedModifierOptionIds || itemInput.modifiers || [];
    const requestedOptionIds = new Set(
      rawModifiers.map((m) => (typeof m === "string" ? m : m.optionId))
    );

    for (const group of dbItem.modifierGroups) {
      const selectedInGroup = group.options.filter((opt) => requestedOptionIds.has(opt.id));

      if (group.isRequired && selectedInGroup.length < group.minSelect) {
        throw new AppError(
          `Modifier group "${group.name}" requires at least ${group.minSelect} selection(s)`,
          400,
          "MODIFIER_REQUIRED"
        );
      }

      if (selectedInGroup.length > group.maxSelect) {
        throw new AppError(
          `Modifier group "${group.name}" allows at most ${group.maxSelect} selection(s)`,
          400,
          "MODIFIER_MAX_EXCEEDED"
        );
      }

      for (const opt of selectedInGroup) {
        if (!opt.isAvailable) {
          throw new AppError(
            `Modifier option "${opt.name}" is currently unavailable`,
            400,
            "MODIFIER_UNAVAILABLE"
          );
        }

        modifierTotalDeltaPesewas += opt.priceDeltaPesewas;
        selectedModifiersSnapshot.push({
          optionId: opt.id,
          optionName: opt.name,
          priceDeltaPesewas: opt.priceDeltaPesewas,
        });
      }
    }

    // Server computed pricing
    const unitPrice = dbItem.pricePesewas;
    const itemTotal = (unitPrice + modifierTotalDeltaPesewas) * itemInput.quantity;
    subtotalPesewas += itemTotal;

    processedOrderItems.push({
      itemId: dbItem.id,
      quantity: itemInput.quantity,
      unitPriceSnapshot: unitPrice,
      selectedModifiersSnapshot,
      totalPricePesewas: itemTotal,
      notes: itemInput.notes?.trim() || undefined,
      station: dbItem.prepStation,
    });
  }

  const discountPesewas = 0;
  const taxPesewas = 0;
  const totalPesewas = subtotalPesewas - discountPesewas + taxPesewas;

  // 4. Generate daily sequential order number (RO-YYYYMMDD-000001) in transaction
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ""); // "20261111"
  const prefix = `RO-${dateStr}`;

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await generateNextReceiptNumber(tx, prefix);

    let initialPaymentStatus = input.paymentStatus || RestaurantPaymentStatus.PENDING;
    if (type === RestaurantOrderType.ROOM_SERVICE) {
      initialPaymentStatus = RestaurantPaymentStatus.CHARGED_TO_ROOM;
    }

    const created = await tx.restaurantOrder.create({
      data: {
        orderNumber,
        paystackReference: input.paystackReference || null,
        type,
        status: RestaurantOrderStatus.PLACED,
        tableId: tableId || null,
        reservationId: reservationId || null,
        customerName: customerName?.trim() || null,
        customerPhone: customerPhone?.trim() || null,
        notes: notes?.trim() || null,
        subtotalPesewas,
        discountPesewas,
        taxPesewas,
        totalPesewas,
        paymentStatus: initialPaymentStatus,
        items: {
          create: processedOrderItems.map((poi) => ({
            itemId: poi.itemId,
            quantity: poi.quantity,
            unitPriceSnapshot: poi.unitPriceSnapshot,
            selectedModifiersSnapshot: poi.selectedModifiersSnapshot as unknown as Prisma.InputJsonValue,
            totalPricePesewas: poi.totalPricePesewas,
            notes: poi.notes || null,
            station: poi.station,
          })),
        },
      },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        table: true,
      },
    });

    // If ROOM_SERVICE, post folio charge to the guest's folio
    if (type === RestaurantOrderType.ROOM_SERVICE && reservationId) {
      let folio = await tx.folio.findFirst({
        where: { reservationId, status: "OPEN" },
      });

      if (!folio) {
        const res = await tx.reservation.findUnique({
          where: { id: reservationId },
          select: { reference: true },
        });
        const folioNumber = `FOL-${res?.reference || Date.now()}`;
        folio = await tx.folio.create({
          data: { reservationId, folioNumber, status: "OPEN" },
        });
      }

      await tx.folioCharge.create({
        data: {
          folioId: folio.id,
          description: `Room Service: ${orderNumber}${customerName ? ` (${customerName})` : ""}`,
          amountPesewas: totalPesewas,
          source: "RESTAURANT",
          createdByUserId: user.userId && user.userId !== "guest" ? user.userId : null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.userId && user.userId !== "guest" ? user.userId : null,
          action: "FOLIO_CHARGE_POSTED",
          entityType: "Folio",
          entityId: folio.id,
          newValues: {
            orderNumber,
            amountPesewas: totalPesewas,
            source: "RESTAURANT",
          },
        },
      });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "RESTAURANT_ORDER_CREATED",
        entityType: "RestaurantOrder",
        entityId: created.id,
        newValues: {
          orderNumber,
          type,
          status: created.status,
          itemCount: created.items.length,
          subtotalPesewas,
          totalPesewas,
          totalGhs: formatPesewas(totalPesewas),
          tableLabel: created.table?.label,
        },
      },
    });

    return created;
  });

  return order;
}

// -------------------------------------------------------------
// 2. State Machine Transitions (updateOrderStatus)
// -------------------------------------------------------------

/**
 * Validates and executes state machine transition on a restaurant order.
 * Timestamped and audit-logged.
 */
export async function updateOrderStatus(
  inputOrOrderId: UpdateOrderStatusInput | string,
  maybeNewStatus?: RestaurantOrderStatus,
  maybeUser?: PermissionContextUser
) {
  let orderId: string;
  let newStatus: RestaurantOrderStatus;
  let user: PermissionContextUser;

  if (typeof inputOrOrderId === "string") {
    orderId = inputOrOrderId;
    newStatus = maybeNewStatus!;
    user = maybeUser!;
  } else {
    orderId = inputOrOrderId.orderId;
    newStatus = inputOrOrderId.newStatus;
    user = inputOrOrderId.user;
  }

  const order = await prisma.restaurantOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  // If already at target status, return
  if (order.status === newStatus) {
    return order;
  }

  // Validate allowed transitions
  const allowedNext = ALLOWED_STATUS_TRANSITIONS[order.status];
  if (!allowedNext || !allowedNext.includes(newStatus)) {
    throw new AppError(
      `Illegal order status transition from ${order.status} to ${newStatus}`,
      400,
      "ILLEGAL_STATUS_TRANSITION"
    );
  }

  // If transitioning to CANCELLED, use cancelOrder instead
  if (newStatus === RestaurantOrderStatus.CANCELLED) {
    throw new AppError(
      "To cancel an order, use the cancelOrder endpoint with a mandatory reason",
      400,
      "USE_CANCEL_ENDPOINT"
    );
  }

  const timestampField =
    newStatus !== RestaurantOrderStatus.PLACED
      ? STATUS_TIMESTAMP_FIELD_MAP[newStatus as Exclude<RestaurantOrderStatus, "PLACED">]
      : undefined;
  const now = new Date();

  const updateData: Prisma.RestaurantOrderUpdateInput = {
    status: newStatus,
  };
  if (timestampField) {
    (updateData as Record<string, unknown>)[timestampField as string] = now;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.restaurantOrder.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: { include: { item: true } },
        table: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "RESTAURANT_ORDER_STATUS_UPDATED",
        entityType: "RestaurantOrder",
        entityId: orderId,
        newValues: {
          orderNumber: res.orderNumber,
          previousStatus: order.status,
          newStatus,
          timestampField,
          updatedAt: now.toISOString(),
        },
      },
    });

    return res;
  });

  // Send SMS notification when order is READY
  if (newStatus === RestaurantOrderStatus.READY && updated.customerPhone) {
    try {
      const msg =
        updated.type === RestaurantOrderType.ROOM_SERVICE
          ? `Aura Royal Hotel: Your room service order (${updated.orderNumber}) is READY and on its way to your room!`
          : `Aura Royal Hotel: Your order (${updated.orderNumber}) is READY for pickup! Please collect it at the counter.`;

      await sendSms({
        recipient: updated.customerPhone,
        message: msg,
        senderId: "AuraHotel",
      });
    } catch (err) {
      logger.warn(`Failed to dispatch READY SMS for order ${updated.orderNumber}: ${err}`);
    }
  }

  return updated;
}

// -------------------------------------------------------------
// 3. Cancel Order (Role Gating for In-Progress Orders)
// -------------------------------------------------------------

/**
 * Cancels a restaurant order.
 * Business Rule:
 * - Cancellation after PREPARING (i.e. PREPARING, READY, SERVED) requires MANAGER or OWNER_ADMIN.
 * - Cancellation before PREPARING (PLACED, ACCEPTED) can be done by WAITER, FRONT_DESK, etc.
 * - Reason is strictly required.
 */
export async function cancelRestaurantOrder(
  inputOrOrderId: CancelOrderInput | string,
  maybeReason?: string,
  maybeUser?: PermissionContextUser
) {
  let orderId: string;
  let reason: string;
  let user: PermissionContextUser;

  if (typeof inputOrOrderId === "string") {
    orderId = inputOrOrderId;
    reason = maybeReason || "";
    user = maybeUser!;
  } else {
    orderId = inputOrOrderId.orderId;
    reason = inputOrOrderId.reason;
    user = inputOrOrderId.user;
  }

  const trimmedReason = reason?.trim();
  if (!trimmedReason) {
    throw new AppError("Reason is strictly required to cancel an order", 400, "REASON_REQUIRED");
  }

  const order = await prisma.restaurantOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  if (order.status === RestaurantOrderStatus.CANCELLED) {
    throw new AppError("Order is already cancelled", 400, "ALREADY_CANCELLED");
  }

  if (order.status === RestaurantOrderStatus.COMPLETED) {
    throw new AppError(
      "Completed orders cannot be cancelled (illegal transition)",
      400,
      "ILLEGAL_STATUS_TRANSITION"
    );
  }

  // Check role ceiling for in-progress or completed orders
  const postPreparingStatuses: RestaurantOrderStatus[] = [
    RestaurantOrderStatus.PREPARING,
    RestaurantOrderStatus.READY,
    RestaurantOrderStatus.SERVED,
  ];

  if (postPreparingStatuses.includes(order.status)) {
    const isManagerOrAbove =
      user.role === ROLES.MANAGER || user.role === ROLES.OWNER_ADMIN;

    if (!isManagerOrAbove) {
      throw new AppError(
        "Only MANAGER or OWNER_ADMIN can cancel an order that has started preparation",
        403,
        "CANCELLATION_FORBIDDEN"
      );
    }
  }

  const now = new Date();

  const cancelled = await prisma.$transaction(async (tx) => {
    const res = await tx.restaurantOrder.update({
      where: { id: orderId },
      data: {
        status: RestaurantOrderStatus.CANCELLED,
        cancelledAt: now,
        cancelReason: trimmedReason,
        cancelledByUserId: user.userId,
      },
      include: {
        items: { include: { item: true } },
        table: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "RESTAURANT_ORDER_CANCELLED",
        entityType: "RestaurantOrder",
        entityId: orderId,
        newValues: {
          orderNumber: res.orderNumber,
          previousStatus: order.status,
          cancelReason: trimmedReason,
          cancelledByRole: user.role,
        },
      },
    });

    return res;
  });

  return cancelled;
}

// -------------------------------------------------------------
// 4. Query Helpers
// -------------------------------------------------------------

export async function getRestaurantOrders(filters?: {
  status?: RestaurantOrderStatus;
  type?: RestaurantOrderType;
  tableId?: string;
  station?: PrepStation;
  search?: string;
  isKitchenView?: boolean;
}) {
  const where: Prisma.RestaurantOrderWhereInput = {
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.type ? { type: filters.type } : {}),
    ...(filters?.tableId ? { tableId: filters.tableId } : {}),
    ...(filters?.station
      ? {
          items: {
            some: { station: filters.station },
          },
        }
      : {}),
    ...(filters?.search
      ? {
          OR: [
            { orderNumber: { contains: filters.search, mode: "insensitive" } },
            { customerName: { contains: filters.search, mode: "insensitive" } },
            { table: { label: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  // Payment-before-kitchen rule:
  // For kitchen/bar views, pickup orders that have NOT yet been paid do not appear on station queues
  if (filters?.station || filters?.isKitchenView) {
    where.NOT = {
      type: RestaurantOrderType.PICKUP,
      paymentStatus: { not: RestaurantPaymentStatus.PAID },
    };
  }

  return prisma.restaurantOrder.findMany({
    where,
    include: {
      items: {
        include: {
          item: true,
        },
      },
      table: true,
      reservation: {
        select: {
          reference: true,
          rooms: { select: { room: { select: { number: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRestaurantOrderById(orderId: string) {
  return prisma.restaurantOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          item: true,
        },
      },
      table: true,
      reservation: {
        include: {
          rooms: { include: { room: true } },
          guest: true,
        },
      },
      cancelledByUser: {
        select: { name: true, email: true },
      },
    },
  });
}

export async function getOrderByTrackingToken(token: string) {
  const order = await prisma.restaurantOrder.findFirst({
    where: {
      OR: [
        { trackingToken: token },
        { id: token },
        { orderNumber: token },
      ],
    },
    include: {
      items: {
        include: {
          item: true,
        },
      },
      table: true,
      reservation: {
        include: {
          rooms: { include: { room: true } },
          guest: true,
        },
      },
    },
  });

  return order;
}
