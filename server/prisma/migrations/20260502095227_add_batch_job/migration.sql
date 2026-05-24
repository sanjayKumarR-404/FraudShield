-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "BatchJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "frozenCount" INTEGER NOT NULL DEFAULT 0,
    "allowedCount" INTEGER NOT NULL DEFAULT 0,
    "reportData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BatchJob_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BatchJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchJob" ADD CONSTRAINT "BatchJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
