-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "preflightReceiptId" TEXT,
ADD COLUMN     "upstreamBodyHash" TEXT,
ADD COLUMN     "upstreamBytesIn" INTEGER,
ADD COLUMN     "upstreamBytesOut" INTEGER,
ADD COLUMN     "upstreamDurationMs" INTEGER,
ADD COLUMN     "upstreamStatus" INTEGER;

-- CreateIndex
CREATE INDEX "Receipt_preflightReceiptId_idx" ON "Receipt"("preflightReceiptId");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_preflightReceiptId_fkey" FOREIGN KEY ("preflightReceiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
