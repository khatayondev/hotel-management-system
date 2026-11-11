import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, handleRouteError } from "@/lib/api-response";
import { RoomStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const roomTypes = await prisma.roomType.findMany({
      where: { isActive: true },
      include: {
        rooms: {
          where: { status: { not: RoomStatus.OUT_OF_ORDER } },
          select: { id: true, status: true },
        },
        rateOverrides: {
          where: {
            endDate: { gte: new Date() },
          },
          orderBy: { startDate: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    const data = roomTypes.map((rt) => ({
      id: rt.id,
      name: rt.name,
      slug: rt.slug,
      description: rt.description,
      maxAdults: rt.maxAdults,
      maxChildren: rt.maxChildren,
      bedConfiguration: rt.bedConfiguration,
      basePricePesewas: rt.basePricePesewas,
      amenities: rt.amenities,
      imageUrls: rt.imageUrls,
      operationalRoomCount: rt.rooms.length,
      upcomingOverrides: rt.rateOverrides.map((ro) => ({
        id: ro.id,
        startDate: ro.startDate.toISOString().slice(0, 10),
        endDate: ro.endDate.toISOString().slice(0, 10),
        pricePesewas: ro.pricePesewas,
        label: ro.label,
        minNights: ro.minNights,
      })),
    }));

    return successResponse(data);
  } catch (err) {
    return handleRouteError(err);
  }
}

