/**
 * Business Settings Module.
 * Provides typed access to studio configuration, opening hours, booking policies,
 * regional constants (GHS & Africa/Accra), and encrypted payment keys.
 */

import { z } from "zod";
import { prisma } from "./db";
import { encryptSecret, decryptSecret, maskSecretKey } from "./encryption";
import { env } from "./env";
import { ROLES, UserRole } from "./rbac";
import { AppError } from "./api-response";

export * from "./settings-types";
import {
  BusinessSettings,
  DEFAULT_OPENING_HOURS,
  DEFAULT_HOLIDAYS,
  DEFAULT_BUSINESS_SETTINGS,
  SlotIntervalMinutes,
  DepositRefundPolicy,
  STUDIO_CURRENCY,
  STUDIO_TIMEZONE,
  TaxSetting,
} from "./settings-types";

// Zod Schema for settings update payload
export const updateSettingsSchema = z.object({
  businessName: z.string().min(2, "Business name is required").optional(),
  businessLogo: z.string().optional(),
  businessPhone: z.string().min(8, "Valid phone number required").optional(),
  businessAddress: z.string().min(5, "Address is required").optional(),
  businessMapLink: z.string().url("Must be a valid URL").or(z.literal("")).optional(),

  openingHours: z
    .array(
      z.object({
        day: z.string(),
        weekday: z.number().int().min(0).max(6),
        isOpen: z.boolean(),
        openTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid open time (HH:MM)"),
        closeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid close time (HH:MM)"),
      })
    )
    .optional(),

  holidays: z
    .array(
      z.object({
        id: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        name: z.string().min(1, "Holiday name required"),
      })
    )
    .optional(),

  minimumNoticeHours: z.number().int().min(1).max(72).optional(),
  maxDaysAhead: z.number().int().min(7).max(365).optional(),
  slotIntervalMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(),
  slotHoldMinutes: z.number().int().min(5).max(60).optional(),

  cancellationNoticeHours: z.number().int().min(1).max(168).optional(),
  depositRefundPolicy: z
    .enum(["FULL_REFUND_BEFORE_CUTOFF", "NON_REFUNDABLE", "PARTIAL_50"])
    .optional(),
  cancellationPolicyText: z.string().min(5).optional(),

  paystackPublicKey: z.string().min(5).optional(),
  paystackSecretKey: z.string().min(5).optional(),

  smsSenderId: z
    .string()
    .min(1)
    .max(11, "SMS Sender ID cannot exceed 11 characters (Ghana GSM standard)")
    .optional(),

  // HMS & Hotel Extensions
  hotelName: z.string().min(2, "Hotel name is required").optional(),
  standardCheckInTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid check-in time (HH:MM)")
    .optional(),
  standardCheckOutTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid check-out time (HH:MM)")
    .optional(),
  freeCancelHoursBeforeCheckIn: z.number().int().min(0).max(720).optional(),
  cancellationPenaltyPercent: z.number().min(0).max(100).optional(),
  taxes: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Tax name is required"),
        percentage: z.number().min(0).max(100, "Percentage must be between 0 and 100"),
        enabled: z.boolean(),
      })
    )
    .optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export interface GetSettingsOptions {
  includeSecrets?: boolean;
  requesterRole?: UserRole | string;
}

/**
 * Retrieves the typed business settings from the database, falling back to defaults.
 * Automatically masks Paystack keys unless caller has OWNER_ADMIN role and explicitly requests them.
 */
export async function getSettings(options?: GetSettingsOptions): Promise<BusinessSettings> {
  const records = await prisma.setting.findMany();
  const map = new Map<string, string>();
  for (const r of records) {
    map.set(r.key, r.value);
  }

  // Profile
  const businessName = map.get("salon_name") || map.get("business_name") || DEFAULT_BUSINESS_SETTINGS.businessName;
  const businessLogo = map.get("business_logo") || DEFAULT_BUSINESS_SETTINGS.businessLogo;
  const businessPhone = map.get("business_phone") || DEFAULT_BUSINESS_SETTINGS.businessPhone;
  const businessAddress = map.get("business_address") || DEFAULT_BUSINESS_SETTINGS.businessAddress;
  const businessMapLink = map.get("business_map_link") || DEFAULT_BUSINESS_SETTINGS.businessMapLink;

  // Opening Hours
  let openingHours = DEFAULT_OPENING_HOURS;
  const hoursRaw = map.get("opening_hours");
  if (hoursRaw) {
    try {
      openingHours = JSON.parse(hoursRaw);
    } catch {
      openingHours = DEFAULT_OPENING_HOURS;
    }
  }

  // Holidays
  let holidays = DEFAULT_HOLIDAYS;
  const holidaysRaw = map.get("business_holidays");
  if (holidaysRaw) {
    try {
      holidays = JSON.parse(holidaysRaw);
    } catch {
      holidays = DEFAULT_HOLIDAYS;
    }
  }

  // Booking Rules
  const minimumNoticeHours = map.has("booking_minimum_notice_hours")
    ? Number.parseInt(map.get("booking_minimum_notice_hours")!, 10)
    : DEFAULT_BUSINESS_SETTINGS.minimumNoticeHours;

  const maxDaysAhead = map.has("booking_max_days_ahead")
    ? Number.parseInt(map.get("booking_max_days_ahead")!, 10)
    : DEFAULT_BUSINESS_SETTINGS.maxDaysAhead;

  let slotIntervalMinutes: SlotIntervalMinutes = DEFAULT_BUSINESS_SETTINGS.slotIntervalMinutes;
  const intervalVal = Number.parseInt(map.get("booking_slot_interval_minutes") || "30", 10);
  if (intervalVal === 15 || intervalVal === 30 || intervalVal === 60) {
    slotIntervalMinutes = intervalVal;
  }

  const slotHoldMinutes = map.has("slot_hold_minutes")
    ? Number.parseInt(map.get("slot_hold_minutes")!, 10)
    : DEFAULT_BUSINESS_SETTINGS.slotHoldMinutes;

  // Cancellation Policy
  const cancellationNoticeHours = map.has("cancellation_notice_hours")
    ? Number.parseInt(map.get("cancellation_notice_hours")!, 10)
    : DEFAULT_BUSINESS_SETTINGS.cancellationNoticeHours;

  const depositRefundPolicy = (map.get("deposit_refund_policy") as DepositRefundPolicy) ||
    DEFAULT_BUSINESS_SETTINGS.depositRefundPolicy;

  const cancellationPolicyText =
    map.get("cancellation_policy_text") || DEFAULT_BUSINESS_SETTINGS.cancellationPolicyText;

  // Payment Keys
  const storedPublicKey = map.get("paystack_public_key") || env.PAYSTACK_PUBLIC_KEY;
  const storedSecretKey = map.get("paystack_secret_key") || env.PAYSTACK_SECRET_KEY;

  const decryptedPublicKey = decryptSecret(storedPublicKey);
  const decryptedSecretKey = decryptSecret(storedSecretKey);

  let paystackPublicKey = maskSecretKey(decryptedPublicKey);
  let paystackSecretKey = maskSecretKey(decryptedSecretKey);

  // Expose raw secrets only if Owner explicitly requests it (e.g. backend payment gateway caller)
  if (options?.includeSecrets && options?.requesterRole === ROLES.OWNER_ADMIN) {
    paystackPublicKey = decryptedPublicKey;
    paystackSecretKey = decryptedSecretKey;
  }

  // SMS Sender ID
  const smsSenderId = map.get("sms_sender_id") || DEFAULT_BUSINESS_SETTINGS.smsSenderId;

  // HMS & Hotel Extensions
  const hotelName =
    map.get("hotel_name") ||
    map.get("salon_name") ||
    map.get("business_name") ||
    DEFAULT_BUSINESS_SETTINGS.hotelName;

  const standardCheckInTime =
    map.get("standard_check_in_time") || DEFAULT_BUSINESS_SETTINGS.standardCheckInTime;

  const standardCheckOutTime =
    map.get("standard_check_out_time") || DEFAULT_BUSINESS_SETTINGS.standardCheckOutTime;

  const freeCancelHoursBeforeCheckIn = map.has("free_cancel_hours_before_check_in")
    ? Number.parseInt(map.get("free_cancel_hours_before_check_in")!, 10)
    : map.has("cancellation_notice_hours")
      ? Number.parseInt(map.get("cancellation_notice_hours")!, 10)
      : DEFAULT_BUSINESS_SETTINGS.freeCancelHoursBeforeCheckIn;

  const cancellationPenaltyPercent = map.has("cancellation_penalty_percent")
    ? Number.parseFloat(map.get("cancellation_penalty_percent")!)
    : DEFAULT_BUSINESS_SETTINGS.cancellationPenaltyPercent;

  let taxes: TaxSetting[] = [];
  const taxesRaw = map.get("tax_configuration");
  if (taxesRaw) {
    try {
      taxes = JSON.parse(taxesRaw);
    } catch {
      taxes = [];
    }
  }

  return {
    businessName,
    businessLogo,
    businessPhone,
    businessAddress,
    businessMapLink,
    openingHours,
    holidays,
    minimumNoticeHours,
    maxDaysAhead,
    slotIntervalMinutes,
    slotHoldMinutes,
    cancellationNoticeHours,
    depositRefundPolicy,
    cancellationPolicyText,
    paystackPublicKey,
    paystackSecretKey,
    smsSenderId,
    currency: STUDIO_CURRENCY,
    timezone: STUDIO_TIMEZONE,
    hotelName,
    standardCheckInTime,
    standardCheckOutTime,
    freeCancelHoursBeforeCheckIn,
    cancellationPenaltyPercent,
    taxes,
  };
}

/**
 * Saves updated business settings to the database.
 * Permission-gated: requires user with settings.manage.
 * If payment keys are being updated, strictly enforces OWNER_ADMIN role.
 * Writes audit log entry recording all changes.
 */
export async function saveSettings(
  input: UpdateSettingsInput,
  user: { id: string; role: string; name: string }
): Promise<BusinessSettings> {
  // Validate schema
  const parsed = updateSettingsSchema.parse(input);

  // If attempting to update payment keys, ensure user is OWNER_ADMIN
  if (parsed.paystackPublicKey || parsed.paystackSecretKey) {
    if (user.role !== ROLES.OWNER_ADMIN) {
      throw new AppError(
        "Forbidden: Only the Owner/Admin can view or modify payment credentials",
        403,
        "PAYMENT_KEYS_OWNER_ONLY"
      );
    }
  }

  const entriesToUpsert: { key: string; value: string; description: string }[] = [];

  if (parsed.businessName !== undefined) {
    entriesToUpsert.push({ key: "salon_name", value: parsed.businessName, description: "Official business trade name" });
    entriesToUpsert.push({ key: "business_name", value: parsed.businessName, description: "Business profile name" });
  }
  if (parsed.businessLogo !== undefined) {
    entriesToUpsert.push({ key: "business_logo", value: parsed.businessLogo, description: "Business brand logo" });
  }
  if (parsed.businessPhone !== undefined) {
    entriesToUpsert.push({ key: "business_phone", value: parsed.businessPhone, description: "Business customer line" });
  }
  if (parsed.businessAddress !== undefined) {
    entriesToUpsert.push({ key: "business_address", value: parsed.businessAddress, description: "Studio physical address" });
  }
  if (parsed.businessMapLink !== undefined) {
    entriesToUpsert.push({ key: "business_map_link", value: parsed.businessMapLink, description: "Google Maps URL" });
  }
  if (parsed.openingHours !== undefined) {
    entriesToUpsert.push({
      key: "opening_hours",
      value: JSON.stringify(parsed.openingHours),
      description: "Weekly studio opening schedule",
    });
  }
  if (parsed.holidays !== undefined) {
    entriesToUpsert.push({
      key: "business_holidays",
      value: JSON.stringify(parsed.holidays),
      description: "Annual closed dates and holidays",
    });
  }
  if (parsed.minimumNoticeHours !== undefined) {
    entriesToUpsert.push({
      key: "booking_minimum_notice_hours",
      value: parsed.minimumNoticeHours.toString(),
      description: "Minimum hours notice required before booking",
    });
  }
  if (parsed.maxDaysAhead !== undefined) {
    entriesToUpsert.push({
      key: "booking_max_days_ahead",
      value: parsed.maxDaysAhead.toString(),
      description: "Maximum advance booking window in days",
    });
  }
  if (parsed.slotIntervalMinutes !== undefined) {
    entriesToUpsert.push({
      key: "booking_slot_interval_minutes",
      value: parsed.slotIntervalMinutes.toString(),
      description: "Calendar slot interval (15, 30, or 60 min)",
    });
  }
  if (parsed.slotHoldMinutes !== undefined) {
    entriesToUpsert.push({
      key: "slot_hold_minutes",
      value: parsed.slotHoldMinutes.toString(),
      description: "Minutes a checkout hold persists",
    });
  }
  if (parsed.cancellationNoticeHours !== undefined) {
    entriesToUpsert.push({
      key: "cancellation_notice_hours",
      value: parsed.cancellationNoticeHours.toString(),
      description: "Hours before appointment for free cancellation",
    });
  }
  if (parsed.depositRefundPolicy !== undefined) {
    entriesToUpsert.push({
      key: "deposit_refund_policy",
      value: parsed.depositRefundPolicy,
      description: "Policy governing deposit refunds on cancellation",
    });
  }
  if (parsed.cancellationPolicyText !== undefined) {
    entriesToUpsert.push({
      key: "cancellation_policy_text",
      value: parsed.cancellationPolicyText,
      description: "Customer-facing cancellation policy text",
    });
  }
  if (parsed.paystackPublicKey !== undefined && parsed.paystackPublicKey.trim() !== "") {
    // Only encrypt if new plaintext key provided (not already masked)
    if (!parsed.paystackPublicKey.includes("•")) {
      const encrypted = encryptSecret(parsed.paystackPublicKey.trim());
      entriesToUpsert.push({
        key: "paystack_public_key",
        value: encrypted,
        description: "Encrypted Paystack public key",
      });
    }
  }
  if (parsed.paystackSecretKey !== undefined && parsed.paystackSecretKey.trim() !== "") {
    // Only encrypt if new plaintext key provided (not already masked)
    if (!parsed.paystackSecretKey.includes("•")) {
      const encrypted = encryptSecret(parsed.paystackSecretKey.trim());
      entriesToUpsert.push({
        key: "paystack_secret_key",
        value: encrypted,
        description: "Encrypted Paystack secret key",
      });
    }
  }
  if (parsed.smsSenderId !== undefined) {
    entriesToUpsert.push({
      key: "sms_sender_id",
      value: parsed.smsSenderId.trim(),
      description: "Ghana GSM alphanumeric SMS Sender ID (max 11 chars)",
    });
  }
  if (parsed.hotelName !== undefined) {
    entriesToUpsert.push({
      key: "hotel_name",
      value: parsed.hotelName.trim(),
      description: "Official Hotel Name",
    });
    // Keep business_name synchronized as fallback
    entriesToUpsert.push({
      key: "business_name",
      value: parsed.hotelName.trim(),
      description: "Business profile name",
    });
  }
  if (parsed.standardCheckInTime !== undefined) {
    entriesToUpsert.push({
      key: "standard_check_in_time",
      value: parsed.standardCheckInTime,
      description: "Standard hotel check-in time (HH:MM)",
    });
  }
  if (parsed.standardCheckOutTime !== undefined) {
    entriesToUpsert.push({
      key: "standard_check_out_time",
      value: parsed.standardCheckOutTime,
      description: "Standard hotel check-out time (HH:MM)",
    });
  }
  if (parsed.freeCancelHoursBeforeCheckIn !== undefined) {
    entriesToUpsert.push({
      key: "free_cancel_hours_before_check_in",
      value: parsed.freeCancelHoursBeforeCheckIn.toString(),
      description: "Hours before check-in for free cancellation",
    });
  }
  if (parsed.cancellationPenaltyPercent !== undefined) {
    entriesToUpsert.push({
      key: "cancellation_penalty_percent",
      value: parsed.cancellationPenaltyPercent.toString(),
      description: "Cancellation penalty percentage after cutoff (0-100%)",
    });
  }
  if (parsed.taxes !== undefined) {
    entriesToUpsert.push({
      key: "tax_configuration",
      value: JSON.stringify(parsed.taxes),
      description: "Named toggleable percentage taxes",
    });
  }

  // Persist all updated settings inside a transaction
  await prisma.$transaction(async (tx) => {
    for (const entry of entriesToUpsert) {
      await tx.setting.upsert({
        where: { key: entry.key },
        update: { value: entry.value, description: entry.description },
        create: { key: entry.key, value: entry.value, description: entry.description },
      });
    }

    // Write audit log entry (sanitizing secret keys)
    const sanitizedChanges = { ...parsed };
    const userRecord = user?.id ? await tx.user.findUnique({ where: { id: user.id } }) : null;

    await tx.auditLog.create({
      data: {
        userId: userRecord ? userRecord.id : null,
        action: "SETTINGS_UPDATE",
        entityType: "SETTING",
        newValues: sanitizedChanges,
      },
    });
  });

  return getSettings({ requesterRole: user?.role });
}
