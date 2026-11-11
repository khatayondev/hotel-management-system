import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qrToken = searchParams.get("qrToken");

    if (!qrToken) {
      return errorResponse("Missing qrToken query parameter", "BAD_REQUEST", 400);
    }

    const table = await prisma.restaurantTable.findUnique({
      where: { qrToken },
      select: {
        id: true,
        label: true,
        capacity: true,
        isActive: true,
        qrToken: true,
      },
    });

    if (!table || !table.isActive) {
      return errorResponse("Dining table not found or currently inactive", "TABLE_NOT_FOUND", 404);
    }

    return successResponse({ table });
  } catch (err) {
    return handleRouteError(err);
  }
}

