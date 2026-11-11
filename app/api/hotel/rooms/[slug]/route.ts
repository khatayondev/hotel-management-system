import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { RoomStatus } from "@prisma/client";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params;

    const rt = await prisma.roomType.findUnique({
      where: { slug },
      include: {
        rooms: {
          where: { status: { not: RoomStatus.OUT_OF_ORDER } },
          select: { id: true, number: true, floor: true, status: true },
        },
        rateOverrides: {
          where: {
            endDate: { gte: new Date() },
          },
          orderBy: { startDate: "asc" },
        },
      },
    });

    if (!rt || !rt.isActive) {
      return errorResponse("Room type not found", "ROOM_NOT_FOUND", 404);
    }

    return successResponse({
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
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
