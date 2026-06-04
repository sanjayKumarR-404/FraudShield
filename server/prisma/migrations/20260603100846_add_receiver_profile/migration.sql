-- CreateTable
CREATE TABLE "receiver_profiles" (
    "id" TEXT NOT NULL,
    "receiverVpa" TEXT NOT NULL,
    "totalReceived" INTEGER NOT NULL DEFAULT 0,
    "totalFraudFlagged" INTEGER NOT NULL DEFAULT 0,
    "fraudRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uniqueSendersLast24h" INTEGER NOT NULL DEFAULT 0,
    "totalAmountLast24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgAmountReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isNewAccount" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskCategory" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receiver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receiver_profiles_receiverVpa_key" ON "receiver_profiles"("receiverVpa");
