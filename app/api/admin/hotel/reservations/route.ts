import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS, ROLES } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { createFrontDeskReservation } from "@/lib/hotel/operations";
import { parseDateOnly } from "@/lib/hotel/date-utils";
import { ReservationStatus, ReservationSource, Prisma } from "@prisma/client";
import { z } from "zod";

const createWalkInSchema = z.object({
  roomTypeId: z.string().uuid("Invalid roomTypeId"),
  roomId: z.string().uuid("Invalid roomId").optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-in must be YYYY-MM-DD"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-out must be YYYY-MM-DD"),
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0),
  guest: z.object({
    name: z.string().min(2, "Guest name is required"),
    phone: z.string().min(7, "Phone number is required"),
    email: z.string().email().optional().or(z.literal("")),
    nationality: z.string().optional(),
    idType: z.string().optional(),
    idNumber: z.string().optional(),
    vehiclePlate: z.string().optional(),
  }),
  extras: z.array(z.object({ extraId: z.string(), quantity: z.number().int().min(1) })).optional().default([]),
  depositPesewas: z.coerce.number().int().min(0).optional().default(0),
  notes: z.string().optional(),
});

// GET /api/admin/hotel/reservations?status=...&dateFrom=...&dateTo=...&guest=...&source=...
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    requirePermission(session, PERMISSION_KEYS.RESERVATIONS_VIEW);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as ReservationStatus | null;
    const source = searchParams.get("source") as ReservationSource | null;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const guestQuery = searchParams.get("guest");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 25)));
    const skip = (page - 1) * limit;

    const where: Prisma.ReservationWhereInput = {};

    if (status && Object.values(ReservationStatus).includes(status)) {
      where.status = status;
    }

    if (source && Object.values(ReservationSource).includes(source)) {
      where.source = source;
    }

    if (dateFrom || dateTo) {
      where.AND = [
        ...(dateFrom ? [{ checkOutDate: { gte: parseDateOnly(dateFrom) } }] : []),
        ...(dateTo ? [{ checkInDate: { lte: parseDateOnly(dateTo) } }] : []),
      ];
    }

    if (guestQuery && guestQuery.trim().length > 0) {
      const q = guestQuery.trim();
      where.OR = [
        { reference: { contains: q, mode: "insensitive" } },
        { guest: { name: { contains: q, mode: "insensitive" } } },
        { guest: { phone: { contains: q } } },
        { guest: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, reservations] = await Promise.all([
      prisma.reservation.count({ where }),
      prisma.reservation.findMany({
        where,
        include: {
          guest: true,
          rooms: {
            include: {
              roomType: true,
              room: true,
            },
          },
          folios: {
            include: { charges: true },
          },
          extras: {
            include: { extra: true },
          },
        },
        orderBy: [{ checkInDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    return successResponse({
      reservations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/admin/hotel/reservations (Walk-in / Phone reservation creation by front desk)
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    requirePermission(session, PERMISSION_KEYS.RESERVATIONS_MANAGE);

    const body = await req.json();
    const parsed = createWalkInSchema.parse(body);

    const reservation = await createFrontDeskReservation({
      ...parsed,
      user: session,
    });

    return successResponse(reservation, "Front desk reservation created successfully", 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

