import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError, AppError } from "@/lib/api-response";
import { DepositType } from "@prisma/client";

const createServiceSchema = z.object({
  name: z.string().min(2, "Service name is required"),
  categoryId: z.string().uuid("Valid category is required"),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  durationMin: z.number().int().min(5, "Duration must be at least 5 minutes"),
  bufferMin: z.number().int().min(0, "Buffer minutes cannot be negative").default(0),
  pricePesewas: z.number().int().min(100, "Price must be at least GH₵ 1.00 (100 pesewas)"),
  depositType: z.enum(["NONE", "FULL", "PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
  depositValue: z.number().int().min(0, "Deposit value cannot be negative").default(30),
  active: z.boolean().default(true),
  order: z.number().int().default(0),
  staffIds: z.array(z.string().uuid()).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    requirePermission(session, PERMISSION_KEYS.SERVICES_MANAGE);

    const body = await req.json();
    const parsed = createServiceSchema.parse(body);

    const category = await prisma.serviceCategory.findUnique({
      where: { id: parsed.categoryId },
    });
    if (!category || category.deletedAt) {
      throw new AppError("Category not found", 404, "NOT_FOUND");
    }

    if (parsed.depositType === "PERCENTAGE" && parsed.depositValue > 100) {
      throw new AppError("Deposit percentage cannot exceed 100%", 400, "INVALID_DEPOSIT_VALUE");
    }
    if (parsed.depositType === "FIXED" && parsed.depositValue > parsed.pricePesewas) {
      throw new AppError("Fixed deposit cannot exceed the total service price", 400, "INVALID_DEPOSIT_VALUE");
    }

    const service = await prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          name: parsed.name.trim(),
          categoryId: parsed.categoryId,
          description: parsed.description?.trim() || null,
          imageUrl: parsed.imageUrl?.trim() || null,
          durationMin: parsed.durationMin,
          bufferMin: parsed.bufferMin,
          pricePesewas: parsed.pricePesewas,
          depositType: parsed.depositType as DepositType,
          depositValue: parsed.depositValue,
          active: parsed.active,
          order: parsed.order,
          staffServices: {
            create: parsed.staffIds.map((staffId) => ({ staffId })),
          },
        },
        include: {
          addons: true,
          staffServices: {
            include: { staff: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "SERVICE_CREATE",
          entityType: "SERVICE",
          entityId: created.id,
          newValues: {
            name: created.name,
            categoryId: created.categoryId,
            pricePesewas: created.pricePesewas,
            durationMin: created.durationMin,
            bufferMin: created.bufferMin,
            staffIds: parsed.staffIds,
          },
        },
      });

      return created;
    });

    return successResponse(service, "Service created successfully", 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
