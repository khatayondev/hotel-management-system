-- CreateEnum
CREATE TYPE "PrepStation" AS ENUM ('KITCHEN', 'BAR');

-- CreateEnum
CREATE TYPE "RestaurantOrderType" AS ENUM ('DINE_IN', 'ROOM_SERVICE', 'PICKUP', 'WAITER');

-- CreateEnum
CREATE TYPE "RestaurantOrderStatus" AS ENUM ('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RestaurantPaymentStatus" AS ENUM ('PENDING', 'PAID', 'CHARGED_TO_ROOM', 'REFUNDED');

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "menuCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricePesewas" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "prepStation" "PrepStation" NOT NULL DEFAULT 'KITCHEN',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierGroup" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierOption" (
    "id" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDeltaPesewas" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "qrToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "type" "RestaurantOrderType" NOT NULL DEFAULT 'DINE_IN',
    "status" "RestaurantOrderStatus" NOT NULL DEFAULT 'PLACED',
    "tableId" TEXT,
    "reservationId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "notes" TEXT,
    "subtotalPesewas" INTEGER NOT NULL,
    "discountPesewas" INTEGER NOT NULL DEFAULT 0,
    "taxPesewas" INTEGER NOT NULL DEFAULT 0,
    "totalPesewas" INTEGER NOT NULL,
    "paymentStatus" "RestaurantPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "preparingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "cancelledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceSnapshot" INTEGER NOT NULL,
    "selectedModifiersSnapshot" JSONB NOT NULL,
    "totalPricePesewas" INTEGER NOT NULL,
    "notes" TEXT,
    "station" "PrepStation" NOT NULL DEFAULT 'KITCHEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_slug_key" ON "MenuCategory"("slug");

-- CreateIndex
CREATE INDEX "MenuCategory_sortOrder_idx" ON "MenuCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "MenuCategory_isActive_idx" ON "MenuCategory"("isActive");

-- CreateIndex
CREATE INDEX "MenuItem_menuCategoryId_idx" ON "MenuItem"("menuCategoryId");

-- CreateIndex
CREATE INDEX "MenuItem_isAvailable_idx" ON "MenuItem"("isAvailable");

-- CreateIndex
CREATE INDEX "MenuItem_prepStation_idx" ON "MenuItem"("prepStation");

-- CreateIndex
CREATE INDEX "MenuItem_sortOrder_idx" ON "MenuItem"("sortOrder");

-- CreateIndex
CREATE INDEX "ModifierGroup_menuItemId_idx" ON "ModifierGroup"("menuItemId");

-- CreateIndex
CREATE INDEX "ModifierGroup_sortOrder_idx" ON "ModifierGroup"("sortOrder");

-- CreateIndex
CREATE INDEX "ModifierOption_modifierGroupId_idx" ON "ModifierOption"("modifierGroupId");

-- CreateIndex
CREATE INDEX "ModifierOption_isAvailable_idx" ON "ModifierOption"("isAvailable");

-- CreateIndex
CREATE INDEX "ModifierOption_sortOrder_idx" ON "ModifierOption"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_label_key" ON "RestaurantTable"("label");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_qrToken_key" ON "RestaurantTable"("qrToken");

-- CreateIndex
CREATE INDEX "RestaurantTable_isActive_idx" ON "RestaurantTable"("isActive");

-- CreateIndex
CREATE INDEX "RestaurantTable_sortOrder_idx" ON "RestaurantTable"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantOrder_orderNumber_key" ON "RestaurantOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "RestaurantOrder_status_idx" ON "RestaurantOrder"("status");

-- CreateIndex
CREATE INDEX "RestaurantOrder_tableId_idx" ON "RestaurantOrder"("tableId");

-- CreateIndex
CREATE INDEX "RestaurantOrder_reservationId_idx" ON "RestaurantOrder"("reservationId");

-- CreateIndex
CREATE INDEX "RestaurantOrder_placedAt_idx" ON "RestaurantOrder"("placedAt");

-- CreateIndex
CREATE INDEX "RestaurantOrderItem_orderId_idx" ON "RestaurantOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "RestaurantOrderItem_itemId_idx" ON "RestaurantOrderItem"("itemId");

-- CreateIndex
CREATE INDEX "RestaurantOrderItem_station_idx" ON "RestaurantOrderItem"("station");

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuCategoryId_fkey" FOREIGN KEY ("menuCategoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
