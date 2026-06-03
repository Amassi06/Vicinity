-- CreateEnum
CREATE TYPE "PointTxReason" AS ENUM (
  'WELCOME_BONUS',
  'SERVICE_PAYMENT',
  'SERVICE_PAYOUT',
  'ADMIN_ADJUSTMENT',
  'REFUND'
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "from_user_id" UUID,
    "to_user_id" UUID,
    "amount" INTEGER NOT NULL,
    "reason" "PointTxReason" NOT NULL,
    "listing_id" TEXT,
    "contract_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "point_transactions_from_user_id_idx" ON "point_transactions"("from_user_id");
CREATE INDEX "point_transactions_to_user_id_idx" ON "point_transactions"("to_user_id");
CREATE INDEX "point_transactions_listing_id_idx" ON "point_transactions"("listing_id");
CREATE INDEX "point_transactions_created_at_idx" ON "point_transactions"("created_at");
