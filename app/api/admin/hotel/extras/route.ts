import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { ROLES } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { RoomExtraPricing } from "@prisma/client";
import { z } from "zod";

const createExtraSchema = z.object({
  name: z.string().min(2, "Extra name is required"),
  pricePesewas: z.coerce.number().int().min(0, "Price must be non-negative"),
  pricing: z.nativeEnum(RoomExtraPricing).default(RoomExtraPricing.PER_STAY),
  isActive: z.boolean().default(true),
});

const updateExtraSchema = createExtraSchema.partial();

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const extras = await prisma.roomExtra.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return successResponse(extras);
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
    if (session.role !== ROLES.OWNER_ADMIN && session.role !== ROLES.MANAGER) {
      return errorResponse("Manager or Owner permission required", "FORBIDDEN", 403);
    }

    const body = await req.json();
    const parsed = createExtraSchema.parse(body);

    const extra = await prisma.roomExtra.create({
      data: parsed,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ROOM_EXTRA_CREATE",
        entityType: "ROOM_EXTRA",
        entityId: extra.id,
        newValues: extra as any,
      },
    });

    return successResponse(extra, "Room extra created successfully", 201);
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
    if (session.role !== ROLES.OWNER_ADMIN && session.role !== ROLES.MANAGER) {
      return errorResponse("Manager or Owner permission required", "FORBIDDEN", 403);
    }

    const body = await req.json();
    const { id, data } = body;
    if (!id) {
      return errorResponse("ID is required", "BAD_REQUEST", 400);
    }

    const parsed = updateExtraSchema.parse(data);
    const existing = await prisma.roomExtra.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse("Room extra not found", "NOT_FOUND", 404);
    }

    const updated = await prisma.roomExtra.update({
      where: { id },
      data: parsed,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ROOM_EXTRA_UPDATE",
        entityType: "ROOM_EXTRA",
        entityId: id,
        oldValues: existing as any,
        newValues: updated as any,
      },
    });

    return successResponse(updated, "Room extra updated successfully");
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
    if (session.role !== ROLES.OWNER_ADMIN && session.role !== ROLES.MANAGER) {
      return errorResponse("Manager or Owner permission required", "FORBIDDEN", 403);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return errorResponse("ID is required", "BAD_REQUEST", 400);
    }

    const existing = await prisma.roomExtra.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse("Room extra not found", "NOT_FOUND", 404);
    }

    // Toggle active or delete
    const updated = await prisma.roomExtra.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ROOM_EXTRA_DEACTIVATE",
        entityType: "ROOM_EXTRA",
        entityId: id,
        oldValues: existing as any,
      },
    });

    return successResponse(updated, "Room extra deactivated successfully");
  } catch (err) {
    return handleRouteError(err);
  }
}
