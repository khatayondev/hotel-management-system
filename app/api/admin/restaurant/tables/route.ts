import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS, ROLES } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import crypto from "crypto";
import { z } from "zod";

const createTableSchema = z.object({
  label: z.string().min(1, "Label is required (e.g. Table 1, Patio 4)"),
  capacity: z.number().int().min(1).default(4),
  qrToken: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const updateTableSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).optional(),
  capacity: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  regenerateQr: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const tables = await prisma.restaurantTable.findMany({
      include: {
        _count: {
          select: {
            orders: {
              where: {
                status: {
                  in: ["PLACED", "ACCEPTED", "PREPARING", "READY", "SERVED"],
                },
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });

    return successResponse({ tables });
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
    const isManagerOrAbove = session.role === ROLES.MANAGER || session.role === ROLES.OWNER_ADMIN;
    if (!isManagerOrAbove) {
      requirePermission(session, PERMISSION_KEYS.SERVICES_MANAGE);
    }

    const body = await req.json();
    const parsed = createTableSchema.parse(body);

    const qrToken = parsed.qrToken || crypto.randomBytes(16).toString("hex");

    const table = await prisma.restaurantTable.create({
      data: {
        ...parsed,
        qrToken,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "RESTAURANT_TABLE_CREATED",
        entityType: "RestaurantTable",
        entityId: table.id,
        newValues: { label: table.label, capacity: table.capacity, qrToken },
      },
    });

    return successResponse({ table }, "Restaurant table created", 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    const isManagerOrAbove = session.role === ROLES.MANAGER || session.role === ROLES.OWNER_ADMIN;
    if (!isManagerOrAbove) {
      requirePermission(session, PERMISSION_KEYS.SERVICES_MANAGE);
    }

    const body = await req.json();
    const parsed = updateTableSchema.parse(body);
    const { id, regenerateQr, ...data } = parsed;

    const updatePayload: Record<string, unknown> = { ...data };
    if (regenerateQr) {
      updatePayload.qrToken = crypto.randomBytes(16).toString("hex");
    }

    const table = await prisma.restaurantTable.update({
      where: { id },
      data: updatePayload,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "RESTAURANT_TABLE_UPDATED",
        entityType: "RestaurantTable",
        entityId: table.id,
        newValues: updatePayload as Prisma.InputJsonValue,
      },
    });

    return successResponse({ table }, "Restaurant table updated");
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    const isManagerOrAbove = session.role === ROLES.MANAGER || session.role === ROLES.OWNER_ADMIN;
    if (!isManagerOrAbove) {
      requirePermission(session, PERMISSION_KEYS.SERVICES_MANAGE);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return errorResponse("Table ID is required", "BAD_REQUEST", 400);
    }

    await prisma.restaurantTable.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "RESTAURANT_TABLE_DELETED",
        entityType: "RestaurantTable",
        entityId: id,
      },
    });

    return successResponse({ success: true }, "Table deleted");
  } catch (err) {
    return handleRouteError(err);
  }
}
