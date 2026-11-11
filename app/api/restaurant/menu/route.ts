import { prisma } from "@/lib/db";
import { getSettings, isRestaurantOpen } from "@/lib/settings";
import { successResponse, handleRouteError } from "@/lib/api-response";

export async function GET() {
  try {
    const settings = await getSettings();
    const hoursStatus = isRestaurantOpen(settings);

    const categories = await prisma.menuCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            modifierGroups: {
              orderBy: { sortOrder: "asc" },
              include: {
                options: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    });

    return successResponse({
      categories,
      restaurantHours: hoursStatus,
      hotelName: settings.hotelName,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
