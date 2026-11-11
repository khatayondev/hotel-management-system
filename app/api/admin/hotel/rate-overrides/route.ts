import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { ROLES } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { parseDateOnly } from "@/lib/hotel/date-utils";
import { z } from "zod";

const createRateOverrideSchema = z.object({
  roomTypeId: z.string().uuid("Invalid roomTypeId"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  pricePesewas: z.coerce.number().int().min(1, "Price must be at least 1 pesewa"),
  minNights: z.coerce.number().int().min(1).optional(),
  label: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const { searchParams } = new URL(req.url);
    const roomTypeId = searchParams.get("roomTypeId");

    const overrides = await prisma.rateOverride.findMany({
      where: {
        ...(roomTypeId ? { roomTypeId } : {}),
      },
      include: { roomType: true },
      orderBy: [{ startDate: "asc" }],
    });

    return successResponse(overrides);
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
    const parsed = createRateOverrideSchema.parse(body);

    const startDate = parseDateOnly(parsed.startDate);
    const endDate = parseDateOnly(parsed.endDate);

    if (endDate.getTime() < startDate.getTime()) {
      return errorResponse("End date cannot be before start date", "BAD_REQUEST", 400);
    }

    const override = await prisma.rateOverride.create({
      data: {
        roomTypeId: parsed.roomTypeId,
        startDate,
        endDate,
        pricePesewas: parsed.pricePesewas,
        minNights: parsed.minNights || null,
        label: parsed.label || null,
      },
      include: { roomType: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "RATE_OVERRIDE_CREATE",
        entityType: "RATE_OVERRIDE",
        entityId: override.id,
        newValues: override as any,
      },
    });

    return successResponse(override, "Rate override created successfully", 201);
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

    const existing = await prisma.rateOverride.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse("Rate override not found", "NOT_FOUND", 404);
    }

    await prisma.rateOverride.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "RATE_OVERRIDE_DELETE",
        entityType: "RATE_OVERRIDE",
        entityId: id,
        oldValues: existing as any,
      },
    });

    return successResponse(null, "Rate override deleted successfully");
  } catch (err) {
    return handleRouteError(err);
  }
}

