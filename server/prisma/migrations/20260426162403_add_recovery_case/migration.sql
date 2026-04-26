-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FROZEN', 'FAILED');

-- CreateEnum
CREATE TYPE "RecoveryStatus" AS ENUM ('INITIATED', 'BANK_NOTIFIED', 'RBI_ESCALATED', 'RESOLVED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "upi_vpa" TEXT NOT NULL,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "sender_vpa" TEXT NOT NULL,
    "receiver_vpa" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "rrn" VARCHAR(12) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "is_fraud" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT NOT NULL,
    "risk_score" DOUBLE PRECISION,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCase" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" "RecoveryStatus" NOT NULL DEFAULT 'INITIATED',
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bankNotifiedAt" TIMESTAMP(3),
    "rbiEscalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "complainantName" TEXT NOT NULL,
    "complainantEmail" TEXT NOT NULL,
    "complainantVpa" TEXT NOT NULL,
    "amountDisputed" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "pdfPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_upi_vpa_key" ON "users"("upi_vpa");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_rrn_key" ON "transactions"("rrn");

-- CreateIndex
CREATE INDEX "transactions_sender_vpa_idx" ON "transactions"("sender_vpa");

-- CreateIndex
CREATE INDEX "transactions_receiver_vpa_idx" ON "transactions"("receiver_vpa");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCase_transactionId_key" ON "RecoveryCase"("transactionId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_sender_vpa_fkey" FOREIGN KEY ("sender_vpa") REFERENCES "users"("upi_vpa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receiver_vpa_fkey" FOREIGN KEY ("receiver_vpa") REFERENCES "users"("upi_vpa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
