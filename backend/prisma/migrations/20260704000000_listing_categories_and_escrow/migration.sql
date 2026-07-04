-- AlterEnum
ALTER TYPE "PointTxReason" ADD VALUE 'ESCROW_DEPOSIT';
ALTER TYPE "PointTxReason" ADD VALUE 'ESCROW_RELEASE';
ALTER TYPE "PointTxReason" ADD VALUE 'ESCROW_REFUND';

-- CreateTable
CREATE TABLE "listing_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listing_categories_slug_key" ON "listing_categories"("slug");
