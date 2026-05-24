-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "attribution_data" TEXT;

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "avgTransactionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minTransactionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxTransactionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stdDevAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mostCommonHour" INTEGER NOT NULL DEFAULT 10,
    "nightTransactionRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "favoriteReceiverVpas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "favoriteLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "amountZscoreThreshold" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "velocityThreshold" INTEGER NOT NULL DEFAULT 10,
    "transactionsProcessed" INTEGER NOT NULL DEFAULT 0,
    "profileUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
