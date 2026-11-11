import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS, ROLES } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z.string().min(2, "Slug must be at least 2 characters").regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const updateCategorySchema = createCategorySchema.partial().extend({
  id: z.string().uuid(),
});

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const categories = await prisma.menuCategory.findMany({
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return successResponse({ categories });
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
    // Only Manager or Owner can manage menu
    const isManagerOrAbove = session.role === ROLES.MANAGER || session.role === ROLES.OWNER_ADMIN;
    if (!isManagerOrAbove) {
      requirePermission(session, PERMISSION_KEYS.SERVICES_MANAGE);
    }

    const body = await req.json();
    const parsed = createCategorySchema.parse(body);

    const category = await prisma.menuCategory.create({
      data: parsed,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "MENU_CATEGORY_CREATED",
        entityType: "MenuCategory",
        entityId: category.id,
        newValues: parsed,
      },
    });

    return successResponse({ category }, "Menu category created", 201);
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
    const isManagerOrAbove = session.role === ROLES.MANAGER || session.role === ROLES.OWNER_ADMIN;
    if (!isManagerOrAbove) {
      requirePermission(session, PERMISSION_KEYS.SERVICES_MANAGE);
    }

    const body = await req.json();
    const parsed = updateCategorySchema.parse(body);
    const { id, ...data } = parsed;

    const category = await prisma.menuCategory.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "MENU_CATEGORY_UPDATED",
        entityType: "MenuCategory",
        entityId: category.id,
        newValues: data,
      },
    });

    return successResponse({ category }, "Menu category updated");
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
    const isManagerOrAbove = session.role === ROLES.MANAGER || session.role === ROLES.OWNER_ADMIN;
    if (!isManagerOrAbove) {
      requirePermission(session, PERMISSION_KEYS.SERVICES_MANAGE);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return errorResponse("Category ID is required", "BAD_REQUEST", 400);
    }

    await prisma.menuCategory.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "MENU_CATEGORY_DELETED",
        entityType: "MenuCategory",
        entityId: id,
      },
    });

    return successResponse({ success: true }, "Menu category deleted");
  } catch (err) {
    return handleRouteError(err);
  }
}

