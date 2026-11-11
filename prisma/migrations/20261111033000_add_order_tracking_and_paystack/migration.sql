-- AlterTable
ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "trackingToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "RestaurantOrder" ADD COLUMN IF NOT EXISTS "paystackReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantOrder_trackingToken_key" ON "RestaurantOrder"("trackingToken");
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantOrder_paystackReference_key" ON "RestaurantOrder"("paystackReference");
CREATE INDEX IF NOT EXISTS "RestaurantOrder_trackingToken_idx" ON "RestaurantOrder"("trackingToken");
CREATE INDEX IF NOT EXISTS "RestaurantOrder_paystackReference_idx" ON "RestaurantOrder"("paystackReference");

