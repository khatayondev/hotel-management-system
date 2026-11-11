import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS, ROLES, UserRole } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { PrepStation } from "@prisma/client";
import { z } from "zod";

const createModifierOptionSchema = z.object({
  name: z.string().min(1),
  priceDeltaPesewas: z.number().int().default(0),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const createModifierGroupSchema = z.object({
  name: z.string().min(1),
  minSelect: z.number().int().default(0),
  maxSelect: z.number().int().default(1),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  options: z.array(createModifierOptionSchema).default([]),
});

const createMenuItemSchema = z.object({
  menuCategoryId: z.string().uuid(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  pricePesewas: z.number().int().positive("Price must be a positive integer in pesewas"),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isAvailable: z.boolean().default(true),
  prepStation: z.nativeEnum(PrepStation).default(PrepStation.KITCHEN),
  sortOrder: z.number().int().default(0),
  modifierGroups: z.array(createModifierGroupSchema).optional(),
});

const updateMenuItemSchema = z.object({
  id: z.string().uuid(),
  menuCategoryId: z.string().uuid().optional(),
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  pricePesewas: z.number().int().positive().optional(),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().optional(),
  prepStation: z.nativeEnum(PrepStation).optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const station = searchParams.get("station") as PrepStation | null;

    const items = await prisma.menuItem.findMany({
      where: {
        ...(categoryId ? { menuCategoryId: categoryId } : {}),
        ...(station ? { prepStation: station } : {}),
      },
      include: {
        category: true,
        modifierGroups: {
          include: {
            options: {
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return successResponse({ items });
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
    const isManagerOrAbove = session.role === ROLES.MANAGER || session.role === ROLES.OWNER_ADMIN;
    if (!isManagerOrAbove) {
      requirePermission(session, PERMISSION_KEYS.SERVICES_MANAGE);
    }

    const body = await req.json();
    const parsed = createMenuItemSchema.parse(body);

    const { modifierGroups, ...itemData } = parsed;

    const item = await prisma.$transaction(async (tx) => {
      const createdItem = await tx.menuItem.create({
        data: {
          ...itemData,
          imageUrl: itemData.imageUrl || null,
        },
      });

      if (modifierGroups && modifierGroups.length > 0) {
        for (const mg of modifierGroups) {
          const { options, ...mgData } = mg;
          const createdGroup = await tx.modifierGroup.create({
            data: {
              ...mgData,
              menuItemId: createdItem.id,
            },
          });

          if (options && options.length > 0) {
            await tx.modifierOption.createMany({
              data: options.map((opt) => ({
                ...opt,
                modifierGroupId: createdGroup.id,
              })),
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "MENU_ITEM_CREATED",
          entityType: "MenuItem",
          entityId: createdItem.id,
          newValues: parsed,
        },
      });

      return tx.menuItem.findUnique({
        where: { id: createdItem.id },
        include: {
          category: true,
          modifierGroups: {
            include: { options: true },
          },
        },
      });
    });

    return successResponse({ item }, "Menu item created", 201);
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
    // Waiter, Kitchen, Manager, Owner can toggle item availability
    const allowed: UserRole[] = [ROLES.OWNER_ADMIN, ROLES.MANAGER, ROLES.KITCHEN, ROLES.WAITER, ROLES.FRONT_DESK];
    if (!allowed.includes(session.role)) {
      requirePermission(session, PERMISSION_KEYS.SERVICES_MANAGE);
    }

    const body = await req.json();
    const parsed = updateMenuItemSchema.parse(body);
    const { id, ...data } = parsed;

    const item = await prisma.menuItem.update({
      where: { id },
      data,
      include: {
        category: true,
        modifierGroups: {
          include: { options: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "MENU_ITEM_UPDATED",
        entityType: "MenuItem",
        entityId: item.id,
        newValues: data,
      },
    });

    return successResponse({ item }, "Menu item updated");
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
      return errorResponse("Item ID is required", "BAD_REQUEST", 400);
    }

    await prisma.menuItem.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "MENU_ITEM_DELETED",
        entityType: "MenuItem",
        entityId: id,
      },
    });

    return successResponse({ success: true }, "Menu item deleted");
  } catch (err) {
    return handleRouteError(err);
  }
}
