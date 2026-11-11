import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS, ROLES } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { z } from "zod";
import { RoomStatus } from "@prisma/client";

const createRoomTypeSchema = z.object({
  name: z.string().min(2, "Room type name is required"),
  slug: z.string().min(2, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().optional().default(""),
  maxAdults: z.coerce.number().int().min(1).default(2),
  maxChildren: z.coerce.number().int().min(0).default(0),
  bedConfiguration: z.string().min(2, "Bed configuration required"),
  basePricePesewas: z.coerce.number().int().min(1, "Base price must be at least 1 pesewa"),
  amenities: z.array(z.string()).default([]),
  imageUrls: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

const updateRoomTypeSchema = createRoomTypeSchema.partial();

const createRoomSchema = z.object({
  number: z.string().min(1, "Room number is required"),
  floor: z.coerce.number().int().default(1),
  roomTypeId: z.string().uuid("Invalid roomTypeId"),
  status: z.nativeEnum(RoomStatus).default(RoomStatus.CLEAN),
  notes: z.string().optional(),
});

const updateRoomSchema = createRoomSchema.partial();

// GET /api/admin/hotel/rooms?entity=roomType|room
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    // Any front desk, manager or owner can view rooms
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity") || "all";

    if (entity === "roomTypes") {
      const roomTypes = await prisma.roomType.findMany({
        include: {
          rooms: true,
          rateOverrides: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return successResponse(roomTypes);
    }

    if (entity === "rooms") {
      const rooms = await prisma.room.findMany({
        include: { roomType: true },
        orderBy: [{ floor: "asc" }, { number: "asc" }],
      });
      return successResponse(rooms);
    }

    // Default: return both
    const [roomTypes, rooms] = await Promise.all([
      prisma.roomType.findMany({
        include: { rooms: true, rateOverrides: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.room.findMany({
        include: { roomType: true },
        orderBy: [{ floor: "asc" }, { number: "asc" }],
      }),
    ]);

    return successResponse({ roomTypes, rooms });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/admin/hotel/rooms
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    // Only Manager or Owner can create rooms and room types
    if (session.role !== ROLES.OWNER_ADMIN && session.role !== ROLES.MANAGER) {
      return errorResponse("Manager or Owner permission required to configure rooms", "FORBIDDEN", 403);
    }

    const body = await req.json();
    const type = body.entity || "room"; // 'roomType' or 'room'

    if (type === "roomType") {
      const parsed = createRoomTypeSchema.parse(body.data);
      const roomType = await prisma.roomType.create({
        data: parsed,
      });

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: "ROOM_TYPE_CREATE",
          entityType: "ROOM_TYPE",
          entityId: roomType.id,
          newValues: roomType as any,
        },
      });

      return successResponse(roomType, "Room type created successfully", 201);
    }

    // Create single room
    const parsed = createRoomSchema.parse(body.data || body);
    const existing = await prisma.room.findUnique({
      where: { number: parsed.number },
    });
    if (existing) {
      return errorResponse(`Room number ${parsed.number} already exists`, "CONFLICT", 409);
    }

    const room = await prisma.room.create({
      data: parsed,
      include: { roomType: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ROOM_CREATE",
        entityType: "ROOM",
        entityId: room.id,
        newValues: room as any,
      },
    });

    return successResponse(room, "Room created successfully", 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

// PATCH /api/admin/hotel/rooms
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
    const { entity, id, data } = body;

    if (!id) {
      return errorResponse("Record ID is required", "BAD_REQUEST", 400);
    }

    if (entity === "roomType") {
      const parsed = updateRoomTypeSchema.parse(data);
      const existing = await prisma.roomType.findUnique({ where: { id } });
      if (!existing) {
        return errorResponse("Room type not found", "NOT_FOUND", 404);
      }

      const updated = await prisma.roomType.update({
        where: { id },
        data: parsed,
      });

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: "ROOM_TYPE_UPDATE",
          entityType: "ROOM_TYPE",
          entityId: id,
          oldValues: existing as any,
          newValues: updated as any,
        },
      });

      return successResponse(updated, "Room type updated successfully");
    }

    // Update room
    const parsed = updateRoomSchema.parse(data);
    const existing = await prisma.room.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse("Room not found", "NOT_FOUND", 404);
    }

    const updated = await prisma.room.update({
      where: { id },
      data: parsed,
      include: { roomType: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ROOM_UPDATE",
        entityType: "ROOM",
        entityId: id,
        oldValues: existing as any,
        newValues: updated as any,
      },
    });

    return successResponse(updated, "Room updated successfully");
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/admin/hotel/rooms?entity=roomType|room&id=UUID
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
    const entity = searchParams.get("entity");
    const id = searchParams.get("id");

    if (!id) {
      return errorResponse("Record ID is required", "BAD_REQUEST", 400);
    }

    if (entity === "roomType") {
      const roomType = await prisma.roomType.findUnique({
        where: { id },
        include: { rooms: true },
      });
      if (!roomType) {
        return errorResponse("Room type not found", "NOT_FOUND", 404);
      }
      if (roomType.rooms.length > 0) {
        // Soft delete/deactivate if it has rooms
        const updated = await prisma.roomType.update({
          where: { id },
          data: { isActive: false },
        });
        return successResponse(updated, "Room type deactivated (has associated rooms)");
      }

      await prisma.roomType.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: "ROOM_TYPE_DELETE",
          entityType: "ROOM_TYPE",
          entityId: id,
          oldValues: roomType as any,
        },
      });
      return successResponse(null, "Room type deleted");
    }

    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) {
      return errorResponse("Room not found", "NOT_FOUND", 404);
    }

    // Check for active reservations assigned
    const activeRes = await prisma.reservationRoom.findFirst({
      where: {
        roomId: id,
        status: { in: [RoomStatus.OCCUPIED as any, "CHECKED_IN", "CONFIRMED"] },
      },
    });
    if (activeRes) {
      return errorResponse("Cannot delete a room with active or confirmed reservations. Set OUT_OF_ORDER instead.", "CONFLICT", 409);
    }

    await prisma.room.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ROOM_DELETE",
        entityType: "ROOM",
        entityId: id,
        oldValues: room as any,
      },
    });

    return successResponse(null, "Room deleted successfully");
  } catch (err) {
    return handleRouteError(err);
  }
}

