-- Create recovery_cases table if it doesn't exist
CREATE TABLE IF NOT EXISTS "public"."recovery_cases" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transactionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'INITIATED',
  "complainantName" TEXT NOT NULL,
  "complainantEmail" TEXT NOT NULL,
  "description" TEXT,
  "pdfPath" TEXT,
  "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  -- FIR fields
  "firNumber" TEXT,
  "firStatus" TEXT DEFAULT 'INITIATED',
  "policeStationName" TEXT,
  "evidenceUploads" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "screenshotsCount" INTEGER DEFAULT 0,
  "bankStatementsCount" INTEGER DEFAULT 0,
  "chatHistoriesCount" INTEGER DEFAULT 0,
  "complainantPhone" TEXT,
  "bankName" TEXT,
  "accountNumber" TEXT,
  "firPdfPath" TEXT,
  "registeredAt" TIMESTAMP(3),
  "estimatedResolutionAt" TIMESTAMP(3),
  "day30Reminded" BOOLEAN DEFAULT false,
  "day60Reminded" BOOLEAN DEFAULT false,
  "day85Reminded" BOOLEAN DEFAULT false,
  "recoveryAmount" DOUBLE PRECISION,
  "recoveryDate" TIMESTAMP(3),
  
  UNIQUE("transactionId")
);