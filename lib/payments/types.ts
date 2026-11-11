export type PaymentChannel = "card" | "mobile_money" | "cash";

export type PaymentStatusType =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type BookingStatusType =
  | "HELD"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface InitializePaymentOptions {
  reference: string;
  amountPesewas: number;
  email: string;
  currency?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  channels?: Array<"card" | "mobile_money">;
}

export interface InitializePaymentResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifyPaymentResult {
  reference: string;
  status: "success" | "failed" | "abandoned" | "pending";
  amountPesewas: number;
  currency: string;
  channel: string;
  paidAt?: string;
  gatewayResponse?: string;
  metadata?: Record<string, unknown>;
}

export interface ChargeMobileMoneyOptions {
  reference: string;
  amountPesewas: number;
  email: string;
  phone: string;
  provider: "mtn" | "vod" | "tgo"; // MTN, Telecel/Vodafone, AT Ghana
  metadata?: Record<string, unknown>;
}

export interface ChargeMobileMoneyResult {
  reference: string;
  status: "pending" | "send_otp" | "send_pin" | "success" | "failed";
  displayMessage: string;
  displayText?: string;
}

export interface SubmitOtpOptions {
  reference: string;
  otp: string;
}

export interface SubmitPinOptions {
  reference: string;
  pin: string;
}

export interface RefundPaymentOptions {
  reference: string;
  amountPesewas?: number;
  reason?: string;
}

export interface RefundPaymentResult {
  refundId: string;
  reference: string;
  amountPesewas: number;
  status: string;
}

export interface BookingItemSummary {
  name: string;
  pricePesewas: number;
  durationMin: number;
}

export interface BookingSummaryData {
  id: string;
  reference: string;
  status: BookingStatusType;
  startUtc: string | Date;
  endUtc: string | Date;
  totalPesewas: number;
  depositRequiredPesewas: number;
  amountPaidPesewas: number;
  customerName: string;
  customerPhone: string;
  staffName: string;
  items: BookingItemSummary[];
}

export interface HotelReservationSummaryData {
  id: string;
  reference: string;
  status: string;
  checkInDate: string | Date;
  checkOutDate: string | Date;
  adults: number;
  children: number;
  totalPesewas: number;
  depositRequiredPesewas: number;
  amountPaidPesewas: number;
  guestName: string;
  guestPhone: string;
  rooms: Array<{
    roomTypeName: string;
    roomNumber: string;
  }>;
}

export interface BookingVerifyData {
  verified: boolean;
  alreadyProcessed?: boolean;
  paymentStatus?: PaymentStatusType;
  bookingStatus?: BookingStatusType;
  reservationStatus?: string;
  amountPaidPesewas?: number;
  booking?: BookingSummaryData | null;
  isHotel?: boolean;
  reservation?: HotelReservationSummaryData | null;
  message?: string;
}
