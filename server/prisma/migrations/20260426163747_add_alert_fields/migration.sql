-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "alertSentAt" TIMESTAMP(3),
ADD COLUMN     "voiceAlertSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappAlertSent" BOOLEAN NOT NULL DEFAULT false;
