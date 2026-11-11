import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { z } from "zod";

const updateReservationSchema = z.object({
  notes: z.string().optional(),
  roomId: z.string().uuid().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    requirePermission(session, PERMISSION_KEYS.RESERVATIONS_VIEW);

    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        guest: true,
        rooms: {
          include: {
            roomType: true,
            room: true,
          },
        },
        extras: {
          include: { extra: true },
        },
        folios: {
          include: { charges: true },
        },
      },
    });

    if (!reservation) {
      return errorResponse("Reservation not found", "NOT_FOUND", 404);
    }

    // Compute folio charges and balance
    let totalChargesPesewas = 0;
    let totalPaymentsPesewas = 0;

    const folio = reservation.folios[0];
    if (folio?.charges) {
      for (const charge of folio.charges) {
        if (charge.source === "PAYMENT") {
          totalPaymentsPesewas += charge.amountPesewas;
        } else {
          totalChargesPesewas += charge.amountPesewas;
        }
      }
    } else {
      totalChargesPesewas = reservation.totalPesewas;
      totalPaymentsPesewas = reservation.amountPaidPesewas;
    }

    const outstandingBalancePesewas = Math.max(0, totalChargesPesewas - totalPaymentsPesewas);

    return successResponse({
      reservation,
      financials: {
        totalChargesPesewas,
        totalPaymentsPesewas,
        outstandingBalancePesewas,
        isSettled: outstandingBalancePesewas === 0,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    requirePermission(session, PERMISSION_KEYS.RESERVATIONS_MANAGE);

    const { id } = await params;
    const body = await req.json();
    const parsed = updateReservationSchema.parse(body);

    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: { rooms: true },
    });
    if (!existing) {
      return errorResponse("Reservation not found", "NOT_FOUND", 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.reservation.update({
        where: { id },
        data: {
          ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
        },
      });

      if (parsed.roomId && existing.rooms.length > 0) {
        await tx.reservationRoom.update({
          where: { id: existing.rooms[0].id },
          data: { roomId: parsed.roomId },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "RESERVATION_UPDATE",
          entityType: "RESERVATION",
          entityId: id,
          oldValues: existing as any,
          newValues: { ...res, assignedRoomId: parsed.roomId } as any,
        },
      });

      return res;
    });

    return successResponse(updated, "Reservation updated successfully");
  } catch (err) {
    return handleRouteError(err);
  }
}

