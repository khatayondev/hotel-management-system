/**
 * Client-Safe Business Settings Types and Defaults.
 * Contains no server-side, database, or crypto dependencies.
 */

// Fixed studio constants
export const STUDIO_CURRENCY = "GHS" as const;
export const STUDIO_TIMEZONE = "Africa/Accra" as const;

export interface DaySchedule {
  day: string;
  weekday: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isOpen: boolean;
  openTime: string; // "09:00"
  closeTime: string; // "18:00"
}

export interface Holiday {
  id: string;
  date: string; // "YYYY-MM-DD"
  name: string;
}

export type DepositRefundPolicy =
  | "FULL_REFUND_BEFORE_CUTOFF"
  | "NON_REFUNDABLE"
  | "PARTIAL_50";

export type SlotIntervalMinutes = 15 | 30 | 60;

export interface TaxSetting {
  id: string;
  name: string;
  percentage: number; // e.g. 15 for 15% VAT, 2.5 for 2.5% NHIL
  enabled: boolean;
}

export interface BusinessSettings {
  // 1. Profile
  businessName: string;
  businessLogo: string;
  businessPhone: string;
  businessAddress: string;
  businessMapLink: string;

  // 2. Opening Hours
  openingHours: DaySchedule[];

  // 3. Holidays & Closures
  holidays: Holiday[];

  // 4. Booking Rules
  minimumNoticeHours: number;
  maxDaysAhead: number;
  slotIntervalMinutes: SlotIntervalMinutes;
  slotHoldMinutes: number;

  // 5. Cancellation & Reschedule Policy
  cancellationNoticeHours: number;
  depositRefundPolicy: DepositRefundPolicy;
  cancellationPolicyText: string;

  // 6. Payment Credentials (Masked in UI, encrypted at rest)
  paystackPublicKey: string;
  paystackSecretKey: string;

  // 7. SMS Configuration
  smsSenderId: string;

  // 8. Regional Standards (Read-Only)
  currency: typeof STUDIO_CURRENCY;
  timezone: typeof STUDIO_TIMEZONE;

  // 9. HMS & Hotel Extensions
  hotelName: string;
  standardCheckInTime: string; // HH:MM e.g. "14:00"
  standardCheckOutTime: string; // HH:MM e.g. "11:00"
  freeCancelHoursBeforeCheckIn: number; // e.g. 24
  cancellationPenaltyPercent: number; // e.g. 50
  taxes: TaxSetting[]; // Named percentage taxes, toggleable, default empty
}

export const DEFAULT_OPENING_HOURS: DaySchedule[] = [
  { day: "Monday", weekday: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { day: "Tuesday", weekday: 2, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { day: "Wednesday", weekday: 3, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { day: "Thursday", weekday: 4, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { day: "Friday", weekday: 5, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { day: "Saturday", weekday: 6, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { day: "Sunday", weekday: 0, isOpen: false, openTime: "12:00", closeTime: "17:00" },
];

export const DEFAULT_HOLIDAYS: Holiday[] = [
  { id: "hol-1", date: "2026-01-01", name: "New Year's Day" },
  { id: "hol-2", date: "2026-03-06", name: "Independence Day" },
  { id: "hol-3", date: "2026-05-01", name: "May Day" },
  { id: "hol-4", date: "2026-12-25", name: "Christmas Day" },
  { id: "hol-5", date: "2026-12-26", name: "Boxing Day" },
];

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  businessName: "Becca's Crown Beauty Vault",
  businessLogo: "",
  businessPhone: "+233 24 111 2233",
  businessAddress: "14 Senchi Street, Airport Residential Area, Accra, Ghana",
  businessMapLink: "https://maps.google.com/?q=Airport+Residential+Accra",
  openingHours: DEFAULT_OPENING_HOURS,
  holidays: DEFAULT_HOLIDAYS,
  minimumNoticeHours: 2,
  maxDaysAhead: 60,
  slotIntervalMinutes: 30,
  slotHoldMinutes: 10,
  cancellationNoticeHours: 24,
  depositRefundPolicy: "FULL_REFUND_BEFORE_CUTOFF",
  cancellationPolicyText:
    "Free cancellations and reschedules are permitted up to 24 hours prior to appointment time. Deposits for late cancellations or no-shows are non-refundable.",
  paystackPublicKey: "",
  paystackSecretKey: "",
  smsSenderId: "BeccasCrown",
  currency: STUDIO_CURRENCY,
  timezone: STUDIO_TIMEZONE,
  hotelName: "Aura Royal Hotel & Restaurant",
  standardCheckInTime: "14:00",
  standardCheckOutTime: "11:00",
  freeCancelHoursBeforeCheckIn: 24,
  cancellationPenaltyPercent: 50,
  taxes: [],
};
