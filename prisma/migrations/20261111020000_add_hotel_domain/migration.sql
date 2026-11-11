-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'SENT', 'VIEWED', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "RoomStatus" AS ENUM ('CLEAN', 'DIRTY', 'INSPECTED', 'OCCUPIED', 'OUT_OF_ORDER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "RoomExtraPricing" AS ENUM ('PER_STAY', 'PER_NIGHT', 'PER_PERSON');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ReservationStatus" AS ENUM ('HELD', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ReservationSource" AS ENUM ('WEBSITE', 'FRONT_DESK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "HousekeepingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "FolioStatus" AS ENUM ('OPEN', 'SETTLED', 'VOID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "FolioChargeSource" AS ENUM ('ROOM', 'RESTAURANT', 'EXTRA', 'ADJUSTMENT', 'PAYMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "BookingSource" ADD VALUE IF NOT EXISTS 'WALK_IN';

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_paymentId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "manageTokenEncrypted" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "allergies" TEXT,
ADD COLUMN IF NOT EXISTS "anonymizedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "birthdayDay" INTEGER,
ADD COLUMN IF NOT EXISTS "birthdayMonth" INTEGER,
ADD COLUMN IF NOT EXISTS "company" TEXT,
ADD COLUMN IF NOT EXISTS "idNumber" TEXT,
ADD COLUMN IF NOT EXISTS "idType" TEXT,
ADD COLUMN IF NOT EXISTS "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nationality" TEXT,
ADD COLUMN IF NOT EXISTS "preferences" TEXT,
ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "vehiclePlate" TEXT;

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'SMS',
ADD COLUMN IF NOT EXISTS "costEstimatePesewas" INTEGER,
ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "encoding" TEXT,
ADD COLUMN IF NOT EXISTS "error" TEXT,
ADD COLUMN IF NOT EXISTS "event" TEXT,
ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS "metadata" JSONB,
ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "segmentCount" INTEGER,
ADD COLUMN IF NOT EXISTS "subject" TEXT,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "senderId" DROP NOT NULL,
ALTER COLUMN "senderId" SET DEFAULT 'Glamour';

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'SMS',
ADD COLUMN IF NOT EXISTS "event" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "subject" TEXT,
ADD COLUMN IF NOT EXISTS "variables" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "receiptId" TEXT;

-- AlterTable
ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'GHS',
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN IF NOT EXISTS "message" TEXT,
ADD COLUMN IF NOT EXISTS "momoProvider" TEXT,
ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paymentId" TEXT,
ADD COLUMN IF NOT EXISTS "pushMomo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "shortCode" TEXT,
ADD COLUMN IF NOT EXISTS "tokenHash" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP(3),
ALTER COLUMN "channel" SET DEFAULT 'ALL',
ALTER COLUMN "paystackReference" DROP NOT NULL,
DROP COLUMN IF EXISTS "status",
ADD COLUMN IF NOT EXISTS "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "bookingId" TEXT,
ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'PAYSTACK',
ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'GHS',
ADD COLUMN IF NOT EXISTS "providerRefundId" TEXT,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "paymentId" DROP NOT NULL,
ALTER COLUMN "reason" SET NOT NULL,
ALTER COLUMN "reason" SET DEFAULT 'Customer refund';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "depositValue" SET DEFAULT 30;

-- AlterTable
ALTER TABLE "ServiceCategory" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SlotHold" ADD COLUMN IF NOT EXISTS "addonIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "extendedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT,
ADD COLUMN IF NOT EXISTS "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "StaffSchedule" ADD COLUMN IF NOT EXISTS "breakEnd" TEXT,
ADD COLUMN IF NOT EXISTS "breakStart" TEXT,
ADD COLUMN IF NOT EXISTS "isDayOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "label" TEXT;

-- AlterTable
ALTER TABLE "TimeOff" ADD COLUMN IF NOT EXISTS "approved" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "phone" TEXT,
ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProcessedWebhook" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationJob" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "event" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "jobType" TEXT NOT NULL DEFAULT 'NOTIFICATION',
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InAppNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookingId" TEXT,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Receipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "bookingId" TEXT,
    "customerId" TEXT,
    "cashierId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "subtotalPesewas" INTEGER NOT NULL,
    "discountPesewas" INTEGER NOT NULL DEFAULT 0,
    "discountPercent" DOUBLE PRECISION,
    "discountReason" TEXT,
    "promoCode" TEXT,
    "tipPesewas" INTEGER NOT NULL DEFAULT 0,
    "totalPesewas" INTEGER NOT NULL,
    "amountPaidPesewas" INTEGER NOT NULL,
    "changePesewas" INTEGER NOT NULL DEFAULT 0,
    "balanceDuePesewas" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidedByUserId" TEXT,
    "items" JSONB NOT NULL,
    "payments" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SelfServiceOtp" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelfServiceOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RoomType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "maxAdults" INTEGER NOT NULL DEFAULT 2,
    "maxChildren" INTEGER NOT NULL DEFAULT 0,
    "bedConfiguration" TEXT NOT NULL,
    "basePricePesewas" INTEGER NOT NULL,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Room" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER,
    "roomTypeId" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'CLEAN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RateOverride" (
    "id" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "pricePesewas" INTEGER NOT NULL,
    "minNights" INTEGER,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RoomExtra" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePesewas" INTEGER NOT NULL,
    "pricing" "RoomExtraPricing" NOT NULL DEFAULT 'PER_STAY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Reservation" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "checkInDate" DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotalPesewas" INTEGER NOT NULL,
    "taxPesewas" INTEGER NOT NULL DEFAULT 0,
    "totalPesewas" INTEGER NOT NULL,
    "depositRequiredPesewas" INTEGER NOT NULL DEFAULT 0,
    "amountPaidPesewas" INTEGER NOT NULL DEFAULT 0,
    "source" "ReservationSource" NOT NULL DEFAULT 'WEBSITE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReservationRoom" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "room_type_id" TEXT NOT NULL,
    "room_id" TEXT,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "nightly_rates_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReservationExtra" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pricePesewas" INTEGER NOT NULL,
    "totalPesewas" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RoomHold" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HousekeepingTask" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "status" "HousekeepingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousekeepingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Folio" (
    "id" TEXT NOT NULL,
    "folioNumber" TEXT NOT NULL,
    "reservationId" TEXT,
    "status" "FolioStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FolioCharge" (
    "id" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" "FolioChargeSource" NOT NULL,
    "amountPesewas" INTEGER NOT NULL,
    "referenceId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessedWebhook_eventId_key" ON "ProcessedWebhook"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcessedWebhook_eventId_idx" ON "ProcessedWebhook"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationJob_idempotencyKey_key" ON "NotificationJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationJob_status_runAt_idx" ON "NotificationJob"("status", "runAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationJob_bookingId_event_idx" ON "NotificationJob"("bookingId", "event");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InAppNotification_userId_read_idx" ON "InAppNotification"("userId", "read");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InAppNotification_createdAt_idx" ON "InAppNotification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Receipt_receiptNumber_idx" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Receipt_bookingId_idx" ON "Receipt"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Receipt_customerId_idx" ON "Receipt"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Receipt_cashierId_idx" ON "Receipt"("cashierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Receipt_status_idx" ON "Receipt"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Receipt_createdAt_idx" ON "Receipt"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SelfServiceOtp_expiresAt_idx" ON "SelfServiceOtp"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SelfServiceOtp_reference_phone_idx" ON "SelfServiceOtp"("reference", "phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RoomType_slug_key" ON "RoomType"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoomType_slug_idx" ON "RoomType"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoomType_isActive_idx" ON "RoomType"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Room_number_key" ON "Room"("number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Room_roomTypeId_idx" ON "Room"("roomTypeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Room_status_idx" ON "Room"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RateOverride_roomTypeId_startDate_endDate_idx" ON "RateOverride"("roomTypeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoomExtra_isActive_idx" ON "RoomExtra"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_reference_key" ON "Reservation"("reference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_reference_idx" ON "Reservation"("reference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_guestId_idx" ON "Reservation"("guestId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_checkInDate_checkOutDate_idx" ON "Reservation"("checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReservationRoom_reservation_id_idx" ON "ReservationRoom"("reservation_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReservationRoom_room_type_id_idx" ON "ReservationRoom"("room_type_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReservationRoom_room_id_idx" ON "ReservationRoom"("room_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReservationRoom_status_idx" ON "ReservationRoom"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReservationRoom_check_in_check_out_idx" ON "ReservationRoom"("check_in", "check_out");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReservationExtra_reservationId_idx" ON "ReservationExtra"("reservationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReservationExtra_extraId_idx" ON "ReservationExtra"("extraId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RoomHold_token_key" ON "RoomHold"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoomHold_roomTypeId_checkIn_checkOut_idx" ON "RoomHold"("roomTypeId", "checkIn", "checkOut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoomHold_expiresAt_idx" ON "RoomHold"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HousekeepingTask_roomId_idx" ON "HousekeepingTask"("roomId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HousekeepingTask_assignedToUserId_idx" ON "HousekeepingTask"("assignedToUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HousekeepingTask_status_idx" ON "HousekeepingTask"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Folio_folioNumber_key" ON "Folio"("folioNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Folio_folioNumber_idx" ON "Folio"("folioNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Folio_reservationId_idx" ON "Folio"("reservationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Folio_status_idx" ON "Folio"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FolioCharge_folioId_idx" ON "FolioCharge"("folioId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FolioCharge_source_idx" ON "FolioCharge"("source");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BlockedTime_staffId_startUtc_endUtc_idx" ON "BlockedTime"("staffId", "startUtc", "endUtc");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Customer_isAnonymized_idx" ON "Customer"("isAnonymized");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Customer_deletedAt_idx" ON "Customer"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MessageLog_idempotencyKey_key" ON "MessageLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageLog_bookingId_idx" ON "MessageLog"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageLog_status_idx" ON "MessageLog"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageTemplate_event_channel_idx" ON "MessageTemplate"("event", "channel");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_receiptId_idx" ON "Payment"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRequest_shortCode_key" ON "PaymentRequest"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRequest_tokenHash_key" ON "PaymentRequest"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentRequest_bookingId_idx" ON "PaymentRequest"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentRequest_status_idx" ON "PaymentRequest"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentRequest_expiresAt_idx" ON "PaymentRequest"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Refund_bookingId_idx" ON "Refund"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_tokenHash_idx" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StaffSchedule_staffId_weekday_idx" ON "StaffSchedule"("staffId", "weekday");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TimeOff_staffId_startUtc_endUtc_idx" ON "TimeOff"("staffId", "startUtc", "endUtc");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Refund" ADD CONSTRAINT "Refund_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "RateOverride" ADD CONSTRAINT "RateOverride_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ReservationRoom" ADD CONSTRAINT "ReservationRoom_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ReservationRoom" ADD CONSTRAINT "ReservationRoom_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ReservationRoom" ADD CONSTRAINT "ReservationRoom_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ReservationExtra" ADD CONSTRAINT "ReservationExtra_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ReservationExtra" ADD CONSTRAINT "ReservationExtra_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "RoomExtra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "RoomHold" ADD CONSTRAINT "RoomHold_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Folio" ADD CONSTRAINT "Folio_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "FolioCharge" ADD CONSTRAINT "FolioCharge_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "FolioCharge" ADD CONSTRAINT "FolioCharge_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;



-- Enforce check_out > check_in on ReservationRoom
DO $$ BEGIN
    ALTER TABLE "ReservationRoom"
    ADD CONSTRAINT "check_reservation_room_dates"
    CHECK (check_out > check_in);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enforce checkOutDate > checkInDate on Reservation
DO $$ BEGIN
    ALTER TABLE "Reservation"
    ADD CONSTRAINT "check_reservation_dates"
    CHECK ("checkOutDate" > "checkInDate");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enforce no overlapping assigned room reservations with Postgres exclusion constraint
DO $$ BEGIN
    ALTER TABLE "ReservationRoom"
    ADD CONSTRAINT "no_overlapping_assigned_room_reservations"
    EXCLUDE USING gist (
        room_id WITH =,
        daterange(check_in, check_out, '[)') WITH &&
    )
    WHERE (
        room_id IS NOT NULL
        AND status IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN')
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
