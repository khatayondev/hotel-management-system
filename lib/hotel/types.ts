import { z } from "zod";
import { ReservationStatus, RoomExtraPricing, ReservationSource } from "@prisma/client";

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// -------------------------------------------------------------
// Zod Schemas
// -------------------------------------------------------------

export const availabilityQuerySchema = z.object({
  checkIn: z.string().regex(DATE_REGEX, "Check-in date must be YYYY-MM-DD"),
  checkOut: z.string().regex(DATE_REGEX, "Check-out date must be YYYY-MM-DD"),
  roomTypeId: z.string().uuid("Invalid roomTypeId").optional(),
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0),
});

export type AvailabilityQueryInput = z.input<typeof availabilityQuerySchema>;

export const extraSelectionSchema = z.object({
  extraId: z.string().uuid("Invalid extraId"),
  quantity: z.coerce.number().int().min(1).default(1),
});

export const pricingQuerySchema = z.object({
  roomTypeId: z.string().uuid("Invalid roomTypeId"),
  checkIn: z.string().regex(DATE_REGEX, "Check-in date must be YYYY-MM-DD"),
  checkOut: z.string().regex(DATE_REGEX, "Check-out date must be YYYY-MM-DD"),
  quantity: z.coerce.number().int().min(1).default(1),
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0),
  extras: z.array(extraSelectionSchema).optional().default([]),
});

export type PricingQueryInput = z.input<typeof pricingQuerySchema>;

export const createHoldSchema = z.object({
  roomTypeId: z.string().uuid("Invalid roomTypeId"),
  checkIn: z.string().regex(DATE_REGEX, "Check-in date must be YYYY-MM-DD"),
  checkOut: z.string().regex(DATE_REGEX, "Check-out date must be YYYY-MM-DD"),
  quantity: z.coerce.number().int().min(1).default(1),
  holdMinutes: z.coerce.number().int().min(1).max(60).optional(),
});

export type CreateHoldInput = z.input<typeof createHoldSchema>;

export const guestInfoSchema = z.object({
  name: z.string().min(2, "Guest name is required"),
  phone: z.string().min(8, "Valid phone number is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
  nationality: z.string().optional(),
  company: z.string().optional(),
  vehiclePlate: z.string().optional(),
});

export const createReservationFromHoldSchema = z.object({
  holdToken: z.string().min(10, "Hold token is required"),
  guestId: z.string().uuid("Invalid guestId").optional(),
  guest: guestInfoSchema.optional(),
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0),
  extras: z.array(extraSelectionSchema).optional().default([]),
  notes: z.string().optional(),
  source: z.nativeEnum(ReservationSource).optional().default(ReservationSource.WEBSITE),
});

export type CreateReservationFromHoldInput = z.input<typeof createReservationFromHoldSchema>;

export const assignRoomSchema = z.object({
  reservationRoomId: z.string().uuid("Invalid reservationRoomId"),
  roomId: z.string().uuid("Invalid roomId").optional(),
});

export type AssignRoomInput = z.input<typeof assignRoomSchema>;

export const moveReservationSchema = z.object({
  reservationId: z.string().uuid("Invalid reservationId"),
  newCheckIn: z.string().regex(DATE_REGEX, "New check-in date must be YYYY-MM-DD"),
  newCheckOut: z.string().regex(DATE_REGEX, "New check-out date must be YYYY-MM-DD"),
  newRoomTypeId: z.string().uuid("Invalid newRoomTypeId").optional(),
});

export type MoveReservationInput = z.input<typeof moveReservationSchema>;

export const cancelReservationSchema = z.object({
  reservationId: z.string().uuid("Invalid reservationId"),
  reason: z.string().min(2, "Cancellation reason is required").default("Guest requested cancellation"),
  cancelledByUserId: z.string().uuid("Invalid userId").optional(),
});

export type CancelReservationInput = z.input<typeof cancelReservationSchema>;

// -------------------------------------------------------------
// Response & Computation Interfaces
// -------------------------------------------------------------

export interface NightlyRate {
  date: string; // YYYY-MM-DD
  pricePesewas: number;
  rateLabel?: string | null;
  isOverridden: boolean;
}

export interface ExtraCalculation {
  extraId: string;
  name: string;
  pricing: RoomExtraPricing;
  unitPricePesewas: number;
  quantity: number;
  totalPesewas: number;
}

export interface TaxCalculation {
  id: string;
  name: string;
  percentage: number;
  taxPesewas: number;
}

export interface StayPricingResult {
  roomTypeId: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  quantity: number;
  adults: number;
  children: number;
  nightlyRates: NightlyRate[];
  roomSubtotalPesewas: number;
  extras: ExtraCalculation[];
  extrasSubtotalPesewas: number;
  subtotalPesewas: number;
  taxes: TaxCalculation[];
  taxTotalPesewas: number;
  totalPesewas: number;
  depositRequiredPesewas: number;
  currency: "GHS";
}

export interface RoomTypeAvailability {
  roomTypeId: string;
  name: string;
  slug: string;
  basePricePesewas: number;
  maxAdults: number;
  maxChildren: number;
  bedConfiguration: string;
  amenities: string[];
  imageUrls: string[];
  totalOperationalRooms: number;
  bookedRooms: number;
  heldRooms: number;
  availableQuantity: number;
  isAvailable: boolean;
  minNightsRequired: number;
  pricingPreview?: StayPricingResult;
}

export interface CancellationResult {
  reservationId: string;
  status: ReservationStatus;
  totalPesewas: number;
  amountPaidPesewas: number;
  penaltyPesewas: number;
  refundPesewas: number;
  isFreeCancellation: boolean;
  hoursUntilCheckIn: number;
  policyNotes: string;
}
