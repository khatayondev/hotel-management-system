import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, handleRouteError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const extras = await prisma.roomExtra.findMany({
      where: { isActive: true },
      orderBy: { pricePesewas: "asc" },
    });
    return successResponse(extras);
  } catch (err) {
    return handleRouteError(err);
  }
}

