import { prisma } from "@/lib/db";
import { normalizeGhanaPhone, sendSms } from "@/lib/sms";
import { AppError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import crypto from "crypto";

interface RoomServiceOtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  reservationId: string;
  roomId: string;
  roomNumber: string;
  guestName: string;
  guestPhone: string;
}

const otpStore = new Map<string, RoomServiceOtpEntry>();
const verifiedTokenStore = new Map<string, {
  reservationId: string;
  roomId: string;
  roomNumber: string;
  guestName: string;
  guestPhone: string;
  expiresAt: number;
}>();

// Cleanup expired entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of otpStore.entries()) {
      if (now > val.expiresAt) otpStore.delete(key);
    }
    for (const [token, val] of verifiedTokenStore.entries()) {
      if (now > val.expiresAt) verifiedTokenStore.delete(token);
    }
  }, 5 * 60 * 1000);
}

/**
 * Sends a 6-digit SMS OTP to verify an in-house hotel guest requesting Room Service.
 */
export async function requestRoomServiceOtp(roomNumber: string, phone: string, clientIp: string) {
  checkRateLimit(`rs_otp_ip:${clientIp}`, 5, 15 * 60);

  const cleanRoomNumber = roomNumber.trim();
  const normPhone = normalizeGhanaPhone(phone);

  // 1. Locate Room
  const room = await prisma.room.findFirst({
    where: {
      number: {
        equals: cleanRoomNumber,
        mode: "insensitive",
      },
    },
  });

  if (!room) {
    throw new AppError(
      `Room "${cleanRoomNumber}" does not exist`,
      404,
      "ROOM_NOT_FOUND"
    );
  }

  // 2. Find currently CHECKED_IN reservation for this room
  const activeResRoom = await prisma.reservationRoom.findFirst({
    where: {
      roomId: room.id,
      reservation: {
        status: "CHECKED_IN",
      },
    },
    include: {
      reservation: {
        include: { guest: true },
      },
    },
  });

  if (!activeResRoom || !activeResRoom.reservation) {
    throw new AppError(
      `Room ${room.number} does not have an active checked-in guest`,
      400,
      "NO_ACTIVE_CHECKIN"
    );
  }

  const reservation = activeResRoom.reservation;
  const guestPhoneNorm = normalizeGhanaPhone(reservation.guest.phone);

  // Verify phone matches (allow last 9 digits match for international vs local dialing)
  const phoneMatch =
    normPhone === guestPhoneNorm ||
    normPhone.slice(-9) === guestPhoneNorm.slice(-9);

  if (!phoneMatch) {
    throw new AppError(
      `Phone number does not match the active guest registration for Room ${room.number}`,
      400,
      "PHONE_MISMATCH"
    );
  }

  // 3. Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const key = `${cleanRoomNumber.toUpperCase()}_${normPhone}`;

  otpStore.set(key, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
    reservationId: reservation.id,
    roomId: room.id,
    roomNumber: room.number,
    guestName: reservation.guest.name,
    guestPhone: normPhone,
  });

  try {
    await sendSms({
      recipient: normPhone,
      message: `Aura Royal Hotel: Your room service verification code for Room ${room.number} is ${code}. Valid for 10 minutes.`,
      senderId: "AuraHotel",
    });
  } catch (err) {
    logger.warn(`Failed to dispatch room service OTP SMS: ${err}`);
  }

  const maskedPhone =
    normPhone.length > 4 ? `+***${normPhone.slice(-4)}` : normPhone;

  return {
    success: true,
    roomNumber: room.number,
    maskedPhone,
  };
}

/**
 * Verifies the 6-digit OTP and generates an active Room Service session token.
 */
export function verifyRoomServiceOtp(roomNumber: string, phone: string, enteredCode: string) {
  const cleanRoomNumber = roomNumber.trim().toUpperCase();
  const normPhone = normalizeGhanaPhone(phone);
  const key = `${cleanRoomNumber}_${normPhone}`;

  const entry = otpStore.get(key);
  if (!entry) {
    throw new AppError(
      "No verification request found for this room and phone. Please request a new code.",
      400,
      "OTP_NOT_FOUND"
    );
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    throw new AppError(
      "Verification code has expired. Please request a new code.",
      400,
      "OTP_EXPIRED"
    );
  }

  if (entry.attempts >= 5) {
    otpStore.delete(key);
    throw new AppError(
      "Too many failed verification attempts. Please request a new code.",
      429,
      "TOO_MANY_ATTEMPTS"
    );
  }

  entry.attempts += 1;

  if (entry.code !== enteredCode.trim()) {
    throw new AppError("Invalid verification code. Please check and try again.", 400, "INVALID_OTP");
  }

  // Clear OTP on successful match
  otpStore.delete(key);

  // Generate verified token valid for 2 hours
  const verificationToken = `RS-${crypto.randomBytes(24).toString("hex")}`;
  verifiedTokenStore.set(verificationToken, {
    reservationId: entry.reservationId,
    roomId: entry.roomId,
    roomNumber: entry.roomNumber,
    guestName: entry.guestName,
    guestPhone: entry.guestPhone,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  });

  return {
    verified: true,
    verificationToken,
    reservationId: entry.reservationId,
    roomNumber: entry.roomNumber,
    guestName: entry.guestName,
    guestPhone: entry.guestPhone,
  };
}

/**
 * Validates a room service verification token when submitting an order.
 */
export function validateRoomServiceToken(token: string) {
  const session = verifiedTokenStore.get(token);
  if (!session) {
    throw new AppError(
      "Room service session is invalid or expired. Please verify your room number and phone again.",
      401,
      "INVALID_ROOM_SERVICE_SESSION"
    );
  }

  if (Date.now() > session.expiresAt) {
    verifiedTokenStore.delete(token);
    throw new AppError(
      "Room service session has expired. Please verify again.",
      401,
      "ROOM_SERVICE_SESSION_EXPIRED"
    );
  }

  return session;
}

/**
 * Test helper to retrieve active in-memory OTP for testing purposes.
 */
export function _getOtpForTesting(roomNumber: string, phone: string) {
  const cleanRoomNumber = roomNumber.trim().toUpperCase();
  const normPhone = normalizeGhanaPhone(phone);
  return otpStore.get(`${cleanRoomNumber}_${normPhone}`)?.code;
}

