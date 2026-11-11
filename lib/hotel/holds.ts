import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { AppError } from "../api-response";
import { getSettings } from "../settings";
import { parseDateOnly } from "./date-utils";
import { CreateHoldInput, createHoldSchema } from "./types";
import { getRoomTypeAvailability } from "./availability";
import { PrismaClient, RoomHold } from "@prisma/client";
import { logger } from "../logger";

const HOLD_CLEANUP_QUEUE_NAME = "cleanup-expired-room-holds";

/**
 * Atomically creates a temporary RoomHold.
 * Locks RoomType row and re-checks availability inside a transaction to prevent race conditions.
 */
export async function createHold(input: CreateHoldInput): Promise<RoomHold> {
  const parsed = createHoldSchema.parse(input);
  const { roomTypeId, checkIn, checkOut, quantity, holdMinutes: requestedHoldMinutes } = parsed;

  const settings = await getSettings();
  const holdMinutes = requestedHoldMinutes || settings.slotHoldMinutes || 10;
  const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
  const token = `hold_${randomBytes(16).toString("hex")}`;

  return await prisma.$transaction(async (tx) => {
    // 1. Pessimistic row lock on RoomType to serialize concurrent hold requests
    await tx.$executeRaw`SELECT id FROM "RoomType" WHERE id = ${roomTypeId}::text FOR UPDATE`;

    // 2. Re-check availability inside transaction
    const availResults = await getRoomTypeAvailability(
      {
        checkIn,
        checkOut,
        roomTypeId,
        adults: 1,
        children: 0,
      },
      tx as unknown as PrismaClient
    );

    const roomTypeAvail = availResults.find((a) => a.roomTypeId === roomTypeId);
    if (!roomTypeAvail || roomTypeAvail.availableQuantity < quantity) {
      throw new AppError(
        `Insufficient room availability for selected dates (${roomTypeAvail?.availableQuantity ?? 0} available, ${quantity} requested)`,
        409,
        "ROOMS_UNAVAILABLE"
      );
    }

    // 3. Insert RoomHold
    const hold = await tx.roomHold.create({
      data: {
        token,
        roomTypeId,
        checkIn: parseDateOnly(checkIn),
        checkOut: parseDateOnly(checkOut),
        quantity,
        expiresAt,
      },
    });

    // 4. Audit Log entry
    await tx.auditLog.create({
      data: {
        action: "ROOM_HOLD_CREATE",
        entityType: "ROOM_HOLD",
        entityId: hold.id,
        newValues: {
          token,
          roomTypeId,
          checkIn,
          checkOut,
          quantity,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    return hold;
  });
}

/**
 * Releases/cancels an active RoomHold by token.
 */
export async function releaseHold(token: string): Promise<boolean> {
  const hold = await prisma.roomHold.findUnique({
    where: { token },
  });

  if (!hold) {
    return false;
  }

  await prisma.roomHold.delete({
    where: { token },
  });

  await prisma.auditLog.create({
    data: {
      action: "ROOM_HOLD_RELEASE",
      entityType: "ROOM_HOLD",
      entityId: hold.id,
      newValues: {
        token,
        releasedAt: new Date().toISOString(),
      },
    },
  });

  return true;
}

/**
 * Cleans up and deletes expired room holds.
 * Can be scheduled via pg-boss or executed on-demand.
 */
export async function cleanupExpiredHolds(): Promise<number> {
  const now = new Date();
  const deleted = await prisma.roomHold.deleteMany({
    where: {
      expiresAt: { lte: now },
    },
  });

  if (deleted.count > 0) {
    await prisma.auditLog.create({
      data: {
        action: "ROOM_HOLD_CLEANUP_EXPIRED",
        entityType: "ROOM_HOLD",
        newValues: {
          expiredCount: deleted.count,
          cleanedAt: now.toISOString(),
        },
      },
    });
  }

  return deleted.count;
}

/**
 * Registers pg-boss worker and recurring schedule for expired hold cleanup.
 */
export async function registerHoldCleanupJob(boss: {
  work: (queue: string, handler: () => Promise<void>) => Promise<string>;
  schedule?: (queue: string, cron: string) => Promise<string>;
}): Promise<void> {
  try {
    await boss.work(HOLD_CLEANUP_QUEUE_NAME, async () => {
      const count = await cleanupExpiredHolds();
      if (count > 0) {
        logger.info(`[pg-boss] Cleaned up ${count} expired room holds`);
      }
    });

    // Run every 2 minutes
    if (boss.schedule) {
      await boss.schedule(HOLD_CLEANUP_QUEUE_NAME, "*/2 * * * *");
    }
  } catch (err) {
    logger.warn("Failed to register pg-boss hold cleanup worker", { error: String(err) });
  }
}

