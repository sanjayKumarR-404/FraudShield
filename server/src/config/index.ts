import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const config = {
    port: parseInt(process.env.PORT || "5000", 10),
    jwtSecret: process.env.JWT_SECRET || "fallback-dev-secret",
    jwtExpiresIn: "24h",
    aiEngineUrl: process.env.AI_ENGINE_URL || "http://localhost:8000",
    bcryptSaltRounds: 12,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
    twilioVoiceFrom: process.env.TWILIO_VOICE_FROM || '',
    alertPhoneNumber: process.env.ALERT_PHONE_NUMBER || '',
} as const;

// Debug — remove after confirming fix
console.log("[FraudShield Config] AI Engine URL:", config.aiEngineUrl);