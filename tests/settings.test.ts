import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import {
  getSettings,
  saveSettings,
  STUDIO_CURRENCY,
  STUDIO_TIMEZONE,
  updateSettingsSchema,
} from "@/lib/settings";
import { encryptSecret, decryptSecret, maskSecretKey } from "@/lib/encryption";
import { ROLES } from "@/lib/rbac";
import { AppError } from "@/lib/api-response";

describe("Prompt 7: Business Settings & Encryption Unit Tests", () => {
  beforeEach(async () => {
    // Clean up any modified settings from tests to ensure deterministic baseline
    await prisma.setting.deleteMany({
      where: {
        key: {
          in: [
            "business_name",
            "booking_slot_interval_min",
            "booking_minimum_notice_hours",
            "paystack_public_key",
            "paystack_secret_key",
            "hotel_name",
            "standard_check_in_time",
            "standard_check_out_time",
            "free_cancel_hours_before_check_in",
            "cancellation_penalty_percent",
            "tax_configuration",
          ],
        },
      },
    });
  });

  it("exposes typed getSettings() with fixed currency (GHS) and timezone (Africa/Accra)", async () => {
    const settings = await getSettings();

    expect(settings.currency).toBe(STUDIO_CURRENCY);
    expect(settings.currency).toBe("GHS");
    expect(settings.timezone).toBe(STUDIO_TIMEZONE);
    expect(settings.timezone).toBe("Africa/Accra");
    expect(settings.businessName).toBeDefined();
    expect(settings.openingHours.length).toBe(7);
    expect([15, 30, 60]).toContain(settings.slotIntervalMinutes);
  });

  it("encrypts and decrypts secret keys using AES-256-GCM authenticated cipher", () => {
    const rawSecret = "sk_live_9876543210fedcba";
    const encrypted = encryptSecret(rawSecret);

    expect(encrypted).not.toBe(rawSecret);
    expect(encrypted).toContain(":"); // iv:authTag:ciphertext

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(rawSecret);
  });

  it("masks secret keys securely for UI presentation", () => {
    const key = "sk_live_1234567890abcdef";
    const masked = maskSecretKey(key);

    expect(masked).toContain("sk_live_");
    expect(masked).toContain("••••••••");
    expect(masked.endsWith("cdef")).toBe(true);
    expect(masked).not.toContain("1234567890");
  });

  it("validates slotIntervalMinutes strictly permits only 15, 30, or 60 minutes", () => {
    // Valid values
    expect(updateSettingsSchema.safeParse({ slotIntervalMinutes: 15 }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ slotIntervalMinutes: 30 }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ slotIntervalMinutes: 60 }).success).toBe(true);

    // Invalid values
    expect(updateSettingsSchema.safeParse({ slotIntervalMinutes: 10 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ slotIntervalMinutes: 45 }).success).toBe(false);
  });

  it("validates minimumNoticeHours (1 to 72) and maxDaysAhead (7 to 365)", () => {
    expect(updateSettingsSchema.safeParse({ minimumNoticeHours: 0 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ minimumNoticeHours: 24 }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ minimumNoticeHours: 100 }).success).toBe(false);

    expect(updateSettingsSchema.safeParse({ maxDaysAhead: 5 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ maxDaysAhead: 90 }).success).toBe(true);
  });

  it("validates Ghana SMS Sender ID cannot exceed 11 characters", () => {
    expect(updateSettingsSchema.safeParse({ smsSenderId: "AURA STUDIO" }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ smsSenderId: "AURA BEAUTY STUDIO GHANA" }).success).toBe(false);
  });

  it("rejects non-Owner role from updating payment credentials", async () => {
    const managerUser = {
      id: "manager-test-id",
      role: ROLES.MANAGER,
      name: "Test Manager",
    };

    await expect(
      saveSettings(
        {
          paystackSecretKey: "sk_live_new_secret_key_123",
        },
        managerUser
      )
    ).rejects.toThrowError(AppError);

    await expect(
      saveSettings(
        {
          paystackSecretKey: "sk_live_new_secret_key_123",
        },
        managerUser
      )
    ).rejects.toMatchObject({
      code: "PAYMENT_KEYS_OWNER_ONLY",
      statusCode: 403,
    });
  });

  it("allows Owner role to save settings with encrypted payment keys and audit logging", async () => {
    const seededOwner = await prisma.user.findUnique({
      where: { email: "owner@aurastudio.gh" },
    });

    const ownerUser = {
      id: seededOwner?.id || "owner-test-id",
      role: ROLES.OWNER_ADMIN,
      name: "Akosua Addo",
    };

    const updated = await saveSettings(
      {
        businessName: "Aura Luxury Beauty Lounge",
        minimumNoticeHours: 3,
        slotIntervalMinutes: 60,
        paystackPublicKey: "pk_live_test_pub_12345",
      },
      ownerUser
    );

    expect(updated.businessName).toBe("Aura Luxury Beauty Lounge");
    expect(updated.minimumNoticeHours).toBe(3);
    expect(updated.slotIntervalMinutes).toBe(60);

    // Verify stored in DB encrypted
    const dbRecord = await prisma.setting.findUnique({
      where: { key: "paystack_public_key" },
    });
    expect(dbRecord?.value).toContain(":"); // IV:Tag:Cipher format
    expect(decryptSecret(dbRecord!.value)).toBe("pk_live_test_pub_12345");

    // Verify audit log entry was written
    const audit = await prisma.auditLog.findFirst({
      where: { action: "SETTINGS_UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeDefined();
    expect(audit?.entityType).toBe("SETTING");
  });

  it("handles HMS extensions: hotel name, check-in/out times, cancellation penalty, and taxes", async () => {
    const ownerUser = {
      id: "owner-hms-test",
      role: ROLES.OWNER_ADMIN,
      name: "Akosua Addo",
    };

    // 1. Initial state has default values and empty taxes
    const initialSettings = await getSettings();
    expect(initialSettings.hotelName).toBeDefined();
    expect(initialSettings.standardCheckInTime).toBe("14:00");
    expect(initialSettings.standardCheckOutTime).toBe("11:00");
    expect(initialSettings.freeCancelHoursBeforeCheckIn).toBe(24);
    expect(initialSettings.cancellationPenaltyPercent).toBe(50);
    expect(Array.isArray(initialSettings.taxes)).toBe(true);
    expect(initialSettings.taxes).toEqual([]);

    // 2. Validate time format schema
    expect(updateSettingsSchema.safeParse({ standardCheckInTime: "15:00" }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ standardCheckInTime: "25:00" }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ standardCheckOutTime: "10:30" }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ standardCheckOutTime: "invalid" }).success).toBe(false);

    // 3. Save HMS settings with named toggleable taxes
    const saved = await saveSettings(
      {
        hotelName: "Aura Grand Hotel & Restaurant",
        standardCheckInTime: "15:00",
        standardCheckOutTime: "10:30",
        freeCancelHoursBeforeCheckIn: 48,
        cancellationPenaltyPercent: 100,
        taxes: [
          { id: "tax-vat", name: "VAT", percentage: 15.0, enabled: true },
          { id: "tax-nhil", name: "NHIL", percentage: 2.5, enabled: true },
          { id: "tax-tourism", name: "Tourism Levy", percentage: 1.0, enabled: false },
        ],
      },
      ownerUser
    );

    expect(saved.hotelName).toBe("Aura Grand Hotel & Restaurant");
    expect(saved.standardCheckInTime).toBe("15:00");
    expect(saved.standardCheckOutTime).toBe("10:30");
    expect(saved.freeCancelHoursBeforeCheckIn).toBe(48);
    expect(saved.cancellationPenaltyPercent).toBe(100);
    expect(saved.taxes.length).toBe(3);
    expect(saved.taxes[0]).toEqual({
      id: "tax-vat",
      name: "VAT",
      percentage: 15,
      enabled: true,
    });
    expect(saved.taxes[2].enabled).toBe(false);

    // 4. Retrieve settings fresh and verify persistence
    const reloaded = await getSettings();
    expect(reloaded.hotelName).toBe("Aura Grand Hotel & Restaurant");
    expect(reloaded.standardCheckInTime).toBe("15:00");
    expect(reloaded.standardCheckOutTime).toBe("10:30");
    expect(reloaded.freeCancelHoursBeforeCheckIn).toBe(48);
    expect(reloaded.cancellationPenaltyPercent).toBe(100);
    expect(reloaded.taxes.length).toBe(3);
  });
});
